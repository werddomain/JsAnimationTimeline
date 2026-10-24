// packages/editor/src/plugins/tweens/motion/createMotionTween.ts
/**
 * Création d'une interpolation de mouvement (motion tween, Flash CS4).
 * Fonctions pures : nouveau document, ou refus (`MotionTweenError`,
 * `SpanOperationError`).
 *
 * Depuis une plage (`createMotionTweenFromSpan`, 1 image clé ou aucune) : la
 * plage statique [s, e] devient une interpolation [s, e], même id et mêmes
 * pistes, sans accélération.
 *
 * Entre deux images clés k1 < k2 (`createMotionTweenBetween`) : toutes les
 * plages de [k1, k2 - 1] fusionnent en une interpolation [k1, k2 - 1] qui
 * garde l'id de la plage de k1. Ses pistes contiennent, pour chaque
 * propriété du calque :
 * - la valeur évaluée à k1, à l'image k1 ;
 * - les images clés de contenu intermédiaires, avec leurs valeurs évaluées ;
 * - les images clés de propriété des interpolations absorbées ;
 * - les valeurs évaluées de k2, à l'image k2 - 1 (celles évaluées à k2 - 1 si
 *   k2 est une image clé vide).
 * k2 reste une image clé de contenu, inchangée : les valeurs à k2 et hors de
 * [k1, k2] ne bougent pas. L'accélération des plages absorbées est perdue.
 * Quand k2 est une image clé vide, l'interpolation finit sur les valeurs
 * évaluées à k2 - 1 dans le calque d'origine (pas de saut ni de retour en
 * arrière) : la cible garde ces valeurs puis disparaît à k2.
 * Si [k1, k2 - 1] est déjà exactement une interpolation, la demande est
 * refusée (ALREADY_TWEEN) : rien à créer.
 * Une plage statique d'une seule image est refusée (code ADJACENT_KEYFRAMES) :
 * une interpolation d'une image ne peut pas bouger.
 */

import type { ILayer, ISpan, ITimelineDocument, PropertyRegistry, PropertyTracks } from '@werddomain/timeline-runtime';
import { assertFrame, evaluateValues, replaceLayer, requireEditableLayer } from '../../../model/spans/layerAccess';
import { spanIndexAt, withSpans, withTracks } from '../../../model/spans/tracks';
import { motionTweenRefusal } from './MotionTweenError';

/** Cible d'une création : le calque, l'image de départ et, pour deux images clés, celle d'arrivée. */
export interface IMotionTarget {
  readonly layerId: string;
  /** Image clé de départ (pour une seule plage : n'importe quelle image de la plage). */
  readonly from: number;
  /** Seconde image clé ; absente pour interpoler toute la plage de `from`. */
  readonly to?: number;
}

/** Plage statique contenant `frame` transformée en interpolation. */
export function createMotionTweenFromSpan(doc: ITimelineDocument, layerId: string, frame: number): ITimelineDocument {
  const layer = requireEditableLayer(doc, layerId);
  assertFrame(doc, frame);
  const index = spanIndexAt(layer, frame);
  if (index === -1) throw motionTweenRefusal('NO_KEYFRAME');
  const span = layer.spans[index];
  if (span.kind === 'blank') throw motionTweenRefusal('BLANK_SPAN');
  if (span.kind === 'tween') throw motionTweenRefusal('ALREADY_TWEEN');
  if (span.start === span.end) throw motionTweenRefusal('ADJACENT_KEYFRAMES');
  const tween: ISpan = withTracks({ ...span, kind: 'tween' }, span.tracks);
  return replaceLayer(doc, withSpans(layer, layer.spans.map((candidate, i) => (i === index ? tween : candidate))));
}

/** Index de la plage qui commence à `frame` ; refuse si ce n'est pas une image clé. */
function keyframeIndex(layer: ILayer, frame: number): number {
  const index = layer.spans.findIndex((span) => span.start === frame);
  if (index === -1) throw motionTweenRefusal('NOT_A_KEYFRAME');
  return index;
}

