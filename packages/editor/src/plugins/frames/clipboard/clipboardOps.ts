// packages/editor/src/plugins/frames/clipboard/clipboardOps.ts
/**
 * Pure CS4-style frame paste: replace the selected range, split boundary spans,
 * assign new span ids, and extend the document only when needed.
 *
 * Known rendered properties after the pasted range keep their original values.
 * The first following non-blank span pins only carried values that differ after
 * the replacement, considering both original and pasted track names. Unknown
 * properties do not refuse a paste and are never assigned invented edge values.
 *
 * Cut segments retain exact interior values only with linear easing and
 * linear property interpolation, as with F6. Pinning a registry default can override an element's own
 * CSS (for example opacity 1 over an underlying opacity 0.5).
 * Locked layers and folders refuse the whole paste.
 */

import type { ILayer, ISpan, ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
import { SpanOperationCodes, SpanOperationError } from '../../../model/spans/SpanOperationError';
import { createSpanIdFactory, replaceLayer, requireEditableLayer } from '../../../model/spans/layerAccess';
import { lastFrame, shiftSpan, withSpans, withTracks } from '../../../model/spans/tracks';
import { evaluatePasteValues, slicePiece } from './spanPieces';
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

/**
 * Prolonge le calque jusqu'à `frame` (plage vide 1 à `frame` sur un calque
 * vide). Origine : `frames.ts`. Une dernière plage fixe ou vide est
 * prolongée ; une interpolation ne l'est pas (son accélération s'étirerait
 * et changerait ses images existantes) : une plage fixe sans piste la suit,
 * qui garde les valeurs de fin de l'interpolation.
 */
function extendTo(layer: ILayer, frame: number, nextId: () => string): ILayer {
  if (layer.spans.length === 0) return withSpans(layer, [{ id: nextId(), start: 1, end: frame, kind: 'blank' }]);
  const last = layer.spans[layer.spans.length - 1];
  if (last.kind === 'tween') {
    return withSpans(layer, [...layer.spans, { id: nextId(), start: last.end + 1, end: frame, kind: 'static' }]);
  }
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
  const options = { unknownProperties: 'skip' as const };
  const left = span.start < range.at ? [slicePiece(layer, span, span.start, range.at - 1, registry, options)] : [];
  const right =
    span.end > range.end ? [slicePiece(layer, span, range.end + 1, span.end, registry, { ...options, id: nextId() })] : [];
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

/** Property names used by a sequence of spans. */
function trackNames(pasted: readonly ISpan[]): ReadonlySet<string> {
  const names = new Set<string>();
  pasted.forEach((span) => Object.keys(span.tracks ?? {}).forEach((name) => names.add(name)));
  return names;
}

/** Restores only changed known carry values at the first following non-blank span. */
function pinAfterPaste(
  original: ILayer,
  candidate: ILayer,
  after: readonly ISpan[],
  names: ReadonlySet<string>,
  registry: PropertyRegistry
): ISpan[] {
  const index = after.findIndex((span) => span.kind !== 'blank');
  const target = after[index];
  if (target === undefined) return [...after];
  const tracks = new Map(Object.entries(target.tracks ?? {}));
  const missing = [...names].filter((name) => !(tracks.get(name) ?? []).some((key) => key.frame === target.start));
  if (missing.length === 0) return [...after];
  const values = new Map(Object.entries(evaluatePasteValues(original, target.start, registry)));
  const candidateValues = new Map(Object.entries(evaluatePasteValues(candidate, target.start, registry)));
  let changed = false;
  missing.forEach((name) => {
    const value = values.get(name) ?? registry.get(name)?.defaultValue;
    const current = candidateValues.get(name) ?? registry.get(name)?.defaultValue;
    // Unknown properties have no invented value; unchanged carry needs no key.
    if (value === undefined || value === current) return;
    tracks.set(name, [{ frame: target.start, value }, ...(tracks.get(name) ?? [])]);
    changed = true;
  });
  if (!changed) return [...after];
  const pinned = withTracks(target, Object.fromEntries(tracks));
  return after.map((span, position) => (position === index ? pinned : span));
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
  const before = kept.filter((span) => span.end < at);
  const following = kept.filter((span) => span.start > range.end);
  const candidate = withSpans(layer, [...before, ...pasted, ...following]);
  const names = new Set([...trackNames(original.spans), ...trackNames(pasted)]);
  const after = pinAfterPaste(layer, candidate, following, names, registry);
  const spans = [...before, ...pasted, ...after];
  return withTotalFramesAtLeast(replaceLayer(doc, withSpans(layer, spans)), range.end);
}
