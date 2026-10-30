// packages/editor/src/core/editor/propertyChangeEvents.ts
import { collectLayers, evaluatePropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { ILayer, IPropertyTimeline, PropertyRegistry } from '@kazo-ca/timeline-runtime';
import type { DocumentChangedEvent } from '../store/storeEvents';
import type { PropertyChangedEvent } from './propertyTimelineTypes';

function same(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function summary(
  before: IPropertyTimeline | undefined, after: IPropertyTimeline | undefined,
  property: string, registry: PropertyRegistry, migrated: boolean
): Pick<PropertyChangedEvent, 'kind' | 'frame' | 'oldValue' | 'newValue'> {
  if (migrated) return { kind: 'track' };
  const oldKeys = new Map(before?.keys.map((key) => [key.frame, key.value]));
  const newKeys = new Map(after?.keys.map((key) => [key.frame, key.value]));
  const changed = [...new Set([...oldKeys.keys(), ...newKeys.keys()])]
    .filter((frame) => !same(oldKeys.get(frame), newKeys.get(frame)));
  const metadataChanged = before !== undefined && after !== undefined &&
    !same({ ...before, keys: [], transitions: [] }, { ...after, keys: [], transitions: [] });
  if (!metadataChanged && changed.length === 1) {
    const frame = changed[0];
    const baseline: IPropertyTimeline = { initialValue: (after ?? before)!.initialValue, keys: [] };
    const descriptor = registry.get(property);
    try {
      const oldValue = evaluatePropertyTimeline(before ?? baseline, frame, descriptor);
      const newValue = evaluatePropertyTimeline(after ?? baseline, frame, descriptor);
      return { kind: 'key', frame, oldValue: Object.freeze({ ...oldValue }), newValue: Object.freeze({ ...newValue }) };
    } catch {
      // A custom interpolator failure cannot invalidate an already committed change.
      return { kind: 'track' };
    }
  }
  return { kind: changed.length === 0 && !metadataChanged && before !== undefined && after !== undefined ? 'transition' : 'track' };
}

function hasLegacyProperty(layer: ILayer | undefined, property: string): boolean {
  return layer?.spans.some((span) => span.tracks !== undefined && Object.prototype.hasOwnProperty.call(span.tracks, property)) ?? false;
}

/** Use the event's snapshots, never a newer document changed by a reentrant listener. */
export function propertyChanges(event: DocumentChangedEvent, registry: PropertyRegistry, transactionId?: string): readonly PropertyChangedEvent[] {
  const previous = new Map(collectLayers(event.previous).map((layer) => [layer.id, layer]));
  const current = new Map(collectLayers(event.document).map((layer) => [layer.id, layer]));
  const changes: PropertyChangedEvent[] = [];
  for (const layerId of new Set([...previous.keys(), ...current.keys()])) {
    const oldLayer = previous.get(layerId);
    const newLayer = current.get(layerId);
    const oldTracks = oldLayer?.propertyTimelines;
    const newTracks = newLayer?.propertyTimelines;
    for (const property of new Set([...Object.keys(oldTracks ?? {}), ...Object.keys(newTracks ?? {})])) {
      const before = oldTracks !== undefined && Object.prototype.hasOwnProperty.call(oldTracks, property) ? oldTracks[property] : undefined;
      const after = newTracks !== undefined && Object.prototype.hasOwnProperty.call(newTracks, property) ? newTracks[property] : undefined;
      if (same(before, after)) continue;
      const migrated = hasLegacyProperty(oldLayer, property) || hasLegacyProperty(newLayer, property);
      changes.push(Object.freeze({ layerId, property, before, after, cause: event.cause, label: event.label,
        ...(transactionId === undefined ? {} : { transactionId }), ...summary(before, after, property, registry, migrated) }));
    }
  }
  return changes;
}
