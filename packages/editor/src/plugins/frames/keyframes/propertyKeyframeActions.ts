// packages/editor/src/plugins/frames/keyframes/propertyKeyframeActions.ts
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import { CompositeCommand } from '../../../core/commands/CompositeCommand';
import { createCommand } from '../../../core/commands/createCommand';
import type { IEditorContext } from '../../../core/context/IEditorContext';
import { createStagePropertyEditContext } from '../../../core/stage/propertyEditContext';
import type { IEditorPropertyTimelines, PropertyTimelineMutationResult } from '../../../core/editor/propertyTimelineTypes';
import { applyPropertyTimelineOperation } from '../../../model/propertyTimelines/operations';
import { PropertyTimelineCommand } from '../../../model/propertyTimelines/PropertyTimelineCommand';
import type { PropertyTimelineOperation } from '../../../model/propertyTimelines/types';
import { PropertyOperationError } from '../../../model/properties/propertyValue';
import type { IPropertyVisibleRow } from '../../../model/rows';
import { findLayer } from '../../../model/spans/layerAccess';
import { SpanOperationError } from '../../../model/spans/SpanOperationError';
import type { IFrameCell } from '../selection/frameSelection';
import type { SpanAction } from './keyframeActions';
import type {} from '../grid/types';

export interface IPropertyCell extends IFrameCell {
  readonly layerId: string;
  readonly property: string;
}
export interface IPropertyActionAvailability { readonly enabled: boolean; readonly reason?: string }
export const MIXED_PROPERTY_REASON = 'Sélectionnez uniquement des images de lignes de propriétés.';
export const UNSUPPORTED_PROPERTY_REASON = 'Cette action de plage ne s’applique pas aux lignes de propriétés.';

/** Resolve opaque visual identity through the projection, never by parsing its ID. */
export function propertyRow(ctx: IEditorContext, rowId: string): IPropertyVisibleRow | undefined {
  const row = ctx.services.get('frames.grid')?.rows().find((candidate) => candidate.id === rowId);
  return row?.kind === 'property' ? row : undefined;
}

export function propertyCells(ctx: IEditorContext, cells: readonly IFrameCell[]): IPropertyCell[] {
  const rows = new Map(ctx.services.get('frames.grid')?.rows().map((row) => [row.id, row]));
  return cells.flatMap((cell) => {
    const row = rows.get(cell.rowId);
    return row?.kind !== 'property' ? [] : [{ ...cell, layerId: row.layerId, property: row.property }];
  });
}

export function propertyKeys(ctx: IEditorContext, cells: readonly IFrameCell[]): IPropertyCell[] {
  const framesByRow = new Map<string, ReadonlySet<number>>();
  return propertyCells(ctx, cells).filter(({ rowId, layerId, property, frame }) => {
    let frames = framesByRow.get(rowId);
    if (frames === undefined) {
      frames = new Set(findLayer(ctx.document, layerId)?.propertyTimelines?.[property]?.keys.map((key) => key.frame));
      framesByRow.set(rowId, frames);
    }
    return frames.has(frame);
  });
}

/** Reuse the model policy, including capabilities and ancestor locks, without history. */
export function checkPropertyOperations(ctx: IEditorContext, operations: readonly PropertyTimelineOperation[]): IPropertyActionAvailability {
  if (ctx.commands.isGrouping) return { enabled: false, reason: 'Une commande est déjà en cours.' };
  if (operations.length === 0) return { enabled: false, reason: 'Sélectionnez une image de propriété.' };
  const before = ctx.document;
  const cells = ctx.services.get('frames.selection')?.cells() ?? [];
  try {
    const context = createStagePropertyEditContext(ctx.registry, ctx.stage.stages);
    operations.reduce<ITimelineDocument>((doc, operation) => applyPropertyTimelineOperation(doc, operation, context), before);
    if (ctx.document !== before || !sameSelection(ctx, cells)) return { enabled: false, reason: 'Le contexte a changé pendant la vérification.' };
    return { enabled: true };
  } catch (error) {
    if (error instanceof PropertyOperationError || error instanceof SpanOperationError) return { enabled: false, reason: error.message };
    throw error;
  }
}

export function refusePropertyAction(ctx: IEditorContext, reason: string, label = 'Modifier une propriété'): false {
  ctx.commands.execute(createCommand(label, () => { throw new CommandRefusedError(label, reason); }, (doc) => doc));
  return false;
}

function sameSelection(ctx: IEditorContext, cells: readonly IFrameCell[]): boolean {
  const current = ctx.services.get('frames.selection')?.cells() ?? [];
  return current.length === cells.length && current.every((cell, index) => cell.rowId === cells[index].rowId && cell.frame === cells[index].frame);
}

