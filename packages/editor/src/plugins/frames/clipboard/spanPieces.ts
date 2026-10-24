// packages/editor/src/plugins/frames/clipboard/spanPieces.ts
/**
 * Morceaux de plage, communs à la copie et au collage : `slicePiece` retourne
 * la partie [from, to] d'une plage, avec les mêmes règles de coupe que
 * l'insertion d'une image clé (F6 / F7, `model/spans/insertKeyframe.ts`) :
 * - plage vide : un morceau vide ;
 * - plage fixe coupée à gauche : fixe, avec les valeurs évaluées à `from` ;
 * - interpolation : les images clés de propriété du morceau sont gardées, et
 *   une image clé est posée sur chaque bord coupé avec la valeur évaluée par
 *   le runtime (accélération comprise), pour que le morceau garde son allure.
 *
 * Limite connue (la même que pour F6) : l'accélération s'applique à toute
 * la plage ; sur un morceau d'une interpolation accélérée, les images entre
 * les bords sont relues à leur position accélérée (exact avec `linear`).
 *
 * Suite possible (K1) : exporter `truncateTween` et `newSpan` de
 * `insertKeyframe.ts` plutôt que de refaire la coupe ici.
 */

import type { ILayer, ISpan, PropertyRegistry, PropertyTracks, PropertyValues } from '@werddomain/timeline-runtime';
import { evaluateValues } from '../../../model/spans/layerAccess';
import { mapKeyframes, tracksFromValues, withTracks } from '../../../model/spans/tracks';

/** Images clés de propriété comprises entre `from` et `to` (bornes incluses). */
function keyframesWithin(tracks: PropertyTracks | undefined, from: number, to: number): PropertyTracks | undefined {
  return mapKeyframes(tracks, (keyframe) => (keyframe.frame >= from && keyframe.frame <= to ? keyframe : undefined));
}

/** Pistes `tracks` avec, à `frame`, une image clé par propriété de `names` qui n'en a pas déjà une. */
function withEdgeKeyframes(
  tracks: PropertyTracks | undefined,
  names: readonly string[],
  frame: number,
  values: PropertyValues
): PropertyTracks | undefined {
  const next: Record<string, PropertyTracks[string]> = { ...tracks };
  names.forEach((name) => {
    const track = next[name] ?? [];
    const value = values[name];
    // Propriété sans valeur évaluée (inconnue du registre) : pas d'image clé inventée.
    if (value === undefined || track.some((keyframe) => keyframe.frame === frame)) return;
    next[name] = [...track, { frame, value }].sort((a, b) => a.frame - b.frame);
  });
  return Object.keys(next).length > 0 ? next : undefined;
}

function staticTracks(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry
): PropertyTracks | undefined {
  if (from === span.start) return keyframesWithin(span.tracks, from, to);
  return tracksFromValues(evaluateValues(layer, from, registry), from);
}

function tweenTracks(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry
): PropertyTracks | undefined {
  const names = Object.keys(span.tracks ?? {});
  const edges = [from > span.start ? from : undefined, to < span.end ? to : undefined];
  return edges.reduce<PropertyTracks | undefined>(
    (tracks, frame) =>
      frame === undefined ? tracks : withEdgeKeyframes(tracks, names, frame, evaluateValues(layer, frame, registry)),
    keyframesWithin(span.tracks, from, to)
  );
}

/**
 * Partie [from, to] de `span` (incluse dans la plage), sous l'id `id`.
 * Les valeurs aux bords coupés sont évaluées sur `layer`, le calque d'origine.
 */
export function slicePiece(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry,
  id: string = span.id
): ISpan {
  const piece: ISpan = { ...span, id, start: from, end: to };
  if (span.kind === 'blank') return { id, start: from, end: to, kind: 'blank' };
  if (span.kind === 'static') return withTracks(piece, staticTracks(layer, span, from, to, registry));
  return withTracks(piece, tweenTracks(layer, span, from, to, registry));
}
