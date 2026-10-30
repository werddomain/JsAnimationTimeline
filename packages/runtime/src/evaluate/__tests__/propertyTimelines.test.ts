// packages/runtime/src/evaluate/__tests__/propertyTimelines.test.ts
import type { ILayer } from '../../model/layer';
import type { ISpan } from '../../model/span';
import { createPropertyRegistry } from '../../properties/PropertyRegistry';
import { evaluateLayer } from '../evaluateLayer';
import type { IEvaluateOptions, ILayerFrameState } from '../evaluateLayer';

// Structural fixtures let the first RED exercise runtime behavior before the
// parallel model change lands. They do not depend on a missing exported type.
type Value =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'color'; readonly r: number; readonly g: number; readonly b: number; readonly a: number };

type Timing =
  | { readonly kind: 'effect'; readonly family: 'linear' | 'sine' | 'back'; readonly mode: 'in' | 'out' | 'in-out' }
  | { readonly kind: 'bezier'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

interface Key {
  readonly frame: number;
  readonly value: Value;
}

interface SourceCurve {
  readonly start: number;
  readonly end: number;
  readonly keys: readonly Key[];
  readonly easing?: Timing;
}

interface Transition {
  readonly id: string;
  readonly fromFrame: number;
  readonly toFrame: number;
  readonly easing?: Timing;
  readonly source?: SourceCurve;
}

interface Timeline {
  readonly initialValue: Value;
  readonly keys: readonly Key[];
  readonly transitions?: readonly Transition[];
  readonly beforeFirst?: 'initial' | 'first-key';
}

type PropertyState = ILayerFrameState & {
  readonly propertyValues?: Readonly<Record<string, Value>>;
};

const number = (value: number): Value => ({ kind: 'number', value });
const key = (frame: number, value: number): Key => ({ frame, value: number(value) });
const sineIn: Timing = { kind: 'effect', family: 'sine', mode: 'in' };

function layer(timelines: Readonly<Record<string, Timeline>>, spans: readonly ISpan[] = [], id = 'item'): ILayer {
  const result = { id, type: 'layer' as const, name: id, spans, propertyTimelines: timelines };
  return result as ILayer;
}

function sample(target: ILayer, frame: number, options?: IEvaluateOptions): PropertyState {
  return evaluateLayer(target, frame, options) as PropertyState;
}

describe('property timeline initial state and held keys', () => {
  it('uses each target initial value before its first key instead of a registry-wide default', () => {
    const first = layer({ opacity: { initialValue: number(0.25), keys: [key(50, 0.8)] } }, [], 'first');
    const second = layer({ opacity: { initialValue: number(0.65), keys: [key(50, 0.8)] } }, [], 'second');

    expect(sample(first, 20)).toMatchObject({ visible: true, values: { opacity: 0.25 } });
    expect(sample(second, 20)).toMatchObject({ visible: true, values: { opacity: 0.65 } });
    expect(sample(first, 20).propertyValues).toEqual({ opacity: number(0.25) });
    expect(sample(first, 50).values.opacity).toBe(0.8);
  });

  it('supports an explicit first-key rule without adding an initial key', () => {
    const keys = [key(50, 0.8)];
    const target = layer({ opacity: { initialValue: number(1), beforeFirst: 'first-key', keys } });
    const original = JSON.stringify(target);

    for (const frame of [1, 20, 49, 50, 80, 100]) {
      expect(sample(target, frame).values.opacity).toBe(0.8);
    }
    expect(keys).toEqual([key(50, 0.8)]);
    expect(JSON.stringify(target)).toBe(original);
  });

  it('keeps the initial value when a first-key rule has no key yet', () => {
    const target = layer({ x: { initialValue: number(17), beforeFirst: 'first-key', keys: [] } });
    expect(sample(target, 50).propertyValues).toEqual({ x: number(17) });
    expect(sample(target, 50).values).toEqual({ x: 17 });
  });

  it('holds each value until the next key and keeps the last value afterwards', () => {
    const target = layer({ x: { initialValue: number(5), keys: [key(10, 30), key(20, 60)] } });
    const expected: readonly [number, number][] = [[1, 5], [9.5, 5], [10, 30], [19.5, 30], [20, 60], [100, 60]];

    for (const [frame, value] of expected) expect(sample(target, frame).values.x).toBe(value);
  });

  it('preserves pre-existing snapshot keys between later edits', () => {
    const target = layer({ x: {
      initialValue: number(0),
      keys: [key(10, 1), key(11, 0), key(19, 0), key(20, 2), key(21, 0)]
    } });

    expect([10, 11, 18, 19, 20, 21, 24].map((frame) => sample(target, frame).values.x))
      .toEqual([1, 0, 0, 0, 2, 0, 0]);
  });

  it('does not animate a new position just because opacity has a transition', () => {
    const opacity: Timeline = {
      initialValue: number(0), keys: [key(1, 0), key(101, 1)],
      transitions: [{ id: 'fade', fromFrame: 1, toFrame: 101 }]
    };
    const original = layer({ opacity });
    const target = layer({ opacity, x: { initialValue: number(0), keys: [key(50, 30)] } });

    for (const frame of [1, 25, 49, 49.5, 50, 75, 101]) {
      const state = sample(target, frame);
      expect(state.values.opacity).toBeCloseTo((frame - 1) / 100, 12);
      expect(state.values.opacity).toBe(sample(original, frame).values.opacity);
      expect(state.values.x).toBe(frame < 50 ? 0 : 30);
    }
  });
});

describe('property timeline independent transitions', () => {
  it('applies each transition to its own range while keeping gaps discrete', () => {
    const target = layer({ x: {
      initialValue: number(-10), keys: [key(5, 0), key(15, 100), key(25, 200), key(35, 300)],
      transitions: [
        { id: 'first', fromFrame: 5, toFrame: 15 },
        { id: 'second', fromFrame: 25, toFrame: 35, easing: sineIn }
      ]
    } });

    expect(sample(target, 4).values.x).toBe(-10);
    expect(sample(target, 7.5).values.x).toBeCloseTo(25, 12);
    expect(sample(target, 20).values.x).toBe(100);
    expect(sample(target, 25).values.x).toBe(200);
    expect(sample(target, 30).values.x).toBeCloseTo(200 + 100 * (1 - Math.SQRT1_2), 10);
    expect(sample(target, 40).values.x).toBe(300);
  });

  it('uses the stored value exactly at an intermediate key with independent easing on either side', () => {
    const target = layer({ x: {
      initialValue: number(0), keys: [key(1, 0), key(6, 75), key(11, 100)],
      transitions: [
        { id: 'before', fromFrame: 1, toFrame: 6, easing: sineIn },
        { id: 'after', fromFrame: 6, toFrame: 11, easing: { kind: 'effect', family: 'linear', mode: 'in' } }
      ]
    } });

    expect(sample(target, 6).values.x).toBe(75);
    expect(sample(target, 8.5).values.x).toBeCloseTo(87.5, 12);
    expect(sample(target, 3.5).values.x).toBeCloseTo(75 * (1 - Math.SQRT1_2), 10);
  });

  it('evaluates a custom cubic bezier timing curve at fractional images', () => {
    const target = layer({ x: {
      initialValue: number(0), keys: [key(1, 0), key(11, 100)],
      transitions: [{ id: 'curve', fromFrame: 1, toFrame: 11, easing: {
        kind: 'bezier', x1: 1 / 3, y1: 0, x2: 2 / 3, y2: 0
      } }]
    } });

    // This curve has x(t) = t and y(t) = t^3, independently of the evaluator.
    expect(sample(target, 3.5).values.x).toBeCloseTo(100 / 64, 6);
    expect(sample(target, 6).values.x).toBeCloseTo(12.5, 6);
    expect(sample(target, 11).values.x).toBe(100);
  });

  it('preserves the source curve when a nonlinear tween is represented by two transitions', () => {
    const source: SourceCurve = { start: 1, end: 11, keys: [key(1, 0), key(11, 100)], easing: sineIn };
    const captured = 100 * (1 - Math.SQRT1_2);
    const target = layer({ x: {
      initialValue: number(0), keys: [key(1, 0), key(6, captured), key(11, 100)],
      transitions: [
        { id: 'left', fromFrame: 1, toFrame: 6, source },
        { id: 'right', fromFrame: 6, toFrame: 11, source }
      ]
    } });

    for (let index = 0; index <= 40; index++) {
      const frame = 1 + index / 4;
      const expected = 100 * (1 - Math.cos(((frame - 1) / 10) * Math.PI / 2));
      expect(sample(target, frame).values.x).toBeCloseTo(expected, 9);
    }
  });

  it('preserves a custom numeric interpolator through a source curve instead of rescaling captured values', () => {
    const registry = createPropertyRegistry([{
      name: 'steps', kind: 'value', unit: '', defaultValue: 0,
      interpolate: (from, to, progress) => Math.floor(from + (to - from) * progress)
    }]);
    const source: SourceCurve = { start: 1, end: 11, keys: [key(1, 0), key(11, 5)] };
    const target = layer({ steps: {
      initialValue: number(0), keys: [key(1, 0), key(6, 2), key(11, 5)],
      transitions: [
        { id: 'left', fromFrame: 1, toFrame: 6, source },
        { id: 'right', fromFrame: 6, toFrame: 11, source }
      ]
    } });

    for (const frame of [1, 2.5, 3, 4.5, 5, 6, 7, 8.5, 9, 10.5, 11]) {
      expect(sample(target, frame, { registry }).values.steps).toBe(Math.floor((frame - 1) / 2));
    }
  });

  it('keeps the first transition unchanged when the second is removed', () => {
    const keys = [key(1, 0), key(6, 40), key(11, 100)];
    const first: Transition = { id: 'first', fromFrame: 1, toFrame: 6, easing: sineIn };
    const before = layer({ x: { initialValue: number(0), keys, transitions: [
      first, { id: 'second', fromFrame: 6, toFrame: 11 }
    ] } });
    const after = layer({ x: { initialValue: number(0), keys, transitions: [first] } });

    for (const frame of [1, 2, 3.5, 5.75, 6]) {
      expect(sample(after, frame).values.x).toBe(sample(before, frame).values.x);
    }
    expect(sample(after, 8).values.x).toBe(40);
    expect(sample(after, 11).values.x).toBe(100);
  });
});

describe('typed property values and legacy compatibility', () => {
  it('holds text and boolean values and keeps them out of the numeric projection', () => {
    const target = layer({
      caption: { initialValue: { kind: 'text', value: 'Initial' }, keys: [
        { frame: 5, value: { kind: 'text', value: 'Bonjour' } }
      ] },
      enabled: { initialValue: { kind: 'boolean', value: false }, keys: [
        { frame: 5, value: { kind: 'boolean', value: true } }
      ] },
      x: { initialValue: number(0), keys: [key(5, 12)] }
    });

    expect(sample(target, 4).propertyValues).toEqual({
      caption: { kind: 'text', value: 'Initial' }, enabled: { kind: 'boolean', value: false }, x: number(0)
    });
    expect(sample(target, 20).propertyValues).toEqual({
      caption: { kind: 'text', value: 'Bonjour' }, enabled: { kind: 'boolean', value: true }, x: number(12)
    });
    expect(sample(target, 20).values).toEqual({ x: 12 });
  });

  it('preserves color values including alpha and interpolates color channels', () => {
    const start: Value = { kind: 'color', r: 1, g: 0, b: 0, a: 0.2 };
    const end: Value = { kind: 'color', r: 0, g: 0, b: 1, a: 0.8 };
    const target = layer({ color: {
      initialValue: start, keys: [{ frame: 1, value: start }, { frame: 11, value: end }],
      transitions: [{ id: 'color', fromFrame: 1, toFrame: 11 }]
    } });

    expect(sample(target, 1).propertyValues?.color).toEqual(start);
    expect(sample(target, 6).propertyValues?.color).toEqual({ kind: 'color', r: 0.5, g: 0, b: 0.5, a: 0.5 });
    expect(sample(target, 20).propertyValues?.color).toEqual(end);
    expect(sample(target, 6).values).toEqual({});
  });

  it('retains explicit legacy visibility spans when modern property timelines are present', () => {
    const target = layer({ x: { initialValue: number(7), keys: [key(6, 25)] } }, [
      { id: 'head', start: 1, end: 4, kind: 'static' },
      { id: 'hidden', start: 5, end: 7, kind: 'blank' },
      { id: 'tail', start: 8, end: 12, kind: 'static' }
    ]);

    expect(sample(target, 4)).toMatchObject({ visible: true, values: { x: 7 } });
    expect(sample(target, 6)).toMatchObject({ visible: false, values: { x: 25 } });
    expect(sample(target, 8)).toMatchObject({ visible: true, values: { x: 25 } });
    expect(sample(target, 13).visible).toBe(false);
  });

  it('does not add typed fields or change values in a legacy-only evaluated state', () => {
    const legacy: ILayer = { id: 'legacy', type: 'layer', name: 'Legacy', spans: [{
      id: 'motion', start: 1, end: 11, kind: 'tween',
      tracks: { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] }
    }] };

    expect(evaluateLayer(legacy, 6)).toEqual({
      layerId: 'legacy', visible: true, spanId: 'motion', values: { x: 50 }
    });
    expect(evaluateLayer(legacy, 12)).toEqual({
      layerId: 'legacy', visible: false, spanId: undefined, values: { x: 100 }
    });
  });
});
