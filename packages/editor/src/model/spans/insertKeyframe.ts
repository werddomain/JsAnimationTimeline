// packages/editor/src/model/spans/insertKeyframe.ts
/**
 * Insertion d'une image clé (F6) ou d'une image clé vide (F7), comme dans
 * Flash CS4. Fonctions pures : elles retournent un nouveau document, ou le
 * même s'il n'y a rien à faire (l'image est déjà une image clé).
 *
 * Image clé (F6) à l'image N :
 * - dans une plage `static` : la plage est coupée en deux ; la seconde
 *   commence à N avec les valeurs évaluées à N ;
 * - dans une plage `blank` : la plage est coupée, la seconde reste vide ;
 * - dans une plage `tween` : la plage n'est pas coupée ; une image clé de
 *   propriété est ajoutée à N pour chaque propriété du calque, avec la valeur
 *   interpolée (accélération comprise) par l'évaluation du runtime ;
 * - après la dernière plage : la dernière plage est prolongée jusqu'à N - 1
 *   et une plage d'une image commence à N (vide si la précédente l'est) ;
 *   sur un calque sans plage, une plage vide couvre 1 à N - 1.
 *
 * Image clé vide (F7) à l'image N : la plage qui contient N est coupée et
 * la seconde partie devient `blank`. Une interpolation coupée garde ses
 * images clés jusqu'à N - 1 et reçoit à N - 1 les valeurs évaluées, pour
 * que l'animation finisse là où elle en était.
 *
 * Sur une image qui est déjà une image clé (début d'une plage), F6 et F7 ne
 * changent rien.
 *
 * Les valeurs sont calculées avec le registre de propriétés reçu (celui de
 * l'éditeur), jamais avec le registre par défaut.
 *
 * Limite connue : l'accélération s'applique à toute la plage. Dans une
 * interpolation accélérée, la valeur posée à N est exacte à l'insertion,
 * mais les images voisines sont relues à leur position accélérée : la
 * courbe change un peu (exact avec `linear`).
 */

import type {
  ILayer,
  IPropertyKeyframe,
  ISpan,
  ITimelineDocument,
  PropertyRegistry,
  PropertyTracks
} from '@werddomain/timeline-runtime';
import { assertFrame, createSpanIdFactory, evaluateValues, replaceLayer, requireEditableLayer } from './layerAccess';
import { lastFrame, mapKeyframes, spanIndexAt, tracksFromValues, withSpans, withTracks } from './tracks';

/** Contenu de la nouvelle image clé : celui de la plage précédente (F6) ou vide (F7). */
type KeyframeContent = 'content' | 'blank';

function newSpan(id: string, start: number, end: number, tracks: PropertyTracks | undefined, kind: ISpan['kind']): ISpan {
  return withTracks({ id, start, end, kind }, kind === 'blank' ? undefined : tracks);
}

/** Image clé après la dernière plage (ou sur un calque vide). */
function appendKeyframe(
  doc: ITimelineDocument,
  layer: ILayer,
  frame: number,
  content: KeyframeContent,
  registry: PropertyRegistry
): ILayer {
  const nextId = createSpanIdFactory(doc, layer.id);
  const previous = layer.spans.length === 0 ? undefined : layer.spans[layer.spans.length - 1];
  const kind = appendedKind(content, previous);
  const tracks = kind === 'blank' ? undefined : tracksFromValues(evaluateValues(layer, frame, registry), frame);
  const head = previous === undefined ? leadingBlank(frame, nextId) : [...layer.spans.slice(0, -1), { ...previous, end: frame - 1 }];
  return withSpans(layer, [...head, newSpan(nextId(), frame, frame, tracks, kind)]);
}

/**
 * Nature d'une image clé ajoutée après la dernière plage : vide pour F7 ou
 * après une plage vide, sinon `static` (un calque vide reçoit son contenu).
 */
function appendedKind(content: KeyframeContent, previous: ISpan | undefined): ISpan['kind'] {
  if (content === 'blank') return 'blank';
  return previous?.kind === 'blank' ? 'blank' : 'static';
}

/** Plage vide 1 à `frame - 1` devant la première image clé d'un calque vide. */
function leadingBlank(frame: number, nextId: () => string): readonly ISpan[] {
  return frame > 1 ? [newSpan(nextId(), 1, frame - 1, undefined, 'blank')] : [];
}

