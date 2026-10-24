// packages/editor/src/plugins/frames/clipboard/clipboardOps.ts
/**
 * Collage d'une suite d'images copiées sur un calque (Ctrl+V, comme dans
 * Flash CS4) : fonction pure qui retourne un nouveau document.
 *
 * Le collage écrase les images [at, at + longueur - 1] du calque :
 * - la plage qui contient `at` est raccourcie à `at - 1` (une interpolation
 *   garde ses valeurs : une image clé est posée à `at - 1`) ;
 * - ce qui reste après la dernière image collée devient une nouvelle plage
 *   qui commence juste après, avec les valeurs évaluées là (une
 *   interpolation reste une interpolation et garde ses images clés
 *   suivantes) ; les plages entièrement recouvertes disparaissent ;
 * - les plages collées sont décalées aux images absolues et reçoivent de
 *   nouveaux ids ;
 * - après la dernière image du calque, la dernière plage est d'abord
 *   prolongée jusqu'à `at - 1` (comme F6 sur une zone vide ; un calque vide
 *   reçoit une plage vide de 1 à `at - 1`) ;
 * - `totalFrames` grandit jusqu'à la dernière image collée, si besoin.
 *
 * Les propriétés des plages collées ne sont jamais évaluées : une propriété
 * inconnue du registre est recopiée telle quelle. Un calque (ou un de ses
 * dossiers) verrouillé est refusé (`SpanOperationError`).
 */

import type { ILayer, ISpan, ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
import { SpanOperationCodes, SpanOperationError } from '../../../model/spans/SpanOperationError';
import { createSpanIdFactory, replaceLayer, requireEditableLayer } from '../../../model/spans/layerAccess';
import { lastFrame, shiftSpan, withSpans, withTracks } from '../../../model/spans/tracks';
import { slicePiece } from './spanPieces';
import type { IClipRun, IClipSpan } from './types';

/** Ce que le collage lit d'une suite copiée. */
export type PastedRun = Pick<IClipRun, 'length' | 'spans'>;

function assertPasteRange(at: number, length: number): void {
  if (!Number.isInteger(at) || at < 1) {
    throw new SpanOperationError(
      SpanOperationCodes.INVALID_FRAME,
      `L'image ${String(at)} n'existe pas : le collage commence à l'image 1 au plus tôt.`
    );
  }
  if (!Number.isInteger(length) || length < 1) {
    throw new SpanOperationError(SpanOperationCodes.INVALID_FRAME, 'Il n’y a aucune image à coller.');
  }
}

/** Prolonge la dernière plage jusqu'à `frame` (plage vide 1 à `frame` sur un calque vide). Origine : `frames.ts`. */
function extendTo(layer: ILayer, frame: number, nextId: () => string): ILayer {
  if (layer.spans.length === 0) return withSpans(layer, [{ id: nextId(), start: 1, end: frame, kind: 'blank' }]);
  const last = layer.spans[layer.spans.length - 1];
  return withSpans(layer, [...layer.spans.slice(0, -1), { ...last, end: frame }]);
}

/** Parties de `span` qui survivent au collage de [at, end] (rien, une partie à gauche, à droite, ou les deux). */
function survivors(
  layer: ILayer,
  span: ISpan,
  range: { readonly at: number; readonly end: number },
  nextId: () => string,
  registry: PropertyRegistry
): ISpan[] {
  if (span.end < range.at || span.start > range.end) return [span];
  const left = span.start < range.at ? [slicePiece(layer, span, span.start, range.at - 1, registry)] : [];
  const right =
    span.end > range.end ? [slicePiece(layer, span, range.end + 1, span.end, registry, nextId())] : [];
  return [...left, ...right];
}

/** Plage collée : images relatives devenues absolues, nouvel id, pas de piste sur une plage vide. */
function placedSpan(piece: IClipSpan, at: number, id: string): ISpan {
  const base: ISpan = { id, start: piece.start, end: piece.end, kind: piece.kind };
  if (piece.kind === 'blank') return shiftSpan(base, at - 1);
  const withEasing = piece.easing === undefined ? base : { ...base, easing: piece.easing };
  return shiftSpan(withTracks(withEasing, piece.tracks), at - 1);
}

/** Durée du document portée à `minimum` images si besoin. */
function withTotalFramesAtLeast(doc: ITimelineDocument, minimum: number): ITimelineDocument {
  if (doc.settings.totalFrames >= minimum) return doc;
  return { ...doc, settings: { ...doc.settings, totalFrames: minimum } };
}

/**
 * Colle `run` sur le calque `layerId`, première image du collage à `at`.
 * Les valeurs aux coupes sont évaluées avec `registry` (celui de l'éditeur).
 */
export function pasteSpans(
  doc: ITimelineDocument,
  layerId: string,
  at: number,
  run: PastedRun,
  registry: PropertyRegistry
): ITimelineDocument {
  const original = requireEditableLayer(doc, layerId);
  assertPasteRange(at, run.length);
  const range = { at, end: at + run.length - 1 };
  const nextId = createSpanIdFactory(doc, layerId);
  const layer = lastFrame(original) < at - 1 ? extendTo(original, at - 1, nextId) : original;
  const kept = layer.spans.flatMap((span) => survivors(layer, span, range, nextId, registry));
  const pasted = run.spans.map((piece) => placedSpan(piece, at, nextId()));
  const spans = [
    ...kept.filter((span) => span.end < at),
    ...pasted,
    ...kept.filter((span) => span.start > range.end)
  ];
  return withTotalFramesAtLeast(replaceLayer(doc, withSpans(layer, spans)), range.end);
}
