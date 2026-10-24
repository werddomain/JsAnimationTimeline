// packages/editor/src/model/spans/deleteKeyframe.ts
/**
 * Suppression d'une image clé (Maj+F6, « Effacer l'image clé » de Flash
 * CS4). Fonction pure : nouveau document, ou le même s'il n'y a rien à
 * supprimer.
 *
 * - Image clé de contenu (début d'une plage autre que la première) : la
 *   plage est fusionnée dans la précédente, qui s'étend jusqu'à sa fin ; ses
 *   pistes sont abandonnées. Une interpolation prolongée garde ses images
 *   clés et tient la dernière valeur jusqu'à la nouvelle fin.
 * - Image clé de propriété dans une interpolation : les images clés de
 *   propriété de cette image sont retirées (les pistes vides disparaissent).
 * - La première image clé du calque ne peut pas être effacée (comme dans
 *   Flash) : le document reste inchangé.
 */

import type { ILayer, ITimelineDocument } from '@werddomain/timeline-runtime';
import { assertFrame, replaceLayer, requireEditableLayer } from './layerAccess';
import { mapKeyframes, spanIndexAt, withSpans, withTracks } from './tracks';

/** Fusionne la plage `index` dans la précédente. */
function mergeIntoPrevious(layer: ILayer, index: number): ILayer {
  const previous = layer.spans[index - 1];
  const merged = { ...previous, end: layer.spans[index].end };
  return withSpans(layer, [...layer.spans.slice(0, index - 1), merged, ...layer.spans.slice(index + 1)]);
}

/** Retire les images clés de propriété à `frame` dans la plage `index` (même calque si aucune). */
function removePropertyKeyframes(layer: ILayer, index: number, frame: number): ILayer {
  const span = layer.spans[index];
  const hasKeyframe = Object.values(span.tracks ?? {}).some((track) => track.some((keyframe) => keyframe.frame === frame));
  if (!hasKeyframe) return layer;
  const tracks = mapKeyframes(span.tracks, (keyframe) => (keyframe.frame === frame ? undefined : keyframe));
  return withSpans(layer, layer.spans.map((candidate, i) => (i === index ? withTracks(span, tracks) : candidate)));
}

/** Efface l'image clé à `frame` sur le calque `layerId`. */
export function deleteKeyframe(doc: ITimelineDocument, layerId: string, frame: number): ITimelineDocument {
  const layer = requireEditableLayer(doc, layerId);
  assertFrame(doc, frame);
  const index = spanIndexAt(layer, frame);
  if (index === -1) return doc;
  const span = layer.spans[index];
  if (span.start === frame) {
    return index === 0 ? doc : replaceLayer(doc, mergeIntoPrevious(layer, index));
  }
  if (span.kind !== 'tween') return doc;
  return replaceLayer(doc, removePropertyKeyframes(layer, index, frame));
}
