// packages/runtime/src/properties/interpolators.ts
/**
 * Interpolateurs prêts à l'emploi pour `PropertyDescriptor.interpolate`,
 * regroupés dans une table figée pour être choisis par nom (Blazor, fichiers
 * de configuration...).
 */

import type { PropertyInterpolator } from './types';
import { lerp } from './values';

/** Holds the start value until the next keyframe: `a` for `t < 1`, `b` from `t >= 1`. */
export function stepInterpolator(a: number, b: number, t: number): number {
  return t >= 1 ? b : a;
}

/** Linear value rounded down to an integer (e.g. an image index in a sprite sheet). */
export function floorInterpolator(a: number, b: number, t: number): number {
  return Math.floor(lerp(a, b, t));
}

/** Linear value rounded to the nearest integer. */
export function roundInterpolator(a: number, b: number, t: number): number {
  return Math.round(lerp(a, b, t));
}

/** Names of the ready-made interpolators. */
export type InterpolatorName = 'linear' | 'step' | 'floor' | 'round';

/** Ready-made interpolators by name (frozen). */
export const interpolators: Readonly<Record<InterpolatorName, PropertyInterpolator>> = Object.freeze({
  linear: lerp,
  step: stepInterpolator,
  floor: floorInterpolator,
  round: roundInterpolator
});
