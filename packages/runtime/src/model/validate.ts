// packages/runtime/src/model/validate.ts
/**
 * Vérification des invariants sémantiques qu'un schéma JSON ne sait pas
 * exprimer (ids uniques, plages contiguës, images clés dans leur plage...).
 * Le document est supposé déjà conforme au schéma ; les noms de propriétés
 * ne sont pas vérifiés ici (c'est le rôle du registre de propriétés).
 */

import type { ITimelineDocument } from './document';
import { parseEasing } from './easing';
import { isLayer } from './guards';
import type { ILayer } from './layer';
import type { IPropertyKeyframe, ISpan } from './span';
import { walkLayers } from './traverse';

/** Issue codes, one per invariant. */
export const ValidationCodes = {
  /** An id is used by more than one layer, folder or span. */
  DUPLICATE_ID: 'duplicate-id',
  /** `span.end < span.start`. */
  SPAN_INVALID_RANGE: 'span-invalid-range',
  /** A span starts before the previous one. */
  SPANS_UNSORTED: 'spans-unsorted',
  /** Gap or overlap between two consecutive spans (`next.start !== prev.end + 1`). */
  SPANS_NOT_CONTIGUOUS: 'spans-not-contiguous',
  /** The first span of a layer does not start at frame 1. */
  FIRST_SPAN_NOT_AT_FRAME_1: 'first-span-not-at-frame-1',
  /** A span ends after `settings.totalFrames`. */
  SPAN_EXCEEDS_TOTAL_FRAMES: 'span-exceeds-total-frames',
  /** A property keyframe lies outside its span [start, end]. */
  KEYFRAME_OUT_OF_SPAN: 'keyframe-out-of-span',
  /** Keyframe frames of a track are not strictly increasing (or duplicated). */
  KEYFRAMES_NOT_INCREASING: 'keyframes-not-increasing',
  /** A keyframe of a static span is not at `span.start`. */
  STATIC_KEYFRAME_NOT_AT_START: 'static-keyframe-not-at-start',
  /** A blank span has tracks. */
  TRACKS_NOT_ALLOWED: 'tracks-not-allowed',
  /** A non-tween span has an easing. */
  EASING_NOT_ALLOWED: 'easing-not-allowed',
  /** The easing string does not parse (see `parseEasing`). */
  INVALID_EASING: 'invalid-easing',
  /** A property value is NaN or infinite. */
  NON_FINITE_VALUE: 'non-finite-value'
} as const;

export type ValidationCode = (typeof ValidationCodes)[keyof typeof ValidationCodes];

/** One broken invariant. */
export interface IValidationIssue {
  /** JSON-pointer-like path of the faulty value, e.g. `/layers/0/spans/1/start`. */
  readonly path: string;
  readonly code: ValidationCode;
  readonly message: string;
}

interface IValidationContext {
  readonly totalFrames: number;
  readonly issues: IValidationIssue[];
  /** id → path of its first use. */
  readonly seenIds: Map<string, string>;
}

function report(ctx: IValidationContext, path: string, code: ValidationCode, message: string): void {
  ctx.issues.push({ path, code, message });
}

function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function checkUniqueId(ctx: IValidationContext, id: string, path: string): void {
  const firstPath = ctx.seenIds.get(id);
  if (firstPath === undefined) {
    ctx.seenIds.set(id, path);
    return;
  }
  report(ctx, path, ValidationCodes.DUPLICATE_ID, `Id "${id}" is already used at ${firstPath}.`);
}

function checkSpanSequence(ctx: IValidationContext, spans: readonly ISpan[], spansPath: string): void {
  spans.forEach((span, index) => {
    const startPath = `${spansPath}/${index}/start`;
    if (index === 0) {
      if (span.start !== 1) {
        report(ctx, startPath, ValidationCodes.FIRST_SPAN_NOT_AT_FRAME_1,
          `First span starts at frame ${span.start}; use a "blank" span to cover frames before it.`);
      }
      return;
    }
    const prev = spans[index - 1];
    if (span.start < prev.start) {
      report(ctx, startPath, ValidationCodes.SPANS_UNSORTED,
        `Span starts at frame ${span.start}, before the previous span (frame ${prev.start}).`);
    } else if (span.start !== prev.end + 1) {
      const kind = span.start > prev.end + 1 ? 'gap' : 'overlap';
      report(ctx, startPath, ValidationCodes.SPANS_NOT_CONTIGUOUS,
        `Span must start at frame ${prev.end + 1} (${kind} after the previous span).`);
    }
  });
}

