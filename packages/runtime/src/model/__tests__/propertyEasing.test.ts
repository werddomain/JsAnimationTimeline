// packages/runtime/src/model/__tests__/propertyEasing.test.ts
import { isPropertyEasing } from '../propertyEasing';
import type { IEffectParameters, PropertyEasingFamily, PropertyEasingMode } from '../propertyEasing';

const families: readonly PropertyEasingFamily[] = [
  'linear', 'sine', 'circle', 'quadratic', 'cubic', 'quartic', 'quintic',
  'power', 'exponential', 'back', 'bounce', 'elastic'
];
const modes: readonly PropertyEasingMode[] = ['in', 'out', 'in-out'];

describe('property easing validation', () => {
  it.each(families)('accepts every mode of %s with its documented defaults', (family) => {
    for (const mode of modes) expect(isPropertyEasing({ kind: 'effect', family, mode })).toBe(true);
  });

  it.each<readonly [PropertyEasingFamily, IEffectParameters]>([
    ['power', { power: 0.1 }], ['power', { power: 20 }],
    ['exponential', { exponent: 0 }], ['exponential', { exponent: 30 }],
    ['back', { amplitude: 0 }], ['back', { amplitude: 10 }],
    ['bounce', { bounces: 0, bounciness: 1 }], ['bounce', { bounces: 32, bounciness: 10 }],
    ['elastic', { oscillations: 0, springiness: 0 }], ['elastic', { oscillations: 32, springiness: 30 }]
  ])('accepts the parameter bounds of %s (%j)', (family, parameters) => {
    expect(isPropertyEasing({ kind: 'effect', family, mode: 'out', parameters })).toBe(true);
  });

  it.each([
    null, undefined, [], 'ease-in', 1,
    {}, { kind: 'effect', family: 'linear' },
    { kind: 'effect', family: 'unknown', mode: 'in' },
    { kind: 'effect', family: 'sine', mode: 'ease-in' },
    { kind: 'effect', family: 'sine', mode: 'in', surprise: true },
    { kind: 'effect', family: 'sine', mode: 'in', parameters: null },
    { kind: 'effect', family: 'sine', mode: 'in', parameters: [] },
    { kind: 'effect', family: 'sine', mode: 'in', parameters: { power: 2 } },
    { kind: 'effect', family: 'back', mode: 'in', parameters: { amplitude: -1 } },
    { kind: 'effect', family: 'back', mode: 'in', parameters: { amplitude: 10.1 } },
    { kind: 'effect', family: 'power', mode: 'in', parameters: { power: 0 } },
    { kind: 'effect', family: 'power', mode: 'in', parameters: { power: 21 } },
    { kind: 'effect', family: 'power', mode: 'in', parameters: { power: NaN } },
    { kind: 'effect', family: 'exponential', mode: 'in', parameters: { exponent: Infinity } },
    { kind: 'effect', family: 'exponential', mode: 'in', parameters: { exponent: -1 } },
    { kind: 'effect', family: 'exponential', mode: 'in', parameters: { exponent: 31 } },
    { kind: 'effect', family: 'bounce', mode: 'in', parameters: { bounces: 1.5 } },
    { kind: 'effect', family: 'bounce', mode: 'in', parameters: { bounces: 33 } },
    { kind: 'effect', family: 'bounce', mode: 'in', parameters: { bounciness: 0.9 } },
    { kind: 'effect', family: 'bounce', mode: 'in', parameters: { bounciness: 11 } },
    { kind: 'effect', family: 'elastic', mode: 'in', parameters: { oscillations: -1 } },
    { kind: 'effect', family: 'elastic', mode: 'in', parameters: { oscillations: 0.5 } },
    { kind: 'effect', family: 'elastic', mode: 'in', parameters: { oscillations: 33 } },
    { kind: 'effect', family: 'elastic', mode: 'in', parameters: { springiness: 31 } },
    { kind: 'effect', family: 'elastic', mode: 'in', parameters: { springiness: -1 } },
    { kind: 'effect', family: 'elastic', mode: 'in', parameters: { extra: 1 } }
  ])('rejects invalid or irrelevant fields in %j', (value) => {
    expect(isPropertyEasing(value)).toBe(false);
  });

  it('accepts Bezier overshoot while bounding finite control coordinates', () => {
    expect(isPropertyEasing({ kind: 'bezier', x1: 0, y1: -100, x2: 1, y2: 100 })).toBe(true);
    expect(isPropertyEasing({ kind: 'bezier', x1: 0.2, y1: -0.5, x2: 0.7, y2: 1.5 })).toBe(true);
    for (const changes of [{ x1: -0.1 }, { x2: 1.1 }, { y1: -101 }, { y2: 101 }, { y1: Infinity }]) {
      expect(isPropertyEasing({ kind: 'bezier', x1: 0, y1: 0, x2: 1, y2: 1, ...changes })).toBe(false);
    }
    expect(isPropertyEasing({ kind: 'bezier', x1: 0, y1: 0, x2: 1 })).toBe(false);
    expect(isPropertyEasing({ kind: 'bezier', x1: 0, y1: 0, x2: 1, y2: 1, extra: true })).toBe(false);
  });

  it('requires own fields rather than inherited descriptions', () => {
    const inherited: unknown = Object.create({ kind: 'effect', family: 'linear', mode: 'in' });
    expect(isPropertyEasing(inherited)).toBe(false);
    expect(isPropertyEasing({ kind: 'effect', family: 'linear', mode: 'in', [Symbol('hidden')]: true })).toBe(false);
  });

  it('rejects inherited optional parameters and invalid nonenumerable values', () => {
    const parameters: unknown = Object.create({ power: Infinity });
    expect(isPropertyEasing({ kind: 'effect', family: 'power', mode: 'in', parameters })).toBe(false);
    const hidden = Object.defineProperty({}, 'power', { value: Infinity, enumerable: false });
    expect(isPropertyEasing({ kind: 'effect', family: 'power', mode: 'in', parameters: hidden })).toBe(false);
  });

  it('accepts explicitly empty parameters and plain records with no prototype', () => {
    expect(isPropertyEasing({ kind: 'effect', family: 'linear', mode: 'in', parameters: {} })).toBe(true);
    const parameters: unknown = Object.create(null);
    expect(isPropertyEasing({ kind: 'effect', family: 'elastic', mode: 'in', parameters })).toBe(true);
  });
});
