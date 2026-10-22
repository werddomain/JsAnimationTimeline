// packages/runtime/src/properties/__tests__/values.test.ts
/**
 * Interpolation, bounds and CSS formatting of property values.
 */

import { BUILTIN_PROPERTIES } from '../builtins';
import type { PropertyDescriptor } from '../types';
import { clampValue, formatCssValue, interpolateValue, lerp, roundCssNumber } from '../values';

function builtin(name: string): PropertyDescriptor {
  const descriptor = BUILTIN_PROPERTIES.find((d) => d.name === name);
  if (descriptor === undefined) {
    throw new Error(`missing built-in ${name}`);
  }
  return descriptor;
}

describe('lerp', () => {
  it.each([
    [0, 10, 0, 0],
    [0, 10, 1, 10],
    [0, 10, 0.25, 2.5],
    [10, -10, 0.5, 0],
    [0, 10, 1.5, 15],
    [0, 10, -0.5, -5]
  ])('lerp(%p, %p, %p) = %p', (a, b, t, expected) => {
    expect(lerp(a, b, t)).toBeCloseTo(expected, 10);
  });
});

describe('clampValue', () => {
  it('bounds opacity', () => {
    expect(clampValue(builtin('opacity'), 1.2)).toBe(1);
    expect(clampValue(builtin('opacity'), -0.1)).toBe(0);
    expect(clampValue(builtin('opacity'), 0.4)).toBe(0.4);
  });

  it('leaves unbounded properties alone', () => {
    expect(clampValue(builtin('x'), -1e6)).toBe(-1e6);
  });

  it('applies a single bound', () => {
    const width: PropertyDescriptor = { name: 'width', kind: 'style', cssName: 'width', unit: 'px', defaultValue: 0, min: 0 };
    expect(clampValue(width, -5)).toBe(0);
    expect(clampValue(width, 5000)).toBe(5000);
  });
});

describe('interpolateValue', () => {
  it('is linear by default', () => {
    expect(interpolateValue(builtin('x'), 0, 300, 0.5)).toBe(150);
  });

  it('clamps overshoot of a bounded property', () => {
    expect(interpolateValue(builtin('opacity'), 0, 1, 1.3)).toBe(1);
  });

  it('uses a custom interpolator', () => {
    const stepped: PropertyDescriptor = {
      name: 'steps', kind: 'style', cssName: 'z-index', unit: '', defaultValue: 0,
      interpolate: (a, b, t) => (t < 1 ? a : b)
    };
    expect(interpolateValue(stepped, 1, 5, 0.9)).toBe(1);
    expect(interpolateValue(stepped, 1, 5, 1)).toBe(5);
  });
});

describe('roundCssNumber', () => {
  it('drops floating-point noise', () => {
    expect(roundCssNumber(0.1 + 0.2)).toBe(0.3);
    expect(roundCssNumber(1e-17)).toBe(0);
  });

  it('never returns -0', () => {
    expect(Object.is(roundCssNumber(-0), 0)).toBe(true);
    expect(Object.is(roundCssNumber(-1e-9), 0)).toBe(true);
  });

  it('keeps four decimals', () => {
    expect(roundCssNumber(12.345678)).toBe(12.3457);
  });
});

describe('formatCssValue', () => {
  it.each([
    ['x', 12.5, '12.5px'],
    ['rotation', -45, '-45deg'],
    ['scaleX', 1.25, '1.25'],
    ['opacity', 1.5, '1']
  ])('formats %s = %p as %p', (name, value, expected) => {
    expect(formatCssValue(builtin(name), value)).toBe(expected);
  });
});
