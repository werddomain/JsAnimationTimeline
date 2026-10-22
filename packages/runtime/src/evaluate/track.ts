// packages/runtime/src/evaluate/track.ts
/**
 * Valeur d'une piste (images clés d'une propriété) à une image donnée,
 * éventuellement fractionnaire, à l'intérieur d'une plage d'interpolation.
 */

import type { IPropertyKeyframe } from '../model/span';
import type { PropertyDescriptor } from '../properties/types';
import { interpolateValue } from '../properties/values';

/** Frame range of the span that owns the track. */
export interface ISpanRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Keyframes of a track inside a tween, with the value carried from earlier
 * spans as an implicit keyframe at `range.start` when the track starts later.
 */
export function withImplicitStart(
  track: readonly IPropertyKeyframe[],
  range: ISpanRange,
  carried: number
): readonly IPropertyKeyframe[] {
  if (track.length > 0 && track[0].frame <= range.start) {
    return track;
  }
  return [{ frame: range.start, value: carried }, ...track];
}

/** Index of the segment [i, i + 1] used at `frame`, or `null` to hold an end value. */
function segmentAt(points: readonly IPropertyKeyframe[], frame: number, range: ISpanRange): number | null {
  const last = points.length - 1;
  if (last < 1) {
    return null;
  }
  if (frame < points[0].frame) {
    // Before the first keyframe: only an easing that overshoots below the span start extrapolates.
    return frame < range.start && points[0].frame === range.start ? 0 : null;
  }
  if (frame > points[last].frame) {
    // After the last keyframe: hold, unless an overshooting easing goes past the span end.
    return frame > range.end && points[last].frame === range.end ? last - 1 : null;
  }
  let index = 0;
  while (index < last - 1 && frame > points[index + 1].frame) {
    index++;
  }
  return index;
}

/**
 * Value of `points` (sorted, non-empty) at `frame` (an eased frame, which may
 * fall outside the span with overshooting easings). Linear between keyframes
 * unless the descriptor interpolates otherwise; the first and last values are
 * held outside the keyframes.
 */
export function valueAtFrame(
  descriptor: PropertyDescriptor,
  points: readonly IPropertyKeyframe[],
  frame: number,
  range: ISpanRange
): number {
  const segment = segmentAt(points, frame, range);
  if (segment === null) {
    return frame < points[0].frame ? points[0].value : points[points.length - 1].value;
  }
  const a = points[segment];
  const b = points[segment + 1];
  return interpolateValue(descriptor, a.value, b.value, (frame - a.frame) / (b.frame - a.frame));
}
