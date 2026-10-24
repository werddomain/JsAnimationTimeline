// packages/editor/src/plugins/frames/clipboard/spanPieces.ts
/**
 * Morceaux de plage, communs à la copie et au collage : `slicePiece` retourne
 * la partie [from, to] d'une plage, avec les mêmes règles de coupe que
 * l'insertion d'une image clé (F6 / F7, `model/spans/insertKeyframe.ts`) :
 * - plage vide : un morceau vide ;
 * - plage fixe : fixe, avec toutes les valeurs évaluées à `from`, y compris
 *   les propriétés héritées des plages précédentes (le morceau collé ailleurs
 *   garde la même apparence) ;
 * - interpolation : les images clés de propriété du morceau sont gardées ;
 *   au début du morceau, une image clé pour chaque propriété évaluée
 *   (héritées comprises) ; sur un bord droit coupé, une image clé pour
 *   chaque propriété interpolée, avec la valeur évaluée par le runtime
 *   (accélération comprise), pour que le morceau garde son allure.
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
import { SpanOperationError } from '../../../model/spans/SpanOperationError';
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

/**
 * Valeurs du calque à `from`, début d'un morceau. Un morceau qui commence à
 * l'image clé de sa plage n'a aucune image à recalculer : si l'évaluation
 * échoue (propriété inconnue du registre), ses pistes sont gardées telles
 * quelles (`undefined`). Un bord coupé, lui, doit être évalué.
 */
function valuesAtStart(layer: ILayer, span: ISpan, from: number, registry: PropertyRegistry): PropertyValues | undefined {
  if (from > span.start) return setSoFar(layer, span, evaluateValues(layer, from, registry));
  try {
    return setSoFar(layer, span, evaluateValues(layer, from, registry));
  } catch (error) {
    if (error instanceof SpanOperationError) return undefined;
    throw error;
  }
}

/**
 * `values` réduites aux propriétés posées par `span` ou par une plage
 * précédente : une propriété animée seulement plus loin dans le calque vaut
 * ici sa valeur par défaut, et l'écrire forcerait cette valeur à l'endroit
 * du collage.
 */
function setSoFar(layer: ILayer, span: ISpan, values: PropertyValues): PropertyValues {
  const names = new Set<string>();
  layer.spans
    .filter((candidate) => candidate.start <= span.start)
    .forEach((candidate) => Object.keys(candidate.tracks ?? {}).forEach((name) => names.add(name)));
  return Object.fromEntries(Object.entries(values).filter(([name]) => names.has(name)));
}

function staticTracks(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry
): PropertyTracks | undefined {
  // Valeurs complètes à `from` : celles de la plage et celles héritées des plages précédentes.
  const values = valuesAtStart(layer, span, from, registry);
  return values === undefined ? keyframesWithin(span.tracks, from, to) : tracksFromValues(values, from);
}

function tweenTracks(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry
): PropertyTracks | undefined {
  const names = Object.keys(span.tracks ?? {});
  const kept = keyframesWithin(span.tracks, from, to);
  // Début du morceau : une image clé pour chaque propriété évaluée (héritées comprises).
  const startValues = valuesAtStart(layer, span, from, registry);
  const withStart = startValues === undefined ? kept : withEdgeKeyframes(kept, Object.keys(startValues), from, startValues);
  // Bord droit coupé : seules les propriétés interpolées par la plage changent.
  return to < span.end ? withEdgeKeyframes(withStart, names, to, evaluateValues(layer, to, registry)) : withStart;
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
