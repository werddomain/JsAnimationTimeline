// packages/export-css/src/continuous/__tests__/timeline.test.ts
import { evaluatePropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { IPropertyTimeline, PropertyDescriptor, PropertyEasing } from '@kazo-ca/timeline-runtime';
import { analyzeTimeline, timelineTiming } from '../timeline';

const value = (number: number) => ({ kind: 'number' as const, value: number });
const key = (frame: number, number: number) => ({ frame, value: value(number) });
const track = (easing?: PropertyEasing): IPropertyTimeline => ({ initialValue: value(7), keys: [key(10, 0), key(80, 100)],
  transitions: [{ id: 'motion', fromFrame: 10, toFrame: 80, easing }] });

describe('continuous CSS timeline analysis', () => {
  it('preserves the initial hold, exact key boundaries and final hold without epsilon', () => {
    const plan = analyzeTimeline(track(), 100);
    expect(plan.frames).toEqual([1, 10, 80, 101]);
    expect(timelineTiming(plan, 1, 10)).toBe('steps(1, end)');
    expect(timelineTiming(plan, 10, 80)).toBe('linear');
    expect(timelineTiming(plan, 80, 101)).toBe('steps(1, end)');
    expect(evaluatePropertyTimeline(track(), 9.999)).toEqual(value(7));
    expect(evaluatePropertyTimeline(track(), 10)).toEqual(value(0));
  });

  it('preserves a direct Bezier instead of fitting sampled frames', () => {
    const easing: PropertyEasing = { kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
    const plan = analyzeTimeline(track(easing), 100);
    expect(timelineTiming(plan, 10, 80)).toBe('cubic-bezier(0.42, 0, 0.58, 1)');
    expect(() => timelineTiming(plan, 10, 50)).toThrow(/découpée/);
  });

  it('refuses an effect, custom interpolation and numeric clamping that would change the curve', () => {
    expect(() => analyzeTimeline(track({ kind: 'effect', family: 'elastic', mode: 'out' }), 100)).toThrow(/courbe/);
    const descriptor: PropertyDescriptor = { name: 'value', kind: 'value', unit: '', defaultValue: 0, min: 10, max: 80 };
    expect(() => analyzeTimeline(track(), 100, descriptor)).toThrow(/bornage/);
    expect(() => analyzeTimeline(track(), 100, { ...descriptor, min: undefined, max: undefined, interpolate: (a, b, p) => a + (b - a) * p * p })).toThrow(/personnalisé/);
  });

  it('accepts held text and color but refuses their continuous interpolation', () => {
    const color = { kind: 'color' as const, r: 1, g: 0, b: 0, a: 0.5 };
    const held: IPropertyTimeline = { initialValue: color, keys: [{ frame: 20, value: color }, { frame: 50, value: { ...color, r: 0, b: 1 } }] };
    expect(timelineTiming(analyzeTimeline(held, 100), 20, 50)).toBe('steps(1, end)');
    expect(() => analyzeTimeline({ ...held, transitions: [{ id: 'color', fromFrame: 20, toFrame: 50 }] }, 100)).toThrow(/numériques/);
    expect(analyzeTimeline({ initialValue: { kind: 'text', value: 'solid' }, keys: [{ frame: 40, value: { kind: 'text', value: 'dashed' } }] }, 100).frames).toEqual([1, 40, 101]);
  });

  it('exports a retained linear source and preserves its intermediate slope changes', () => {
    const source = { start: 1, end: 100, keys: [key(1, 0), key(50, 20), key(100, 100)] };
    const timeline: IPropertyTimeline = { initialValue: value(0), keys: [key(1, 0), key(25, 20 * 24 / 49), key(100, 100)], transitions: [
      { id: 'left', fromFrame: 1, toFrame: 25, source }, { id: 'right', fromFrame: 25, toFrame: 100, source }
    ] };
    const plan = analyzeTimeline(timeline, 100);
    expect(plan.frames).toEqual([1, 25, 50, 100, 101]);
    expect(timelineTiming(plan, 25, 50)).toBe('linear');
    expect(timelineTiming(plan, 50, 100)).toBe('linear');
    expect(() => analyzeTimeline({ ...timeline, keys: [key(1, 0), key(25, 999), key(100, 100)] }, 100)).toThrow(/source/);
    expect(() => analyzeTimeline({ ...timeline, transitions: [{ id: 'only', fromFrame: 1, toFrame: 25, source: { ...source, easing: { kind: 'bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 } } }] }, 100)).toThrow(/source/);
  });
});
