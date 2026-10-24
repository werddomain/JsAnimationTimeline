// packages/runtime/src/model/validate.ts
/**
 * Validation d'un document : contrôle de forme (voir `shape.ts`), puis
 * invariants sémantiques qu'un schéma JSON ne sait pas exprimer (ids
 * uniques, plages contiguës, images clés dans leur plage...). Les noms de
 * propriétés suivent la règle commune, mais ne sont pas cherchés dans le
 * registre ici (c'est le rôle du registre de propriétés).
 */

import type { ITimelineDocument } from './document';
import { parseEasing } from './easing';
import { isLayer } from './guards';
import type { ILayer } from './layer';
import type { IPropertyKeyframe, ISpan } from './span';
import { escapePointerToken, ValidationCodes } from './issues';
import type { IValidationIssue, ValidationCode } from './issues';
import { checkDocumentShape } from './shape';
import type { IShapeOptions } from './shape';
import { walkLayers } from './traverse';

export { ValidationCodes } from './issues';
export type { IValidationIssue, ValidationCode } from './issues';

/** Options of `validateDocument`. */
export type IValidateOptions = IShapeOptions;

interface IValidationContext {
  readonly totalFrames: number;
  readonly issues: IValidationIssue[];
  /** id → path of its first use. */
  readonly seenIds: Map<string, string>;
}

function report(ctx: IValidationContext, path: string, code: ValidationCode, message: string): void {
  ctx.issues.push({ path, code, message });
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

/** Runs the shape check; `true` (and no issue added) when `doc` has the document form. */
function hasDocumentShape(doc: unknown, issues: IValidationIssue[], options: IValidateOptions): doc is ITimelineDocument {
  issues.push(...checkDocumentShape(doc, options));
  return issues.length === 0;
}

/**
 * Returns every issue of `doc` (empty when the document is valid). `doc` may
 * be any value, e.g. a parsed JSON file: the shape check runs first (what the
 * JSON schema describes, see `checkDocumentShape`); only a well-formed
 * document then gets its semantic invariants checked. Paths are
 * JSON-pointer-like, from the root. `{ element }` targets pass unless
 * `allowLiveTargets` is `false`.
 */
export function validateDocument(doc: unknown, options: IValidateOptions = {}): IValidationIssue[] {
  const issues: IValidationIssue[] = [];
  if (!hasDocumentShape(doc, issues, options)) {
    return issues;
  }
  const ctx: IValidationContext = { totalFrames: doc.settings.totalFrames, issues, seenIds: new Map() };
  walkLayers(doc.layers, ({ node, pointer }) => {
    checkUniqueId(ctx, node.id, `${pointer}/id`);
    if (isLayer(node)) {
      checkLayer(ctx, node, pointer);
    }
  });
  return ctx.issues;
}
