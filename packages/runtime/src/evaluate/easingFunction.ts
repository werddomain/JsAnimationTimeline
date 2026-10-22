// packages/runtime/src/evaluate/easingFunction.ts
/**
 * Fonction d'accélération d'une plage : progression linéaire [0, 1] →
 * progression accélérée, selon la courbe de Bézier cubique CSS.
 */

import { parseEasing } from '../model/easing';
import type { ICubicBezier } from '../model/easing';

/** Maps a linear progress in [0, 1] to an eased progress (may leave [0, 1] when the curve overshoots). */
export type EasingFunction = (progress: number) => number;

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-6;
const PRECISION = 1e-7;
const BISECTION_MAX_ITERATIONS = 50;

/** Coordinate of a 1D cubic Bézier with P0 = 0 and P3 = 1. */
function bezier(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

function bezierSlope(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * p1 + 6 * u * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

/** Curve parameter whose x is `x` (x1 and x2 in [0, 1] make x monotonic). */
function solveCurveX(x: number, x1: number, x2: number): number {
  let t = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const error = bezier(t, x1, x2) - x;
    if (Math.abs(error) < PRECISION) {
      return t;
    }
    const slope = bezierSlope(t, x1, x2);
    if (Math.abs(slope) < NEWTON_MIN_SLOPE) {
      break;
    }
    t -= error / slope;
  }
  let low = 0;
  let high = 1;
  t = x;
  for (let i = 0; i < BISECTION_MAX_ITERATIONS && high - low > PRECISION; i++) {
    if (bezier(t, x1, x2) < x) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }
  return t;
}

/** Easing function of a parsed curve. */
export function cubicBezierFunction(curve: ICubicBezier): EasingFunction {
  const { x1, y1, x2, y2 } = curve;
  if (x1 === y1 && x2 === y2) {
    return (progress) => progress;
  }
  return (progress) => {
    if (progress <= 0) {
      return 0;
    }
    if (progress >= 1) {
      return 1;
    }
    return bezier(solveCurveX(progress, x1, x2), y1, y2);
  };
}

/** Easing function of a preset or `cubic-bezier(...)`; throws for an invalid string. */
export function createEasingFunction(easing: string): EasingFunction {
  const curve = parseEasing(easing);
  if (curve === null) {
    throw new Error(`Invalid easing "${easing}".`);
  }
  return cubicBezierFunction(curve);
}