function guardedApi(ctx: IEditorContext): IEditorPropertyTimelines {
  const before = ctx.document;
  const cells = ctx.services.get('frames.selection')?.cells() ?? [];
  return ctx.propertyTimelines.guarded(() => ctx.document === before && sameSelection(ctx, cells));
}

function apply(api: IEditorPropertyTimelines, operation: PropertyTimelineOperation): PropertyTimelineMutationResult {
  switch (operation.kind) {
    case 'capture': return api.capture(operation.layerId, operation.property, { frame: operation.frame, initialValue: operation.initialValue });
    case 'delete-key': return api.deleteKey(operation.layerId, operation.property, operation.frame);
    case 'move-key': return api.moveKey(operation.layerId, operation.property, operation.frame, operation.toFrame);
    case 'create-transition': return api.createTransition(operation.layerId, operation.property, operation.frames, operation.easing);
    case 'remove-transition': return api.removeTransition(operation.layerId, operation.property, operation.transitionId);
    case 'set-easing': return api.setEasing(operation.layerId, operation.property, operation.transitionId, operation.easing);
    case 'set': return api.set(operation.layerId, operation.property, operation.value, { frame: operation.frame, initialValue: operation.initialValue });
    case 'migrate': return api.migrate(operation.layerId, operation.property);
  }
}

/** Instant UI batches commit atomically; public transactions remain for continuous gestures. */
export function runPropertyOperations(ctx: IEditorContext, operations: readonly PropertyTimelineOperation[], label: string): boolean {
  const availability = checkPropertyOperations(ctx, operations);
  if (!availability.enabled) return refusePropertyAction(ctx, availability.reason ?? 'Action impossible.', label);
  if (operations.length === 1) return apply(guardedApi(ctx), operations[0]).status === 'changed';
  const before = ctx.document;
  const cells = ctx.services.get('frames.selection')?.cells() ?? [];
  const current = (): boolean => ctx.document === before && sameSelection(ctx, cells);
  const context = createStagePropertyEditContext(ctx.registry, ctx.stage.stages);
  // Reuse the facade's model commands and the core commit observer. Observers
  // see all keys together; pruning a deleted row cannot invalidate half a batch.
  const commands = operations.map((operation) => new PropertyTimelineCommand(operation, context, current));
  return ctx.commands.execute(new CompositeCommand(label, commands));
}

/** Undefined delegates to the legacy span path; modern selections never do. */
export function runPropertySpanAction(ctx: IEditorContext, action: SpanAction): boolean | undefined {
  const cells = ctx.services.require('frames.selection').cells();
  const targets = propertyCells(ctx, cells);
  if (targets.length === 0) return undefined;
  if (targets.length !== cells.length) return refusePropertyAction(ctx, MIXED_PROPERTY_REASON);
  if (action !== 'insertKeyframe' && action !== 'deleteKeyframe') return refusePropertyAction(ctx, UNSUPPORTED_PROPERTY_REASON);
  const keys = action === 'deleteKeyframe' ? propertyKeys(ctx, cells) : targets;
  const operations: PropertyTimelineOperation[] = keys.map((target) => ({
    kind: action === 'insertKeyframe' ? 'capture' : 'delete-key', layerId: target.layerId, property: target.property, frame: target.frame
  }));
  return runPropertyOperations(ctx, operations, action === 'insertKeyframe' ? 'Créer des clés de propriété' : 'Supprimer des clés de propriété');
}

export function propertyMoveOperations(keys: readonly IPropertyCell[], offset: number): PropertyTimelineOperation[] {
  return [...keys].sort((a, b) => offset > 0 ? b.frame - a.frame : a.frame - b.frame).map((key) => ({
    kind: 'move-key', layerId: key.layerId, property: key.property, frame: key.frame, toFrame: key.frame + offset
  }));
}

export function movePropertyKeys(ctx: IEditorContext, keys: readonly IPropertyCell[], cells: readonly IFrameCell[], offset: number): boolean {
  if (offset === 0 || keys.length === 0) return false;
  if (propertyCells(ctx, cells).length !== cells.length) return refusePropertyAction(ctx, MIXED_PROPERTY_REASON);
  if (!runPropertyOperations(ctx, propertyMoveOperations(keys, offset), 'Déplacer des clés de propriété')) return false;
  const moved = new Set(keys.map((key) => key.rowId));
  ctx.services.require('frames.selection').set(cells.map((cell) => moved.has(cell.rowId) ? { ...cell, frame: cell.frame + offset } : cell));
  return true;
}
