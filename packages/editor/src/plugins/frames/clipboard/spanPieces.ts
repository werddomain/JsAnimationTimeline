// packages/editor/src/plugins/frames/clipboard/spanPieces.ts
/**
 * Morceaux de plage, communs à la copie et au collage : `slicePiece` retourne
 * la partie [from, to] d'une plage, avec les mêmes règles de coupe que
 * l'insertion d'une image clé (F6 / F7, `model/spans/insertKeyframe.ts`) :
 * - plage vide : un morceau vide ;
 * - morceau copié (`inherit`) : une image clé au début pour chaque
 *   propriété posée jusque-là dans le calque, héritées des plages
 *   précédentes comprises (collé ailleurs, il garde la même apparence) ;
 * - partie qui reste sur son calque (collage) : ses propres pistes ; coupée à
 *   gauche, ses propres propriétés évaluées au bord ;
 * - interpolation : les images clés de propriété du morceau sont gardées ;
 *   sur un bord droit coupé, une image clé pour chaque propriété interpolée,
 *   avec la valeur évaluée par le runtime (accélération comprise), pour que
 *   le morceau garde son allure.
 *
 * Choix : une propriété que la source montre à sa valeur par défaut parce
 * qu'elle n'est posée que plus loin n'est pas écrite ; collée sur un calque
 * qui la pose déjà, elle garde la valeur de ce calque.
 *
 * Limite connue (la même que pour F6) : l'accélération s'applique à toute
 * la plage ; sur un morceau d'une interpolation accélérée, les images entre
 * les bords sont relues à leur position accélérée (exact avec `linear`).
 *
 * Suite possible (K1) : exporter `truncateTween` et `newSpan` de
 * `insertKeyframe.ts` plutôt que de refaire la coupe ici.
 */

import type { ILayer, ISpan, PropertyRegistry, PropertyTracks, PropertyValues } from '@werddomain/timeline-runtime';
import { evaluateLayer } from '@werddomain/timeline-runtime';
import { evaluateValues } from '../../../model/spans/layerAccess';
import { SpanOperationCodes, SpanOperationError } from '../../../model/spans/SpanOperationError';
import { mapKeyframes, tracksFromValues, withTracks } from '../../../model/spans/tracks';

/** Evaluates known properties for paste without changing the strict K1/copy contract. */
export function evaluatePasteValues(layer: ILayer, frame: number, registry: PropertyRegistry): PropertyValues {
  try {
    return evaluateLayer(layer, frame, { registry, unknownProperties: 'skip' }).values;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SpanOperationError(
      SpanOperationCodes.EVALUATION_FAILED,
      `Impossible de calculer les valeurs du calque « ${layer.name} » à l'image ${frame} : ${detail}`
    );
  }
}

type ValuesReader = typeof evaluateValues;

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
function valuesAtStart(
  layer: ILayer,
  span: ISpan,
  from: number,
  registry: PropertyRegistry,
  readValues: ValuesReader
): PropertyValues | undefined {
  if (from > span.start) return setSoFar(layer, span, readValues(layer, from, registry));
  try {
    return setSoFar(layer, span, readValues(layer, from, registry));
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

/** Options de `slicePiece`. */
export interface ISliceOptions {
  /** Id du morceau (par défaut celui de la plage). */
  readonly id?: string;
  /**
   * Vrai pour un morceau copié : une image clé au début pour chaque
   * propriété posée jusque-là dans le calque (héritées comprises), pour que
   * le morceau collé ailleurs garde son apparence. Faux pour une partie qui
   * reste sur son calque (collage) : elle garde ses propres pistes et
   * continue de suivre les plages précédentes.
   */
  readonly inherit?: boolean;
  /** Paste-only evaluation mode; copies retain their existing strict boundary checks. */
  readonly unknownProperties?: 'skip';
}

/** Valeurs à poser au début du morceau, ou `undefined` pour garder les pistes de la plage. */
function startValues(
  layer: ILayer,
  span: ISpan,
  from: number,
  registry: PropertyRegistry,
  inherit: boolean,
  readValues: ValuesReader
): PropertyValues | undefined {
  if (inherit) return valuesAtStart(layer, span, from, registry, readValues);
  if (from === span.start) return undefined;
  const own = new Set(Object.keys(span.tracks ?? {}));
  return Object.fromEntries(Object.entries(readValues(layer, from, registry)).filter(([name]) => own.has(name)));
}

function staticTracks(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry,
  inherit: boolean,
  readValues: ValuesReader
): PropertyTracks | undefined {
  const values = startValues(layer, span, from, registry, inherit, readValues);
  return values === undefined ? keyframesWithin(span.tracks, from, to) : tracksFromValues(values, from);
}

function tweenTracks(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry,
  inherit: boolean,
  readValues: ValuesReader
): PropertyTracks | undefined {
  const names = Object.keys(span.tracks ?? {});
  const kept = keyframesWithin(span.tracks, from, to);
  const values = startValues(layer, span, from, registry, inherit, readValues);
  const withStart = values === undefined ? kept : withEdgeKeyframes(kept, Object.keys(values), from, values);
  // Bord droit coupé : seules les propriétés interpolées par la plage changent.
  return to < span.end ? withEdgeKeyframes(withStart, names, to, readValues(layer, to, registry)) : withStart;
}

/**
 * Partie [from, to] de `span` (incluse dans la plage). Les valeurs aux bords
 * coupés sont évaluées sur `layer`, le calque d'origine.
 */
export function slicePiece(
  layer: ILayer,
  span: ISpan,
  from: number,
  to: number,
  registry: PropertyRegistry,
  options: ISliceOptions = {}
): ISpan {
  const id = options.id ?? span.id;
  const inherit = options.inherit ?? false;
  const readValues = options.unknownProperties === 'skip' ? evaluatePasteValues : evaluateValues;
  const piece: ISpan = { ...span, id, start: from, end: to };
  if (span.kind === 'blank') return { id, start: from, end: to, kind: 'blank' };
  if (span.kind === 'static') return withTracks(piece, staticTracks(layer, span, from, to, registry, inherit, readValues));
  return withTracks(piece, tweenTracks(layer, span, from, to, registry, inherit, readValues));
}