/** Coupe la plage `index` à `frame` ; la seconde partie est `second`. */
function splitSpan(layer: ILayer, index: number, frame: number, first: ISpan, second: ISpan): ILayer {
  const spans = layer.spans;
  return withSpans(layer, [...spans.slice(0, index), first, second, ...spans.slice(index + 1)]);
}

/** Première partie d'une plage coupée à `frame` : images clés jusqu'à `frame - 1`. */
function truncateBefore(span: ISpan, frame: number): ISpan {
  const truncated: ISpan = { ...span, end: frame - 1 };
  return withTracks(truncated, mapKeyframes(span.tracks, (keyframe) => (keyframe.frame < frame ? keyframe : undefined)));
}

/** Interpolation arrêtée à `frame - 1`, avec les valeurs évaluées à cette image. */
function truncateTween(layer: ILayer, span: ISpan, frame: number, registry: PropertyRegistry): ISpan {
  const truncated = truncateBefore(span, frame);
  const endFrame = frame - 1;
  const values = evaluateValues(layer, endFrame, registry);
  const tracks: Record<string, readonly IPropertyKeyframe[]> = { ...truncated.tracks };
  Object.keys(span.tracks ?? {}).forEach((name) => {
    const kept = tracks[name] ?? [];
    if (kept.length > 0 && kept[kept.length - 1].frame === endFrame) return;
    tracks[name] = [...kept, { frame: endFrame, value: values[name] }];
  });
  return withTracks(truncated, Object.keys(tracks).length > 0 ? tracks : undefined);
}

/** Image clé de propriété à `frame` dans l'interpolation `index` (même calque si rien à ajouter). */
function addTweenKeyframes(layer: ILayer, index: number, frame: number, registry: PropertyRegistry): ILayer {
  const span = layer.spans[index];
  const values = evaluateValues(layer, frame, registry);
  const tracks: Record<string, readonly IPropertyKeyframe[]> = { ...span.tracks };
  let changed = false;
  Object.entries(values).forEach(([name, value]) => {
    const track = tracks[name] ?? [];
    if (track.some((keyframe) => keyframe.frame === frame)) return;
    tracks[name] = [...track, { frame, value }].sort((a, b) => a.frame - b.frame);
    changed = true;
  });
  if (!changed) return layer;
  const spans = layer.spans.map((candidate, i) => (i === index ? withTracks(span, tracks) : candidate));
  return withSpans(layer, spans);
}

function insertAt(
  doc: ITimelineDocument,
  layerId: string,
  frame: number,
  content: KeyframeContent,
  registry: PropertyRegistry
): ITimelineDocument {
  const layer = requireEditableLayer(doc, layerId);
  assertFrame(doc, frame);
  if (frame > lastFrame(layer)) {
    return replaceLayer(doc, appendKeyframe(doc, layer, frame, content, registry));
  }
  const index = spanIndexAt(layer, frame);
  const span = layer.spans[index];
  if (span.start === frame) return doc;
  if (content === 'content' && span.kind === 'tween') {
    return replaceLayer(doc, addTweenKeyframes(layer, index, frame, registry));
  }
  const id = createSpanIdFactory(doc, layer.id)();
  const first = span.kind === 'tween' ? truncateTween(layer, span, frame, registry) : truncateBefore(span, frame);
  const secondKind = content === 'blank' || span.kind === 'blank' ? 'blank' : 'static';
  const secondTracks = secondKind === 'blank' ? undefined : tracksFromValues(evaluateValues(layer, frame, registry), frame);
  return replaceLayer(doc, splitSpan(layer, index, frame, first, newSpan(id, frame, span.end, secondTracks, secondKind)));
}

/** Insère une image clé (F6) à `frame` sur le calque `layerId`. */
export function insertKeyframe(
  doc: ITimelineDocument,
  layerId: string,
  frame: number,
  registry: PropertyRegistry
): ITimelineDocument {
  return insertAt(doc, layerId, frame, 'content', registry);
}

/** Insère une image clé vide (F7) à `frame` sur le calque `layerId`. */
export function insertBlankKeyframe(
  doc: ITimelineDocument,
  layerId: string,
  frame: number,
  registry: PropertyRegistry
): ITimelineDocument {
  return insertAt(doc, layerId, frame, 'blank', registry);
}
