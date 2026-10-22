// packages/runtime/src/model/easing.ts
/**
 * Accélérations (easing) d'une plage d'interpolation : préréglages CSS
 * ou `cubic-bezier(x1, y1, x2, y2)`. `parseEasing` donne les points de
 * contrôle de la courbe, ou `null` si la chaîne est invalide.
 */

/** Easing presets, same names and curves as CSS. */
export type EasingPreset = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** A CSS `cubic-bezier(...)` string (the content is checked by `parseEasing`). */
export type CubicBezierEasing = `cubic-bezier(${string})`;

/** Easing of a tween span. */
export type Easing = EasingPreset | CubicBezierEasing;

/** All presets, in schema order. */
export const EASING_PRESETS: readonly EasingPreset[] = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];

/** Easing used when a tween span has none. */
export const DEFAULT_EASING: EasingPreset = 'linear';

/** Control points of a cubic Bézier timing function (P0 = (0,0), P3 = (1,1)). */
export interface ICubicBezier {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** CSS standard control points of each preset. */
const PRESET_CURVES: Readonly<Record<EasingPreset, ICubicBezier>> = {
  'linear': { x1: 0, y1: 0, x2: 1, y2: 1 },
  'ease': { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  'ease-in': { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  'ease-out': { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  'ease-in-out': { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }
};

const NUMBER_SOURCE = '[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';

/**
 * Syntax of a `cubic-bezier(...)` easing (spaces optional). The same
 * pattern is used in `schema/timeline.schema.json` (checked by a test).
 */
export const CUBIC_BEZIER_PATTERN = new RegExp(
  `^cubic-bezier\\(\\s*(${NUMBER_SOURCE})\\s*,\\s*(${NUMBER_SOURCE})\\s*,\\s*(${NUMBER_SOURCE})\\s*,\\s*(${NUMBER_SOURCE})\\s*\\)$`
);

/** True when `value` is one of the preset names. */
export function isEasingPreset(value: string): value is EasingPreset {
  return (EASING_PRESETS as readonly string[]).includes(value);
}

function isUnitInterval(value: number): boolean {
  return value >= 0 && value <= 1;
}

/**
 * Returns the control points of an easing, or `null` when the string is not
 * a preset nor a valid `cubic-bezier(...)`. As in CSS, x1 and x2 must lie in
 * [0, 1]; y1 and y2 are free.
 */
export function parseEasing(easing: string): ICubicBezier | null {
  if (isEasingPreset(easing)) {
    return PRESET_CURVES[easing];
  }
  const match = CUBIC_BEZIER_PATTERN.exec(easing);
  if (match === null) {
    return null;
  }
  const [x1, y1, x2, y2] = match.slice(1, 5).map(Number);
  if (!isUnitInterval(x1) || !isUnitInterval(x2)) {
    return null;
  }
  return { x1, y1, x2, y2 };
}
