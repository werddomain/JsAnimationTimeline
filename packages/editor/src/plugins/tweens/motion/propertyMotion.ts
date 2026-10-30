// packages/editor/src/plugins/tweens/motion/propertyMotion.ts
import type { IPropertyTransition } from '@kazo-ca/timeline-runtime';
import type { IEditorContext } from '../../../core/context/IEditorContext';
import type { PropertyTimelineOperation } from '../../../model/propertyTimelines/types';
import { findLayer } from '../../../model/spans/layerAccess';
import { checkPropertyOperations, MIXED_PROPERTY_REASON, propertyCells, propertyKeys, propertyRow, refusePropertyAction, runPropertyOperations } from '../../frames/keyframes/propertyKeyframeActions';
import type { IFrameCell } from '../../frames/selection/frameSelection';
import type { IMotionTweenAvailability, PropertyMotionTweenEvent } from './types';

interface IPropertyMotionPlan {
  readonly operations: readonly PropertyTimelineOperation[];
  readonly availability: IMotionTweenAvailability;
}

export function propertyTransitionAt(ctx: IEditorContext, cell: IFrameCell): PropertyMotionTweenEvent | undefined {
  const row = propertyRow(ctx, cell.rowId);
  if (row === undefined) return undefined;
  const transitions = findLayer(ctx.document, row.layerId)?.propertyTimelines?.[row.property]?.transitions ?? [];
  const transition = transitions.find((candidate) => candidate.fromFrame <= cell.frame && cell.frame < candidate.toFrame)
    ?? transitions.find((candidate) => candidate.toFrame === cell.frame);
  return transition === undefined ? undefined : eventOf(row.layerId, row.property, transition);
}

function eventOf(layerId: string, property: string, transition: IPropertyTransition): PropertyMotionTweenEvent {
  return { layerId, property, transitionId: transition.id, start: transition.fromFrame, end: transition.toFrame };
}

/** No property cells means the legacy plugin keeps its existing targeting policy. */
export function propertyMotionPlan(ctx: IEditorContext, action: 'create' | 'remove'): IPropertyMotionPlan | undefined {
  const cells = ctx.services.require('frames.selection').cells();
  const targets = propertyCells(ctx, cells);
  if (targets.length === 0) return undefined;
  const refused = (reason: string): IPropertyMotionPlan => ({ operations: [], availability: { enabled: false, reason } });
  if (targets.length !== cells.length) return refused(MIXED_PROPERTY_REASON);
  let operations: PropertyTimelineOperation[];
  if (action === 'create') {
    const first = targets[0];
    if (targets.some((target) => target.layerId !== first.layerId || target.property !== first.property)) {
      return refused('Sélectionnez exactement deux clés de la même propriété.');
    }
    operations = [{ kind: 'create-transition', layerId: first.layerId, property: first.property,
      frames: propertyKeys(ctx, cells).map((key) => key.frame) }];
  } else {
    const touched = new Map<string, PropertyMotionTweenEvent>();
    targets.forEach((target) => {
      const event = propertyTransitionAt(ctx, target);
      if (event !== undefined) touched.set(JSON.stringify([event.layerId, event.property, event.transitionId]), event);
    });
    if (touched.size === 0) return refused('Aucune interpolation de propriété à supprimer.');
    operations = [...touched.values()].map((target) => ({ kind: 'remove-transition', ...target }));
  }
  return { operations, availability: checkPropertyOperations(ctx, operations) };
}

export function runPropertyMotion(ctx: IEditorContext, action: 'create' | 'remove'): boolean | undefined {
  const plan = propertyMotionPlan(ctx, action);
  if (plan === undefined) return undefined;
  const label = action === 'create' ? 'Créer une interpolation de propriété' : 'Supprimer une interpolation de propriété';
  if (!plan.availability.enabled) return refusePropertyAction(ctx, plan.availability.reason ?? 'Action impossible.', label);
  const before = ctx.document;
  const removed = plan.operations.flatMap((operation) => {
    if (operation.kind !== 'remove-transition') return [];
    const transition = findLayer(before, operation.layerId)?.propertyTimelines?.[operation.property]?.transitions?.find((item) => item.id === operation.transitionId);
    return transition === undefined ? [] : [eventOf(operation.layerId, operation.property, transition)];
  });
  if (!runPropertyOperations(ctx, plan.operations, label)) return false;
  if (action === 'remove') removed.forEach((event) => ctx.events.emit('tweens:propertyMotionRemoved', event));
  else plan.operations.forEach((operation) => {
    const previous = new Set(findLayer(before, operation.layerId)?.propertyTimelines?.[operation.property]?.transitions?.map((item) => item.id));
    findLayer(ctx.document, operation.layerId)?.propertyTimelines?.[operation.property]?.transitions?.forEach((transition) => {
      if (!previous.has(transition.id)) ctx.events.emit('tweens:propertyMotionCreated', eventOf(operation.layerId, operation.property, transition));
    });
  });
  return true;
}
