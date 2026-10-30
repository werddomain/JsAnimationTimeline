// packages/runtime/src/stage/html/gradientTimelineValidation.ts
import { evaluatePropertyTimeline } from '../../evaluate/propertyTimeline';
import type { IPropertyTimeline } from '../../model/propertyTimeline';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import type { IHtmlAnimationContext, IHtmlResolvedLayer } from './animationTypes';
import { resolveHtmlBinding } from './cssBindings';
import { composeHtmlDeclarations, validateHtmlPropertyValue } from './cssCompose';
import type { IHtmlResolvedBinding } from './cssTypes';

interface IGradientTrack {
  readonly property: string;
  readonly track: IPropertyTimeline;
  readonly binding: IHtmlResolvedBinding;
}

/** Validate the candidate in its complete gradient, independently of the current playhead or selection. */
export function validateHtmlGradientTimeline(
  layer: IHtmlResolvedLayer, property: string, track: IPropertyTimeline | undefined, binding: IHtmlResolvedBinding,
  context: IHtmlAnimationContext, registry: PropertyRegistry
): string | undefined {
  if (binding.binding.kind !== 'gradient') return undefined;
  const gradientId = binding.binding.gradientId;
  // Removal omits the candidate entirely: composition returns to the captured gradient definition.
  const tracks: IGradientTrack[] = track === undefined ? [] : [{ property, track, binding }];
  for (const [name, otherTrack] of Object.entries(layer.layer.propertyTimelines ?? {})) {
    if (name === property) continue;
    const explicit = context.bindings?.[layer.layerId]?.[name];
    const resolved = resolveHtmlBinding(name, otherTrack.initialValue.kind, registry, explicit);
    if (resolved.status !== 'value') {
      if (explicit?.kind === 'gradient' && explicit.gradientId === gradientId) return resolved.reason;
      continue;
    }
    if (resolved.value.binding.kind === 'gradient' && resolved.value.binding.gradientId === gradientId) {
      tracks.push({ property: name, track: otherTrack, binding: resolved.value });
    }
  }
  const gradients = context.gradients?.[layer.layerId] ?? [];
  const bindings = Object.fromEntries(tracks.map((entry) => [entry.property, entry.binding]));
  // Presence and type are held values. Their complete state changes only at key boundaries.
  // Include every other component's keys as well, and the actual pre-key state at image 1.
  const frames = [...new Set([1, ...tracks.flatMap((entry) => entry.track.keys.map((key) => key.frame))])].sort((a, b) => a - b);
  for (const element of layer.elements) {
    for (const entry of tracks) {
      const values = [entry.track.initialValue, ...entry.track.keys.map((key) => key.value),
        ...(entry.track.transitions ?? []).flatMap((transition) => transition.source?.keys.map((key) => key.value) ?? [])];
      for (const value of values) {
        const reason = validateHtmlPropertyValue(element, entry.binding, value, gradients);
        if (reason !== undefined) return reason;
      }
    }
    for (const frame of frames) {
      const values = Object.fromEntries(tracks.map((entry) => [entry.property,
        evaluatePropertyTimeline(entry.track, frame, registry.get(entry.property))]));
      const result = composeHtmlDeclarations(element, values, bindings, gradients);
      if (result.diagnostics.length > 0) return result.diagnostics[0].reason;
    }
  }
  return undefined;
}
