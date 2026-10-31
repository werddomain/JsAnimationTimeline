// packages/runtime/src/stage/html/exportWork.ts
import type { IPropertyTimeline } from '../../model/propertyTimeline';
import { clonePlaybackJson } from '../../playback/json';
import { cloneHtmlAnimationContext } from './animationContext';
import type { IHtmlAnimationContext, IHtmlResolvedLayer } from './animationTypes';

/** DOM declaration checks are substantially more expensive than numeric evaluation. */
const MAX_HTML_EXPORT_WORK = 100_000;
export class HtmlExportResourceError extends Error {
  constructor() { super(`La préparation HTML dépasse son budget de travail (${MAX_HTML_EXPORT_WORK} unités pondérées). Réduisez les cibles, les clés ou les dégradés.`); }
}
function limit(work: number): void { if (work > MAX_HTML_EXPORT_WORK) throw new HtmlExportResourceError(); }

/** Reject oversized context trees before their semantic validation and canonical serialization. */
export function cloneBoundedHtmlExportContext(input: IHtmlAnimationContext | undefined): IHtmlAnimationContext {
  const safe = clonePlaybackJson(input ?? { version: 1 });
  let work = 0;
  const count = (value: unknown): void => {
    work += 8 + (typeof value === 'string' ? value.length / 16 : 0);
    limit(work);
    if (value !== null && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      work += key.length / 16;
      limit(work);
      count(child);
    }
  };
  count(safe);
  return cloneHtmlAnimationContext(safe as IHtmlAnimationContext);
}

function valuesOf(track: IPropertyTimeline): number {
  const values = [track.initialValue, ...track.keys.map((key) => key.value),
    ...(track.transitions ?? []).flatMap((transition) => transition.source?.keys.map((key) => key.value) ?? [])];
  return values.reduce((sum, value) => sum + 1 + (value.kind === 'text' ? value.value.length / 16 : 0), 0);
}

/** Structural bound, run after selector resolution but before any style inspection/composition. */
export function assertHtmlExportPreparationBudget(layers: readonly IHtmlResolvedLayer[], context: IHtmlAnimationContext, playbackFrames = 0): void {
  let work = 0;
  const intersections = new Map<Element, { contributions: number; values: number }>();
  for (const { layer, layerId, elements } of layers) {
    const entries = Object.entries(layer.propertyTimelines ?? {});
    const legacy = new Set(layer.spans.flatMap((span) => Object.keys(span.tracks ?? {})));
    const legacyValues = layer.spans.reduce((sum, span) => sum + Object.values(span.tracks ?? {}).reduce((count, keys) => count + keys.length, 0), 0);
    const values = entries.reduce((sum, [, track]) => sum + valuesOf(track), legacyValues);
    const properties = entries.length + legacy.size;
    work += elements.length * (8 + 8 * values + 4 * properties) + values;
    const stops = (context.gradients?.[layerId] ?? []).reduce((sum, gradient) => sum + gradient.stops.length, 0);
    // The sampled HTML format also validates/composes every target at every output frame.
    work += playbackFrames * elements.length * (8 * (1 + properties + stops));
    limit(work);
    // Gradient validation repeats the complete group's state for each property.
    const groups = new Map<string, IPropertyTimeline[]>();
    for (const [name, track] of entries) {
      const binding = context.bindings?.[layerId]?.[name];
      if (binding?.kind !== 'gradient') continue;
      groups.set(binding.gradientId, [...(groups.get(binding.gradientId) ?? []), track]);
    }
    for (const [id, tracks] of groups) {
      const stops = context.gradients?.[layerId]?.find((gradient) => gradient.id === id)?.stops.length ?? 0;
      const keys = tracks.reduce((sum, track) => sum + track.keys.length, 0);
      const scanned = tracks.reduce((sum, track) => sum + valuesOf(track) + (track.transitions?.length ?? 0), 0);
      work += elements.length * tracks.length * (scanned * (1 + stops) +
        (1 + keys) * (2 * scanned + 8 * tracks.length * (1 + stops)));
      limit(work);
    }
    for (const element of elements) {
      const previous = intersections.get(element) ?? { contributions: 0, values: 0 };
      const next = { contributions: previous.contributions + properties, values: previous.values + values };
      // Includes collision resolution, signature comparisons and composition grouping.
      work += next.contributions * (next.contributions + next.values) -
        previous.contributions * (previous.contributions + previous.values);
      limit(work);
      intersections.set(element, next);
    }
  }
}
