// packages/editor/src/model/spans/moveKeyframe.ts
/**
 * Déplacement d'une image clé (glisser dans la grille), comme dans Flash
 * CS4. Fonction pure : nouveau document, ou le même s'il n'y a rien à
 * déplacer.
 *
 * - Image clé de contenu (début d'une plage) : la frontière avec la plage
 *   précédente se déplace. La destination doit rester après le début de la
 *   plage précédente et au plus à la fin de la plage déplacée. Les images
 *   clés de propriété des deux plages sont recalées proportionnellement
 *   (une interpolation s'étire ou se contracte, comme dans Flash). Déplacer
 *   la première image clé du calque laisse une plage vide devant elle.
 * - Image clé de propriété dans une interpolation : les images clés de
 *   propriété de l'image `from` vont à `to`, qui doit rester dans la plage ;
 *   elles remplacent celles déjà présentes à `to`.
 * - Toute autre image : rien à déplacer.
 */

import type { ILayer, IPropertyKeyframe, ISpan, ITimelineDocument } from '@werddomain/timeline-runtime';
import { assertFrame, createSpanIdFactory, replaceLayer, requireEditableLayer } from './layerAccess';
import { SpanOperationCodes, SpanOperationError } from './SpanOperationError';
import { retimeKeyframes, spanIndexAt, withSpans, withTracks } from './tracks';

function assertWithin(to: number, min: number, max: number): void {
  if (to < min || to > max) {
    throw new SpanOperationError(
      SpanOperationCodes.OUT_OF_RANGE,
      `L'image clé doit rester entre les images ${min} et ${max}.`
    );
  }
}

/** Plage redimensionnée à [start, end], images clés recalées. */
function resize(span: ISpan, start: number, end: number): ISpan {
  const tracks = retimeKeyframes(span.tracks, span, { start, end });
  return withTracks({ ...span, start, end }, tracks);
}

/** Déplace le début de la plage `index` à `to`. */
function moveSpanStart(doc: ITimelineDocument, layer: ILayer, index: number, to: number): ILayer {
  const span = layer.spans[index];
  if (index === 0) {
    assertWithin(to, 1, span.end);
    const blank: ISpan = { id: createSpanIdFactory(doc, layer.id)(), start: 1, end: to - 1, kind: 'blank' };
    return withSpans(layer, [blank, resize(span, to, span.end), ...layer.spans.slice(1)]);
  }
  const previous = layer.spans[index - 1];
  assertWithin(to, previous.start + 1, span.end);
  const spans = layer.spans.map((candidate, i) => {
    if (i === index - 1) return resize(previous, previous.start, to - 1);
    return i === index ? resize(span, to, span.end) : candidate;
  });
  return withSpans(layer, spans);
}

/** Déplace les images clés de propriété de `from` à `to` dans l'interpolation `index`. */
function movePropertyKeyframes(layer: ILayer, index: number, from: number, to: number): ILayer {
  const span = layer.spans[index];
  const hasKeyframe = Object.values(span.tracks ?? {}).some((track) => track.some((keyframe) => keyframe.frame === from));
  if (!hasKeyframe) return layer;
  assertWithin(to, span.start, span.end);
  const tracks: Record<string, readonly IPropertyKeyframe[]> = {};
  Object.entries(span.tracks ?? {}).forEach(([name, track]) => {
    const moved = track.find((keyframe) => keyframe.frame === from);
    if (moved === undefined) {
      tracks[name] = track;
      return;
    }
    // L'image clé déplacée remplace celle déjà présente à `to`.
    const others = track.filter((keyframe) => keyframe.frame !== from && keyframe.frame !== to);
    tracks[name] = [...others, { ...moved, frame: to }].sort((a, b) => a.frame - b.frame);
  });
  return withSpans(layer, layer.spans.map((candidate, i) => (i === index ? withTracks(span, tracks) : candidate)));
}

/** Déplace l'image clé de `from` à `to` sur le calque `layerId`. */
export function moveKeyframe(doc: ITimelineDocument, layerId: string, from: number, to: number): ITimelineDocument {
  const layer = requireEditableLayer(doc, layerId);
  assertFrame(doc, from);
  assertFrame(doc, to);
  const index = spanIndexAt(layer, from);
  if (from === to || index === -1) return doc;
  const span = layer.spans[index];
  if (span.start === from) return replaceLayer(doc, moveSpanStart(doc, layer, index, to));
  if (span.kind !== 'tween') return doc;
  return replaceLayer(doc, movePropertyKeyframes(layer, index, from, to));
}
