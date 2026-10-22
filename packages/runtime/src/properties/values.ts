// packages/runtime/src/properties/values.ts
/**
 * Calculs sur une valeur de propriété : interpolation, bornes et mise en
 * forme CSS.
 */

import type { PropertyDescriptor } from './types';

/** Decimals kept when writing a value to CSS (avoids `1e-17px`). */
export const CSS_VALUE_PRECISION = 4;

/** Linear interpolation, the default of every property. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Applies the descriptor's `min` / `max` bounds. */
export function clampValue(descriptor: PropertyDescriptor, value: number): number {
  const withMin = descriptor.min === undefined ? value : Math.max(descriptor.min, value);
  return descriptor.max === undefined ? withMin : Math.min(descriptor.max, withMin);
}

/** Value between `a` (t = 0) and `b` (t = 1), with the descriptor's interpolator and bounds. */
export function interpolateValue(descriptor: PropertyDescriptor, a: number, b: number, t: number): number {
  const interpolate = descriptor.interpolate ?? lerp;
  return clampValue(descriptor, interpolate(a, b, t));
}

/** Rounds to `CSS_VALUE_PRECISION` decimals and drops `-0`. */
export function roundCssNumber(value: number): number {
  const factor = 10 ** CSS_VALUE_PRECISION;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * CSS text of a value, e.g. `12.5px`, `45deg`, `0.5`. The evaluator keeps
 * full precision; rounding happens only here. Throws for NaN or Infinity,
 * which would make the whole declaration invalid.
 */
export function formatCssValue(descriptor: PropertyDescriptor, value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Property "${descriptor.name}" has a non-finite value (${value}).`);
  }
  return `${roundCssNumber(clampValue(descriptor, value))}${descriptor.unit}`;
}