type TrackPoints = Map<string, Map<number, number>>;

function setPoint(points: TrackPoints, name: string, frame: number, value: number): void {
  const track = points.get(name) ?? new Map<number, number>();
  track.set(frame, value);
  points.set(name, track);
}

function setValues(points: TrackPoints, values: Readonly<Record<string, number>>, frame: number): void {
  Object.entries(values).forEach(([name, value]) => setPoint(points, name, frame, value));
}

function toTracks(points: TrackPoints): PropertyTracks | undefined {
  if (points.size === 0) return undefined;
  return Object.fromEntries(
    Array.from(points, ([name, track]) => [
      name,
      Array.from(track, ([frame, value]) => ({ frame, value })).sort((a, b) => a.frame - b.frame)
    ])
  );
}

/** Images clés de départ et d'arrivée de la fusion. */
interface IMergeRange {
  readonly from: number;
  readonly to: number;
  /** Vrai si l'image clé `to` est une image clé vide. */
  readonly endsBlank: boolean;
}

/**
 * Pistes de l'interpolation fusionnée. Ordre d'écriture : images clés des
 * interpolations absorbées, puis valeurs évaluées aux images clés de contenu
 * intermédiaires, à k1 et à k2 - 1 (elles l'emportent sur la même image).
 */
function mergedTracks(
  layer: ILayer,
  absorbed: readonly ISpan[],
  range: IMergeRange,
  registry: PropertyRegistry
): PropertyTracks | undefined {
  const points: TrackPoints = new Map();
  absorbed.forEach((span) => {
    Object.entries(span.tracks ?? {}).forEach(([name, track]) =>
      track.forEach((keyframe) => setPoint(points, name, keyframe.frame, keyframe.value))
    );
  });
  absorbed.slice(1).forEach((span) => setValues(points, evaluateValues(layer, span.start, registry), span.start));
  const startValues = evaluateValues(layer, range.from, registry);
  setValues(points, startValues, range.from);
  const endValues = evaluateValues(layer, range.endsBlank ? range.to - 1 : range.to, registry);
  setValues(points, endValues, range.to - 1);
  return toTracks(points);
}

/** Fusionne les plages de [from, to - 1] en une interpolation (images clés `from` et `to`). */
export function createMotionTweenBetween(
  doc: ITimelineDocument,
  layerId: string,
  from: number,
  to: number,
  registry: PropertyRegistry
): ITimelineDocument {
  const layer = requireEditableLayer(doc, layerId);
  assertFrame(doc, from);
  assertFrame(doc, to);
  if (to <= from) throw motionTweenRefusal('INVALID_RANGE');
  const first = keyframeIndex(layer, from);
  const last = keyframeIndex(layer, to);
  if (to - from < 2) throw motionTweenRefusal('ADJACENT_KEYFRAMES');
  const absorbed = layer.spans.slice(first, last);
  if (absorbed.some((span) => span.kind === 'blank')) throw motionTweenRefusal('BLANK_SPAN');
  if (absorbed.length === 1 && absorbed[0].kind === 'tween') throw motionTweenRefusal('ALREADY_TWEEN');
  const tracks = mergedTracks(layer, absorbed, { from, to, endsBlank: layer.spans[last].kind === 'blank' }, registry);
  const merged: ISpan = withTracks({ id: absorbed[0].id, start: from, end: to - 1, kind: 'tween' }, tracks);
  return replaceLayer(doc, withSpans(layer, [...layer.spans.slice(0, first), merged, ...layer.spans.slice(last)]));
}

/** Crée l'interpolation décrite par `target` (une plage, ou entre deux images clés). */
export function createMotionTween(
  doc: ITimelineDocument,
  target: IMotionTarget,
  registry: PropertyRegistry
): ITimelineDocument {
  return target.to === undefined
    ? createMotionTweenFromSpan(doc, target.layerId, target.from)
    : createMotionTweenBetween(doc, target.layerId, target.from, target.to, registry);
}
