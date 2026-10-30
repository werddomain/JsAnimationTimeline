// packages/editor/src/plugins/tweens/motion/removeMotionTween.ts
/**
 * Suppression d'une interpolation de mouvement (Flash CS4). Fonctions pures :
 * nouveau document, ou refus (`MotionTweenError`, `SpanOperationError`).
 *
 * La plage [s, e] redevient statique, avec le même id : son accélération et
 * ses images clés de propriété sont abandonnées. Chaque propriété qu'elle
 * animait garde la valeur évaluée à s (posée à l'image s) ; les propriétés
 * qu'elle n'animait pas ne sont pas touchées. Toutes les valeurs sont lues
 * dans le calque d'origine, même quand plusieurs interpolations d'un même
 * calque sont supprimées d'un coup.
 *
 * Effet de bord : une plage suivante sans piste pour une propriété hérite de
 * la valeur de fin de l'interpolation ; une fois celle-ci supprimée, elle
 * hérite de la valeur de début. Les plages créées par les opérations de plage
 * posent des pistes explicites, donc ce cas ne concerne que des documents
 * écrits à la main.
 */

import type { ILayer, ISpan, ITimelineDocument, PropertyRegistry } from '@kazo-ca/timeline-runtime';
import { assertFrame, evaluateValues, replaceLayer, requireEditableLegacyLayer } from '../../../model/spans/layerAccess';
import { spanIndexAt, withSpans, withTracks } from '../../../model/spans/tracks';
import { motionTweenRefusal } from './MotionTweenError';

/** Interpolations à supprimer sur un calque : une image de chacune. */
export interface IRemoveTarget {
  readonly layerId: string;
  readonly frames: readonly number[];
}

/** Plage statique équivalente à l'interpolation `span`. */
function toStatic(layer: ILayer, span: ISpan, registry: PropertyRegistry): ISpan {
  const names = Object.keys(span.tracks ?? {});
  const base: ISpan = { id: span.id, start: span.start, end: span.end, kind: 'static' };
  if (names.length === 0) return base;
  const values = evaluateValues(layer, span.start, registry);
  const entries = names.flatMap((name) =>
    Number.isFinite(values[name]) ? [[name, [{ frame: span.start, value: values[name] }]] as const] : []
  );
  return withTracks(base, entries.length === 0 ? undefined : Object.fromEntries(entries));
}

/** Supprime les interpolations qui contiennent `frames` sur le calque `layerId`. */
export function removeMotionTweens(
  doc: ITimelineDocument,
  layerId: string,
  frames: readonly number[],
  registry: PropertyRegistry
): ITimelineDocument {
  const layer = requireEditableLegacyLayer(doc, layerId);
  frames.forEach((frame) => assertFrame(doc, frame));
  const indexes = new Set(frames.map((frame) => spanIndexAt(layer, frame)));
  const allTweens = Array.from(indexes).every((index) => index !== -1 && layer.spans[index].kind === 'tween');
  if (indexes.size === 0 || !allTweens) throw motionTweenRefusal('NO_TWEEN');
  const spans = layer.spans.map((span, index) => (indexes.has(index) ? toStatic(layer, span, registry) : span));
  return replaceLayer(doc, withSpans(layer, spans));
}

/** Supprime l'interpolation qui contient `frame` sur le calque `layerId`. */
export function removeMotionTween(
  doc: ITimelineDocument,
  layerId: string,
  frame: number,
  registry: PropertyRegistry
): ITimelineDocument {
  return removeMotionTweens(doc, layerId, [frame], registry);
}
