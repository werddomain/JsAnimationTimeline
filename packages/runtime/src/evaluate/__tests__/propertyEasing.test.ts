// packages/runtime/src/evaluate/__tests__/propertyEasing.test.ts
import type { IEffectParameters, PropertyEasing, PropertyEasingFamily, PropertyEasingMode } from '../../model/propertyEasing';
import { createEasingFunction, cubicBezierFunction } from '../easingFunction';
import { createPropertyEasingFunction } from '../propertyEasing';

const families: readonly PropertyEasingFamily[] = [
  'linear', 'sine', 'circle', 'quadratic', 'cubic', 'quartic', 'quintic',
  'power', 'exponential', 'back', 'bounce', 'elastic'
];
const modes: readonly PropertyEasingMode[] = ['in', 'out', 'in-out'];

function effect(family: PropertyEasingFamily, mode: PropertyEasingMode = 'in', parameters?: IEffectParameters) {
  return createPropertyEasingFunction({ kind: 'effect', family, mode, ...(parameters === undefined ? {} : { parameters }) });
}

describe('property timing effects', () => {
  it('uses linear progress when no easing was supplied', () => {
    const easing = createPropertyEasingFunction();
    for (const progress of [0, 0.125, 0.5, 0.9, 1]) expect(easing(progress)).toBe(progress);
  });

  it.each(families)('%s has exact endpoints and finite interior values in every mode', (family) => {
    for (const mode of modes) {
      const easing = effect(family, mode);
      expect(easing(0)).toBe(0);
      expect(easing(1)).toBe(1);
      for (let index = 1; index < 100; index++) expect(Number.isFinite(easing(index / 100))).toBe(true);
    }
  });

  it('evaluates the mathematical families rather than mapping to CSS presets', () => {
    expect(effect('sine')(0.5)).toBeCloseTo(1 - Math.SQRT1_2, 12);
    expect(effect('circle')(0.5)).toBeCloseTo(1 - Math.sqrt(0.75), 12);
    expect(effect('quadratic')(0.5)).toBe(0.25);
    expect(effect('cubic')(0.5)).toBe(0.125);
    expect(effect('quartic')(0.5)).toBe(0.0625);
    expect(effect('quintic')(0.5)).toBe(0.03125);
    expect(effect('power', 'in', { power: 7 })(0.5)).toBe(0.0078125);
    expect(effect('exponential', 'in', { exponent: 2 })(0.5)).toBeCloseTo(1 / (Math.E + 1), 12);
    expect(effect('back', 'in', { amplitude: 1 })(0.5)).toBeCloseTo(-0.375, 12);
  });

  it.each(families)('applies direction consistently to %s', (family) => {
    const enter = effect(family);
    const leave = effect(family, 'out');
    const both = effect(family, 'in-out');
    for (const progress of [0.1, 0.23, 0.5, 0.72, 0.9]) {
      expect(leave(progress)).toBeCloseTo(1 - enter(1 - progress), 12);
      const expected = progress < 0.5 ? enter(progress * 2) / 2 : 1 - enter((1 - progress) * 2) / 2;
      expect(both(progress)).toBeCloseTo(expected, 12);
    }
  });

  it('makes quadratic modes observably different', () => {
    expect(effect('quadratic', 'in')(0.25)).toBe(0.0625);
    expect(effect('quadratic', 'out')(0.25)).toBe(0.4375);
    expect(effect('quadratic', 'in-out')(0.25)).toBe(0.125);
  });

  it('preserves back and spring overshoot rather than clamping output', () => {
    for (const family of ['back', 'elastic'] as const) {
      const samples = Array.from({ length: 99 }, (_, index) => (index + 1) / 100);
      expect(Math.min(...samples.map(effect(family)))).toBeLessThan(0);
      expect(Math.max(...samples.map(effect(family, 'out')))).toBeGreaterThan(1);
    }
  });

  it('uses geometric parabolic bounces with independently adjustable count and ratio', () => {
    const bounce = effect('bounce', 'in', { bounces: 3, bounciness: 2 });
    for (const point of [0, 1 / 11, 3 / 11, 7 / 11]) expect(bounce(point)).toBeCloseTo(0, 12);
    expect(bounce(0.5 / 11)).toBeCloseTo(0.125, 12);
    expect(bounce(2 / 11)).toBeCloseTo(0.25, 12);
    expect(bounce(5 / 11)).toBeCloseTo(0.5, 12);
    expect(bounce(1)).toBe(1);
    expect(effect('bounce', 'in', { bounces: 0 })(0.5)).toBeCloseTo(0.75, 12);
    const equal = effect('bounce', 'in', { bounces: 2, bounciness: 1 });
    expect(equal(0.2)).toBeCloseTo(1, 12);
    expect(equal(0.4)).toBeCloseTo(0, 12);
    expect(equal(0.6)).toBeCloseTo(1, 12);
  });

  it('uses the linear envelope limit when springiness or exponent tends to zero', () => {
    expect(effect('exponential', 'in', { exponent: 0 })(0.3)).toBe(0.3);
    expect(effect('exponential', 'in', { exponent: 1e-12 })(0.3)).toBeCloseTo(0.3, 12);
    expect(effect('elastic', 'in', { oscillations: 0, springiness: 0 })(0.5)).toBeCloseTo(Math.SQRT1_2 / 2, 12);
    expect(effect('elastic', 'in', { oscillations: 3, springiness: 0 })(0.5)).toBeCloseTo(-Math.SQRT1_2 / 2, 12);
  });

  it('uses the linear envelope limit for subnormal growth without underflow artifacts', () => {
    expect(effect('exponential', 'in', { exponent: Number.MIN_VALUE })(0.3)).toBeCloseTo(0.3, 12);
    expect(effect('elastic', 'in', { oscillations: 0, springiness: Number.MIN_VALUE })(0.5)).toBeCloseTo(Math.SQRT1_2 / 2, 12);
  });

  it.each<readonly [PropertyEasingFamily, IEffectParameters]>([
    ['power', { power: 0.1 }], ['power', { power: 20 }],
    ['exponential', { exponent: 30 }], ['back', { amplitude: 10 }],
    ['bounce', { bounces: 32, bounciness: 1 }], ['bounce', { bounces: 32, bounciness: 10 }],
    ['elastic', { oscillations: 32, springiness: 30 }]
  ])('remains finite at valid extreme settings for %s', (family, parameters) => {
    for (const mode of modes) {
      const easing = effect(family, mode, parameters);
      for (const progress of [0, 1e-12, 0.001, 0.125, 0.333, 0.5, 0.875, 1 - 1e-12, 1]) {
        expect(Number.isFinite(easing(progress))).toBe(true);
      }
      expect(easing(0)).toBe(0);
      expect(easing(1)).toBe(1);
    }
  });

  it('reuses the cubic Bezier solver and preserves its overshoot', () => {
    const modern = createPropertyEasingFunction({ kind: 'bezier', x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 });
    const legacy = createEasingFunction('cubic-bezier(0.68, -0.55, 0.265, 1.55)');
    for (const progress of [0, 0.1, 0.333, 0.5, 0.8, 1]) expect(modern(progress)).toBe(legacy(progress));
  });

  it('accepts tiny Bezier coordinates represented by JavaScript in exponent notation', () => {
    const description = { kind: 'bezier' as const, x1: 1.234e-7, y1: -1e-12, x2: 0.4, y2: Number.MIN_VALUE };
    const modern = createPropertyEasingFunction(description);
    const expected = cubicBezierFunction(description);
    for (const progress of [0, 0.1, 0.333, 0.5, 0.8, 1]) expect(modern(progress)).toBe(expected(progress));
  });

  it('normalizes finite input progress without restricting effect output', () => {
    for (const easing of [createPropertyEasingFunction(), effect('circle'), effect('back', 'out')]) {
      expect(easing(-10)).toBe(0);
      expect(easing(10)).toBe(1);
    }
    expect(effect('back', 'out')(0.5)).toBeGreaterThan(1);
  });

  it('rejects invalid descriptions and non-finite progress', () => {
    expect(() => createPropertyEasingFunction({ kind: 'effect', family: 'bounce', mode: 'in', parameters: { bounces: -1 } })).toThrow();
    expect(() => createPropertyEasingFunction(null as unknown as PropertyEasing)).toThrow();
    for (const easing of [createPropertyEasingFunction(), effect('circle'), createPropertyEasingFunction({ kind: 'bezier', x1: 0, y1: 0, x2: 1, y2: 1 })]) {
      for (const progress of [NaN, Infinity, -Infinity]) expect(() => easing(progress)).toThrow();
    }
  });

  it('does not change a constructed effect when its source description is later modified', () => {
    const parameters = { power: 3 };
    const easing = effect('power', 'in', parameters);
    parameters.power = 5;
    expect(easing(0.5)).toBe(0.125);
  });
});
