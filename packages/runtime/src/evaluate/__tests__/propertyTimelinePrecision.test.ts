// packages/runtime/src/evaluate/__tests__/propertyTimelinePrecision.test.ts
import { evaluatePropertyTimeline } from '../propertyTimeline';
import type { IPropertyTimeline } from '../../model/propertyTimeline';
import type { PropertyDescriptor } from '../../properties/types';

describe('retained source precision', () => {
  it('interpolates finite extreme endpoints without overflowing their difference', () => {
    const track: IPropertyTimeline = { initialValue: { kind: 'number', value: 0 },
      keys: [{ frame: 1, value: { kind: 'number', value: 1e308 } }, { frame: 11, value: { kind: 'number', value: -1e308 } }],
      transitions: [{ id: 'large', fromFrame: 1, toFrame: 11 }] };
    expect(evaluatePropertyTimeline(track, 6)).toEqual({ kind: 'number', value: 0 });
    const descriptor: PropertyDescriptor = { name: 'large', kind: 'value', unit: '', defaultValue: 0, min: -1, max: 1 };
    expect(evaluatePropertyTimeline(track, 6, descriptor)).toEqual({ kind: 'number', value: 0 });
    expect(evaluatePropertyTimeline(track, 3.5)).toEqual({ kind: 'number', value: 5e307 });
  });

  it('reaches an exact endpoint again during a bounce without losing its value to cancellation', () => {
    const keys = [{ frame: 1, value: { kind: 'number' as const, value: 1e16 } }, { frame: 11, value: { kind: 'number' as const, value: 1 } }];
    const track: IPropertyTimeline = { initialValue: keys[0].value, keys, transitions: [{ id: 'bounce', fromFrame: 1, toFrame: 11,
      source: { start: 1, end: 11, keys, easing: { kind: 'effect', family: 'bounce', mode: 'in', parameters: { bounces: 2, bounciness: 1 } } }
    }] };
    expect(evaluatePropertyTimeline(track, 3)).toEqual({ kind: 'number', value: 1 });
    expect(evaluatePropertyTimeline(track, 7)).toEqual({ kind: 'number', value: 1 });
  });

  it('does not round a retained easing through absolute frame coordinates before a custom interpolator', () => {
    const descriptor: PropertyDescriptor = { name: 'steps', kind: 'value', unit: '', defaultValue: 0,
      interpolate: (from, to, progress) => Math.floor(from + (to - from) * progress) };
    const keys = [{ frame: 1001, value: { kind: 'number' as const, value: 0 } }, { frame: 1101, value: { kind: 'number' as const, value: 100 } }];
    const easing = { kind: 'effect' as const, family: 'sine' as const, mode: 'in' as const };
    const original: IPropertyTimeline = { initialValue: keys[0].value, keys, transitions: [{ id: 'original', fromFrame: 1001, toFrame: 1101, easing }] };
    const source = { start: 1001, end: 1101, keys, easing };
    const split: IPropertyTimeline = { ...original, keys: [keys[0], { frame: 1051, value: evaluatePropertyTimeline(original, 1051, descriptor) }, keys[1]],
      transitions: [{ id: 'left', fromFrame: 1001, toFrame: 1051, source }, { id: 'right', fromFrame: 1051, toFrame: 1101, source }] };
    const at = 1024.961316683603;
    expect(evaluatePropertyTimeline(original, at, descriptor)).toEqual({ kind: 'number', value: 6 });
    expect(evaluatePropertyTimeline(split, at, descriptor)).toEqual(evaluatePropertyTimeline(original, at, descriptor));
  });
});
