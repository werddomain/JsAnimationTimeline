// packages/runtime/src/migrate/spans.ts
/**
 * Conversion des images clés et tweens d'un calque v1 en plages v2 :
 * chaque image clé ouvre une plage qui dure jusqu'à la suivante (ou la
 * dernière image). Image clé creuse → `blank`, image clé pleine → `static`,
 * et `tween` quand la plage commence dans un tween v1 (sans pistes : le
 * format v1 ne stocke aucune valeur). Les images avant la première image
 * clé forment une plage `blank`.
 */

import type { Easing } from '../model/easing';
import type { ISpan, SpanKind } from '../model/span';
import { isPositiveInteger, isRecord, warn, type IMigrationContext } from './context';
import { mapV1Easing } from './easing';
import { MigrationWarningCodes } from './issues';

/** A valid v1 tween: it covers the spans starting in [start, endExclusive). */
interface ITweenRange {
  readonly start: number;
  readonly endExclusive: number;
  readonly easing?: Easing;
}

/** frame → `true` when the keyframe is hollow. */
type KeyframeMarks = Map<number, boolean>;

function readKeyframe(ctx: IMigrationContext, raw: unknown, path: string): { frame: number; empty: boolean } | null {
  if (!isRecord(raw) || !isPositiveInteger(raw.frame) || raw.frame > ctx.totalFrames) {
    warn(ctx, path, MigrationWarningCodes.INVALID_KEYFRAME,
      `Keyframe dropped: its frame must be an integer in 1..${ctx.totalFrames}.`);
    return null;
  }
  return { frame: raw.frame, empty: raw.isEmpty === true };
}

function collectKeyframes(ctx: IMigrationContext, raw: unknown, path: string): KeyframeMarks {
  const marks: KeyframeMarks = new Map();
  if (!Array.isArray(raw)) {
    return marks;
  }
  raw.forEach((entry: unknown, index) => {
    const keyframe = readKeyframe(ctx, entry, `${path}/${index}`);
    if (keyframe === null) {
      return;
    }
    const existing = marks.get(keyframe.frame);
    if (existing !== undefined) {
      warn(ctx, `${path}/${index}`, MigrationWarningCodes.DUPLICATE_KEYFRAME,
        `Another keyframe is already at frame ${keyframe.frame}; only one is kept.`);
    }
    marks.set(keyframe.frame, existing === false ? false : keyframe.empty);
  });
  return marks;
}

function readEasing(ctx: IMigrationContext, type: unknown, path: string): Easing | undefined {
  if (type === undefined) {
    return undefined;
  }
  const easing = typeof type === 'string' ? mapV1Easing(type) : null;
  if (easing === null) {
    warn(ctx, path, MigrationWarningCodes.UNKNOWN_EASING, `Unknown easing ${JSON.stringify(type)}; the default is used.`);
    return undefined;
  }
  return easing;
}

function readTween(ctx: IMigrationContext, raw: unknown, path: string): ITweenRange | null {
  if (!isRecord(raw) || !isPositiveInteger(raw.startFrame) || !isPositiveInteger(raw.endFrame)
    || raw.startFrame >= raw.endFrame || raw.startFrame > ctx.totalFrames) {
    warn(ctx, path, MigrationWarningCodes.INVALID_TWEEN,
      `Tween dropped: it needs integer frames with startFrame < endFrame and startFrame <= ${ctx.totalFrames}.`);
    return null;
  }
  const easing = readEasing(ctx, raw.type, `${path}/type`);
  let endExclusive = raw.endFrame;
  if (endExclusive > ctx.totalFrames) {
    warn(ctx, `${path}/endFrame`, MigrationWarningCodes.TWEEN_TRUNCATED,
      `Tween ends at frame ${endExclusive}, after the last frame; it now ends at frame ${ctx.totalFrames}.`);
    endExclusive = ctx.totalFrames + 1;
  }
  return { start: raw.startFrame, endExclusive, ...(easing === undefined ? {} : { easing }) };
}

function collectTweens(ctx: IMigrationContext, raw: unknown, path: string): ITweenRange[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry: unknown, index) => readTween(ctx, entry, `${path}/${index}`))
    .filter((tween): tween is ITweenRange => tween !== null)
    .sort((a, b) => a.start - b.start);
}

/** v1 tweens go from keyframe to keyframe: add a solid keyframe where one is missing. */
function addTweenKeyframes(ctx: IMigrationContext, marks: KeyframeMarks, tweens: readonly ITweenRange[], path: string): void {
  const boundaries = tweens.flatMap((tween) =>
    tween.endExclusive > ctx.totalFrames ? [tween.start] : [tween.start, tween.endExclusive]);
  for (const frame of boundaries) {
    if (!marks.has(frame)) {
      warn(ctx, path, MigrationWarningCodes.TWEEN_KEYFRAME_ADDED,
        `A tween starts or ends at frame ${frame} without a keyframe; a keyframe was added.`);
      marks.set(frame, false);
    }
  }
}

/** The latest-starting tween covering a span that starts at `frame`. */
function findTween(tweens: readonly ITweenRange[], frame: number): ITweenRange | undefined {
  return tweens.filter((tween) => tween.start <= frame && frame < tween.endExclusive).pop();
}

function spanAt(ctx: IMigrationContext, idPrefix: string, start: number, end: number, kind: SpanKind, easing?: Easing): ISpan {
  const id = ctx.ids.generate(idPrefix);
  return kind === 'tween' && easing !== undefined ? { id, start, end, kind, easing } : { id, start, end, kind };
}

/**
 * Builds the spans of a v1 layer.
 * @param layer The raw v1 layer (keyframes and tweens are read defensively).
 * @param path Pointer of the layer in the v1 input.
 * @param idPrefix Prefix of the generated span ids.
 */
export function buildSpans(ctx: IMigrationContext, layer: Readonly<Record<string, unknown>>, path: string, idPrefix: string): ISpan[] {
  const marks = collectKeyframes(ctx, layer.keyframes, `${path}/keyframes`);
  const tweens = collectTweens(ctx, layer.tweens, `${path}/tweens`);
  addTweenKeyframes(ctx, marks, tweens, `${path}/tweens`);
  const frames = [...marks.keys()].sort((a, b) => a - b);
  const spans: ISpan[] = [];
  if (frames.length > 0 && frames[0] > 1) {
    spans.push(spanAt(ctx, idPrefix, 1, frames[0] - 1, 'blank'));
  }
  frames.forEach((start, index) => {
    const end = (frames[index + 1] ?? ctx.totalFrames + 1) - 1;
    const tween = findTween(tweens, start);
    if (marks.get(start) === true) {
      if (tween !== undefined) {
        warn(ctx, `${path}/keyframes`, MigrationWarningCodes.TWEEN_ON_BLANK_KEYFRAME,
          `The hollow keyframe at frame ${start} is inside a tween; its span stays blank.`);
      }
      spans.push(spanAt(ctx, idPrefix, start, end, 'blank'));
    } else {
      spans.push(spanAt(ctx, idPrefix, start, end, tween === undefined ? 'static' : 'tween', tween?.easing));
    }
  });
  return spans;
}
