// packages/runtime/src/evaluate/__tests__/easingFunction.test.ts
/**
 * Easing functions built from presets and cubic-bezier strings.
 */

import { EASING_PRESETS } from '../../model/easing';
import { createEasingFunction, cubicBezierFunction } from '../easingFunction';

describe('createEasingFunction', () => {
  it('is the identity for linear', () => {
    const linear = createEasingFunction('linear');
    [0, 0.1, 0.37, 0.5, 0.99, 1].forEach((p) => expect(linear(p)).toBe(p));
  });

  it.each(EASING_PRESETS)('%s goes from 0 to 1', (preset) => {
    const ease = createEasingFunction(preset);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it.each(EASING_PRESETS.filter((p) => p !== 'linear'))('%s clamps progress outside [0, 1]', (preset) => {
    const ease = createEasingFunction(preset);
    expect(ease(-0.5)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  it('matches the CSS curves at known points', () => {
    // Reference values of the CSS timing functions (y at x = 0.5).
    expect(createEasingFunction('ease')(0.5)).toBeCloseTo(0.8024, 3);
    expect(createEasingFunction('ease-in')(0.5)).toBeCloseTo(0.3153, 3);
    expect(createEasingFunction('ease-out')(0.5)).toBeCloseTo(0.6847, 3);
    expect(createEasingFunction('ease-in-out')(0.5)).toBeCloseTo(0.5, 6);
  });

  it('is symmetric for ease-in-out', () => {
    const ease = createEasingFunction('ease-in-out');
    [0.1, 0.25, 0.4].forEach((p) => expect(ease(p) + ease(1 - p)).toBeCloseTo(1, 6));
  });

  it('is monotonic for every preset', () => {
    for (const preset of EASING_PRESETS) {
      const ease = createEasingFunction(preset);
      let previous = 0;
      for (let i = 1; i <= 100; i++) {
        const value = ease(i / 100);
        expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = value;
      }
    }
  });

  it('overshoots with a back-like cubic-bezier', () => {
    const back = createEasingFunction('cubic-bezier(0.68, -0.55, 0.265, 1.55)');
    const samples = Array.from({ length: 99 }, (_, i) => back((i + 1) / 100));
    expect(Math.min(...samples)).toBeLessThan(0);
    expect(Math.max(...samples)).toBeGreaterThan(1);
  });

  it('solves curves with a flat x slope (bisection fallback)', () => {
    const steep = createEasingFunction('cubic-bezier(1, 0, 0, 1)');
    expect(steep(0.5)).toBeCloseTo(0.5, 5);
    expect(steep(0.02)).toBeLessThan(0.01);
    expect(steep(0.98)).toBeGreaterThan(0.99);
  });

  it('falls back to bisection when Newton overshoots near a flat x slope', () => {
    // x(t) = 0.5 + 4(t - 0.5)^3: at x = 0.51, t = 0.5 + 0.0025^(1/3).
    const t = 0.5 + Math.cbrt(0.0025);
    const expected = 3 * (1 - t) * t * t + t * t * t;
    expect(createEasingFunction('cubic-bezier(1, 0, 0, 1)')(0.51)).toBeCloseTo(expected, 5);
  });

  it('solves curves where the x slope vanishes at the ends', () => {
    const flatEnds = createEasingFunction('cubic-bezier(0, 0.5, 1, 0.5)');
    expect(flatEnds(0.001)).toBeGreaterThan(0);
    expect(flatEnds(0.5)).toBeCloseTo(0.5, 5);
  });

  it('throws for an invalid easing', () => {
    expect(() => createEasingFunction('bounce')).toThrow('Invalid easing "bounce".');
  });
});

describe('cubicBezierFunction', () => {
  it('returns the identity for a diagonal curve', () => {
    const fn = cubicBezierFunction({ x1: 0.3, y1: 0.3, x2: 0.7, y2: 0.7 });
    expect(fn(0.42)).toBe(0.42);
  });
});
