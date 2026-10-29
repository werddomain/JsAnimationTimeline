// packages/editor/src/model/spans/frames.ts
/**
 * Insertion (F5) et suppression (Maj+F5) d'une image, comme dans Flash CS4.
 * Fonctions pures : nouveau document, ou le même s'il n'y a rien à faire.
 *
 * Insérer une image à N :
 * - dans une plage : la plage s'allonge d'une image ; les images clés
 *   (de plage et de propriété) situées après N reculent d'une image. Si le
 *   calque dépasse alors `totalFrames`, la durée du document grandit d'une
 *   image ;
 * - après la dernière plage : la dernière plage est prolongée jusqu'à N
 *   (sur un calque vide, une plage vide couvre 1 à N).
 *
 * Supprimer l'image N :
 * - une plage d'une seule image disparaît (avec son image clé) ;
 * - sinon la plage raccourcit d'une image : les images clés de propriété à
 *   N sont retirées et celles d'après avancent d'une image. Sur l'image clé
 *   de début, c'est l'image suivante qui est retirée, pour garder le début ;
 * - les plages suivantes avancent d'une image ; `totalFrames` ne change pas ;
 * - après la dernière plage : rien à faire.
 */

import type { ILayer, ISpan, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { assertFrame, createSpanIdFactory, replaceLayer, requireEditableLayer } from './layerAccess';
import { lastFrame, mapKeyframes, shiftKeyframesAfter, shiftSpan, spanIndexAt, withSpans, withTracks } from './tracks';

/** Prolonge la dernière plage jusqu'à `frame` (plage vide 1 à `frame` sur un calque vide). */
function extendTo(doc: ITimelineDocument, layer: ILayer, frame: number): ILayer {
  if (layer.spans.length === 0) {
    const id = createSpanIdFactory(doc, layer.id)();
    return withSpans(layer, [{ id, start: 1, end: frame, kind: 'blank' }]);
  }
  const last = layer.spans[layer.spans.length - 1];
  return withSpans(layer, [...layer.spans.slice(0, -1), { ...last, end: frame }]);
}

/** Durée du document portée à `minimum` images si besoin. */
function withTotalFramesAtLeast(doc: ITimelineDocument, minimum: number): ITimelineDocument {
  if (doc.settings.totalFrames >= minimum) return doc;
  return { ...doc, settings: { ...doc.settings, totalFrames: minimum } };
}

/** Plages `index` et suivantes : `span` remplace la plage `index`, les suivantes sont décalées de `delta`. */
function rebuildFrom(layer: ILayer, index: number, span: ISpan | undefined, delta: number): ILayer {
  const following = layer.spans.slice(index + 1).map((candidate) => shiftSpan(candidate, delta));
  const replaced = span === undefined ? [] : [span];
  return withSpans(layer, [...layer.spans.slice(0, index), ...replaced, ...following]);
}

/** Insère une image à `frame` sur le calque `layerId`. */
export function insertFrame(doc: ITimelineDocument, layerId: string, frame: number): ITimelineDocument {
  const layer = requireEditableLayer(doc, layerId);
  assertFrame(doc, frame);
  if (frame > lastFrame(layer)) {
    return replaceLayer(doc, extendTo(doc, layer, frame));
  }
  const index = spanIndexAt(layer, frame);
  const span = layer.spans[index];
  const grown = withTracks({ ...span, end: span.end + 1 }, shiftKeyframesAfter(span.tracks, frame, 1));
  const next = rebuildFrom(layer, index, grown, 1);
  return withTotalFramesAtLeast(replaceLayer(doc, next), lastFrame(next));
}

/** Supprime l'image `frame` du calque `layerId`. */
export function removeFrame(doc: ITimelineDocument, layerId: string, frame: number): ITimelineDocument {
  const layer = requireEditableLayer(doc, layerId);
  assertFrame(doc, frame);
  if (frame > lastFrame(layer)) return doc;
  const index = spanIndexAt(layer, frame);
  const span = layer.spans[index];
  if (span.start === span.end) {
    return replaceLayer(doc, rebuildFrom(layer, index, undefined, -1));
  }
  const removed = frame === span.start ? frame + 1 : frame;
  const tracks = mapKeyframes(span.tracks, (keyframe) => {
    if (keyframe.frame === removed) return undefined;
    return keyframe.frame > removed ? { ...keyframe, frame: keyframe.frame - 1 } : keyframe;
  });
  const shrunk = withTracks({ ...span, end: span.end - 1 }, tracks);
  return replaceLayer(doc, rebuildFrom(layer, index, shrunk, -1));
}
