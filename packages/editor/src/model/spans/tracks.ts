// packages/editor/src/model/spans/tracks.ts
/**
 * Outils immuables sur les pistes et les plages : transformer les images
 * clés de propriété (décaler, recaler, supprimer), poser ou retirer le champ
 * `tracks`, décaler une plage entière, trouver la plage d'une image.
 */

import type { ILayer, IPropertyKeyframe, ISpan, PropertyTracks, PropertyValues } from '@werddomain/timeline-runtime';

/** Nouvelle image clé, ou `undefined` pour la retirer. */
export type KeyframeMapper = (keyframe: IPropertyKeyframe) => IPropertyKeyframe | undefined;

/**
 * Applique `mapper` à chaque image clé. Résultat trié par image ; si deux
 * images clés tombent sur la même image, la dernière (dans l'ordre d'origine)
 * gagne. Les pistes vides disparaissent ; `undefined` s'il n'en reste aucune.
 */
export function mapKeyframes(tracks: PropertyTracks | undefined, mapper: KeyframeMapper): PropertyTracks | undefined {
  if (tracks === undefined) return undefined;
  const next: Record<string, readonly IPropertyKeyframe[]> = {};
  for (const [name, track] of Object.entries(tracks)) {
    const byFrame = new Map<number, IPropertyKeyframe>();
    track.forEach((keyframe) => {
      const mapped = mapper(keyframe);
      if (mapped !== undefined) byFrame.set(mapped.frame, mapped);
    });
    if (byFrame.size > 0) next[name] = Array.from(byFrame.values()).sort((a, b) => a.frame - b.frame);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Plage sans le champ `tracks` quand `tracks` vaut `undefined`, sinon avec. */
export function withTracks(span: ISpan, tracks: PropertyTracks | undefined): ISpan {
  const base: ISpan = { id: span.id, start: span.start, end: span.end, kind: span.kind };
  const withEasing = span.easing === undefined ? base : { ...base, easing: span.easing };
  return tracks === undefined ? withEasing : { ...withEasing, tracks };
}

/** Une piste d'une seule image clé à `frame` pour chaque valeur (`undefined` si aucune). */
export function tracksFromValues(values: PropertyValues, frame: number): PropertyTracks | undefined {
  const entries = Object.entries(values);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map(([name, value]) => [name, [{ frame, value }]]));
}

/** Images clés d'après `frame` décalées de `delta` ; les autres restent en place. */
export function shiftKeyframesAfter(tracks: PropertyTracks | undefined, frame: number, delta: number): PropertyTracks | undefined {
  return mapKeyframes(tracks, (keyframe) => (keyframe.frame > frame ? { ...keyframe, frame: keyframe.frame + delta } : keyframe));
}

/** Plage décalée de `delta` images, images clés comprises. */
export function shiftSpan(span: ISpan, delta: number): ISpan {
  const moved: ISpan = { ...span, start: span.start + delta, end: span.end + delta };
  return withTracks(moved, mapKeyframes(span.tracks, (keyframe) => ({ ...keyframe, frame: keyframe.frame + delta })));
}

/**
 * Images clés recalées proportionnellement de [oldStart, oldEnd] vers
 * [newStart, newEnd] (étirement d'une interpolation, comme dans Flash CS4),
 * arrondies à l'image entière.
 */
export function retimeKeyframes(
  tracks: PropertyTracks | undefined,
  from: { readonly start: number; readonly end: number },
  to: { readonly start: number; readonly end: number }
): PropertyTracks | undefined {
  const oldLength = from.end - from.start;
  const newLength = to.end - to.start;
  return mapKeyframes(tracks, (keyframe) => {
    const ratio = oldLength === 0 ? 0 : (keyframe.frame - from.start) / oldLength;
    return { ...keyframe, frame: to.start + Math.round(ratio * newLength) };
  });
}

/** Index de la plage qui contient `frame`, `-1` après la dernière plage. */
export function spanIndexAt(layer: ILayer, frame: number): number {
  return layer.spans.findIndex((span) => span.start <= frame && frame <= span.end);
}

/** Dernière image couverte par une plage (0 pour un calque vide). */
export function lastFrame(layer: ILayer): number {
  return layer.spans.length === 0 ? 0 : layer.spans[layer.spans.length - 1].end;
}

/** Calque avec de nouvelles plages. */
export function withSpans(layer: ILayer, spans: readonly ISpan[]): ILayer {
  return { ...layer, spans };
}