function checkKeyframe(ctx: IValidationContext, span: ISpan, keyframe: IPropertyKeyframe, path: string): void {
  if (keyframe.frame < span.start || keyframe.frame > span.end) {
    report(ctx, `${path}/frame`, ValidationCodes.KEYFRAME_OUT_OF_SPAN,
      `Keyframe at frame ${keyframe.frame} is outside its span [${span.start}, ${span.end}].`);
  } else if (span.kind === 'static' && keyframe.frame !== span.start) {
    report(ctx, `${path}/frame`, ValidationCodes.STATIC_KEYFRAME_NOT_AT_START,
      `Keyframes of a static span must be at frame ${span.start}.`);
  }
  if (!Number.isFinite(keyframe.value)) {
    report(ctx, `${path}/value`, ValidationCodes.NON_FINITE_VALUE, `Value ${keyframe.value} is not a finite number.`);
  }
}

function checkTrack(ctx: IValidationContext, span: ISpan, track: readonly IPropertyKeyframe[], trackPath: string): void {
  track.forEach((keyframe, index) => {
    const path = `${trackPath}/${index}`;
    checkKeyframe(ctx, span, keyframe, path);
    if (index > 0 && keyframe.frame <= track[index - 1].frame) {
      report(ctx, `${path}/frame`, ValidationCodes.KEYFRAMES_NOT_INCREASING,
        `Keyframe at frame ${keyframe.frame} must come after frame ${track[index - 1].frame}.`);
    }
  });
}

function checkSpanContent(ctx: IValidationContext, span: ISpan, path: string): void {
  if (span.easing !== undefined) {
    if (span.kind !== 'tween') {
      report(ctx, `${path}/easing`, ValidationCodes.EASING_NOT_ALLOWED, `A "${span.kind}" span cannot have an easing.`);
    } else if (parseEasing(span.easing) === null) {
      report(ctx, `${path}/easing`, ValidationCodes.INVALID_EASING, `Easing "${span.easing}" is not valid.`);
    }
  }
  if (span.tracks === undefined) {
    return;
  }
  if (span.kind === 'blank') {
    report(ctx, `${path}/tracks`, ValidationCodes.TRACKS_NOT_ALLOWED, 'A "blank" span cannot have tracks.');
    return;
  }
  for (const [property, track] of Object.entries(span.tracks)) {
    checkTrack(ctx, span, track, `${path}/tracks/${escapePointerToken(property)}`);
  }
}

function checkSpan(ctx: IValidationContext, span: ISpan, path: string): void {
  checkUniqueId(ctx, span.id, `${path}/id`);
  if (span.end < span.start) {
    report(ctx, `${path}/end`, ValidationCodes.SPAN_INVALID_RANGE,
      `Span ends at frame ${span.end}, before its start (frame ${span.start}).`);
  }
  if (span.end > ctx.totalFrames) {
    report(ctx, `${path}/end`, ValidationCodes.SPAN_EXCEEDS_TOTAL_FRAMES,
      `Span ends at frame ${span.end}, after the last frame (${ctx.totalFrames}).`);
  }
  checkSpanContent(ctx, span, path);
}

function checkLayer(ctx: IValidationContext, layer: ILayer, pointer: string): void {
  const spansPath = `${pointer}/spans`;
  checkSpanSequence(ctx, layer.spans, spansPath);
  layer.spans.forEach((span, index) => checkSpan(ctx, span, `${spansPath}/${index}`));
}

/**
 * Returns every semantic issue of a schema-valid document (empty when the
 * document is consistent). Paths are JSON-pointer-like, from the root.
 */
export function validateDocument(doc: ITimelineDocument): IValidationIssue[] {
  const ctx: IValidationContext = { totalFrames: doc.settings.totalFrames, issues: [], seenIds: new Map() };
  walkLayers(doc.layers, ({ node, pointer }) => {
    checkUniqueId(ctx, node.id, `${pointer}/id`);
    if (isLayer(node)) {
      checkLayer(ctx, node, pointer);
    }
  });
  return ctx.issues;
}
