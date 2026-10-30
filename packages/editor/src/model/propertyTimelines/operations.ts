// packages/editor/src/model/propertyTimelines/operations.ts
import { evaluatePropertyTimeline, isValidPropertyName, sameTarget } from '@kazo-ca/timeline-runtime';
import type { ILayer, IPropertyTimeline, ITimelineDocument, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import type { IPropertyEditContext } from '../properties/targetProperties';
import { PropertyOperationError } from '../properties/propertyValue';
import { assertFrame, replaceLayer, requireEditableLayer } from '../spans/layerAccess';
import { migrateLegacyProperty } from './legacyMigration';
import { changeTransition, createTransition, createTransitionIdFactory, detachIncidentSources, detachSource, splitTransition } from './transitions';
import type { PropertyTimelineOperation } from './types';
import { assertPropertyValue, clonePropertyOperation, sameValue } from './values';

type WriteOperation = Extract<PropertyTimelineOperation, { kind: 'set' | 'capture' }>;

function hasOwn(value: object | undefined, name: string): boolean {
  return value !== undefined && Object.prototype.hasOwnProperty.call(value, name);
}

function assertAllowedProperty(layer: ILayer, name: string, context: IPropertyEditContext): void {
  if (!isValidPropertyName(name)) throw new PropertyOperationError(`Le nom de propriété « ${String(name)} » est invalide.`);
  if (layer.target === undefined) return;
  const target = layer.target;
  const properties = context.describe?.(target)?.properties
    ?? context.listTargets?.().find((info) => sameTarget(info.target, target))?.properties;
  if (properties !== undefined && !properties.some((property) => (typeof property === 'string' ? property : property.name) === name)) {
    throw new PropertyOperationError(`La propriété « ${name} » n'est pas modifiable pour cette cible.`);
  }
}

function readTrack(layer: ILayer, property: string): IPropertyTimeline | undefined {
  if (layer.spans.some((span) => hasOwn(span.tracks, property))) {
    throw new PropertyOperationError(`La propriété « ${property} » utilise des plages anciennes ; migrez-la explicitement avant de la modifier.`);
  }
  return hasOwn(layer.propertyTimelines, property) ? layer.propertyTimelines?.[property] : undefined;
}

function requireTrack(track: IPropertyTimeline | undefined, name: string): IPropertyTimeline {
  if (track === undefined) throw new PropertyOperationError(`La propriété « ${name} » ne possède pas encore de clés.`);
  return track;
}

function sample(track: IPropertyTimeline, operation: WriteOperation, context: IPropertyEditContext): TimelinePropertyValue {
  try {
    const value = evaluatePropertyTimeline(track, operation.frame, context.registry.get(operation.property));
    assertPropertyValue(value);
    return value;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new PropertyOperationError(`Impossible de calculer la propriété « ${operation.property} » à l'image ${operation.frame} : ${detail}`);
  }
}

function initialTrack(track: IPropertyTimeline | undefined, operation: WriteOperation): IPropertyTimeline {
  if (operation.initialValue !== undefined) assertPropertyValue(operation.initialValue);
  if (track !== undefined) {
    if (operation.initialValue !== undefined && !sameValue(track.initialValue, operation.initialValue)) {
      throw new PropertyOperationError("La valeur initiale est déjà enregistrée et ne peut pas être remplacée par une modification de clé.");
    }
    return track;
  }
  if (operation.initialValue === undefined) {
    throw new PropertyOperationError('Fournissez la valeur initiale de la propriété lors de son premier enregistrement.');
  }
  return { initialValue: operation.initialValue, keys: [] };
}

function writeKey(
  previous: IPropertyTimeline | undefined, operation: WriteOperation, context: IPropertyEditContext, nextId: () => string
): IPropertyTimeline {
  const track = initialTrack(previous, operation);
  if (operation.kind === 'set') {
    assertPropertyValue(operation.value);
    if (operation.value.kind !== track.initialValue.kind) {
      throw new PropertyOperationError('Le type de la valeur doit rester identique à celui de la propriété.');
    }
  }
  const existing = track.keys.find((key) => key.frame === operation.frame);
  if (existing !== undefined && (operation.kind === 'capture' || sameValue(existing.value, operation.value))) return track;
  const captured = existing === undefined ? sample(track, operation, context) : existing.value;
  const value = operation.kind === 'set' ? operation.value : captured;
  const split = existing === undefined ? splitTransition(track, operation.frame, nextId) : track;
  const updated = operation.kind === 'set' && !sameValue(captured, value) ? detachIncidentSources(split, operation.frame) : split;
  const keys = [...updated.keys.filter((key) => key.frame !== operation.frame), { frame: operation.frame, value }]
    .sort((a, b) => a.frame - b.frame);
  return { ...updated, keys };
}

function deleteKey(track: IPropertyTimeline, frame: number): IPropertyTimeline | undefined {
  if (!track.keys.some((key) => key.frame === frame)) throw new PropertyOperationError(`Aucune clé n'existe à l'image ${frame}.`);
  if (track.transitions?.some((transition) => transition.fromFrame === frame || transition.toFrame === frame)) {
    throw new PropertyOperationError("Supprimez d'abord les interpolations reliées à cette clé.");
  }
  const keys = track.keys.filter((key) => key.frame !== frame);
  return keys.length === 0 ? undefined : { ...track, keys };
}

function moveKey(track: IPropertyTimeline, frame: number, toFrame: number): IPropertyTimeline {
  const index = track.keys.findIndex((key) => key.frame === frame);
  if (index < 0) throw new PropertyOperationError(`Aucune clé n'existe à l'image ${frame}.`);
  if (frame === toFrame) return track;
  if (index > 0 && toFrame <= track.keys[index - 1].frame || index < track.keys.length - 1 && toFrame >= track.keys[index + 1].frame) {
    throw new PropertyOperationError('Une clé ne peut pas croiser ou remplacer une clé voisine.');
  }
  const keys = track.keys.map((key, at) => at === index ? { ...key, frame: toFrame } : key);
  const transitions = track.transitions?.map((transition) => {
    if (transition.fromFrame !== frame && transition.toFrame !== frame) return transition;
    const detached = detachSource(transition);
    return { ...detached, fromFrame: transition.fromFrame === frame ? toFrame : transition.fromFrame,
      toFrame: transition.toFrame === frame ? toFrame : transition.toFrame };
  });
  return { ...track, keys, ...(transitions === undefined ? {} : { transitions }) };
}

function updateLayer(layer: ILayer, property: string, track: IPropertyTimeline | undefined): ILayer {
  if (track !== undefined) return { ...layer, propertyTimelines: { ...layer.propertyTimelines, [property]: track } };
  return { ...layer, propertyTimelines: Object.fromEntries(Object.entries(layer.propertyTimelines ?? {}).filter(([name]) => name !== property)) };
}

function operate(
  doc: ITimelineDocument, track: IPropertyTimeline | undefined, operation: Exclude<PropertyTimelineOperation, { kind: 'migrate' }>, context: IPropertyEditContext
): IPropertyTimeline | undefined {
  if ('frame' in operation) assertFrame(doc, operation.frame);
  if (operation.kind === 'set' || operation.kind === 'capture') {
    return writeKey(track, operation, context, createTransitionIdFactory(doc, operation.layerId));
  }
  const existing = requireTrack(track, operation.property);
  switch (operation.kind) {
    case 'delete-key': return deleteKey(existing, operation.frame);
    case 'move-key':
      assertFrame(doc, operation.toFrame);
      return moveKey(existing, operation.frame, operation.toFrame);
    case 'create-transition': return createTransition(existing, operation.frames, operation.easing, createTransitionIdFactory(doc, operation.layerId));
    case 'remove-transition': return changeTransition(existing, operation.transitionId, true);
    case 'set-easing': return changeTransition(existing, operation.transitionId, false, operation.easing);
  }
}

/** Pure immutable edits; the host supplies initial state and current capabilities. */
export function applyPropertyTimelineOperation(
  doc: ITimelineDocument,
  input: PropertyTimelineOperation,
  context: IPropertyEditContext
): ITimelineDocument {
  const operation = clonePropertyOperation(input);
  if (!['set', 'capture', 'delete-key', 'move-key', 'create-transition', 'remove-transition', 'set-easing', 'migrate'].includes(operation.kind)) {
    throw new PropertyOperationError('Cette opération de propriété est inconnue.');
  }
  const layer = requireEditableLayer(doc, operation.layerId);
  assertAllowedProperty(layer, operation.property, context);
  if (operation.kind === 'migrate') return replaceLayer(doc, migrateLegacyProperty(doc, layer, operation.property, context.registry));
  const previous = readTrack(layer, operation.property);
  const next = operate(doc, previous, operation, context);
  return previous === next ? doc : replaceLayer(doc, updateLayer(layer, operation.property, next));
}
