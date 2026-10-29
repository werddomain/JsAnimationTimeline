// packages/runtime/src/transport/time.ts
/**
 * Conversion unique entre le temps (millisecondes) et les images : image
 * fractionnaire `1 + t * fps / 1000`, image entière arrondie vers le bas avec
 * une tolérance (bruit des flottants au début d'une image), bornée à
 * 1..totalFrames.
 */

import type { ITransportTime, ITransportTimeline } from './types';

/** Tolerance when converting a time to a frame (float noise at frame starts). */
const FRAME_EPSILON = 1e-6;

/** Length of the timeline in milliseconds: totalFrames / fps. */
export function timelineDuration(timeline: ITransportTimeline): number {
  return (timeline.totalFrames / timeline.fps) * 1000;
}

/** Start time (ms) of a frame; frame 1 starts at 0. Not clamped. */
export function frameToTime(frame: number, fps: number): number {
  return ((frame - 1) / fps) * 1000;
}

/** The position at `timeMs` (expected within 0..duration) in every unit. */
export function toTransportTime(timeMs: number, timeline: ITransportTimeline): ITransportTime {
  const exact = (timeMs * timeline.fps) / 1000;
  const integerFrame = Math.min(timeline.totalFrames, Math.max(1, 1 + Math.floor(exact + FRAME_EPSILON)));
  return { timeMs, frame: 1 + exact, integerFrame };
}

/** Throws unless fps is finite and > 0 and totalFrames an integer ≥ 1. */
export function assertValidTimeline(timeline: ITransportTimeline): void {
  if (!Number.isFinite(timeline.fps) || timeline.fps <= 0) {
    throw new Error(`fps must be a finite number above 0 (got ${timeline.fps}).`);
  }
  if (!Number.isInteger(timeline.totalFrames) || timeline.totalFrames < 1) {
    throw new Error(`totalFrames must be an integer of at least 1 (got ${timeline.totalFrames}).`);
  }
}

/** Throws unless speed is finite and > 0. */
export function assertValidSpeed(speed: number): void {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`Speed must be a finite number above 0 (got ${speed}).`);
  }
}
