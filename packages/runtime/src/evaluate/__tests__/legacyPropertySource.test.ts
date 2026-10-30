// packages/runtime/src/evaluate/__tests__/legacyPropertySource.test.ts
import { evaluateLayer } from '../evaluateLayer';
import { evaluatePropertyTimeline } from '../propertyTimeline';
import type { Easing } from '../../model/easing';
import type { ILayer } from '../../model/layer';
import type { IPropertyTimeline } from '../../model/propertyTimeline';
import { PropertyRegistry } from '../../properties/PropertyRegistry';
import type { PropertyDescriptor } from '../../properties/types';

const number = (value: number) => ({ kind: 'number' as const, value });
const rawKeys = [{ frame: 1001, value: 0 }, { frame: 1041, value: 90 }, { frame: 1101, value: 100 }];

describe('legacy retained property curves', () => {
  it.each<Easing>(['linear', 'ease-in', 'cubic-bezier(0.2, -1, 0.8, 2)'])('preserves absolute-frame arithmetic with %s', (easing) => {
    const descriptor: PropertyDescriptor = { name: 'value', kind: 'value', unit: '', defaultValue: -1,
      interpolate: (from, to, progress) => Math.floor(from + (to - from) * progress) };
    const registry = new PropertyRegistry([]).register(descriptor);
    const layer: ILayer = { id: 'layer', type: 'layer', name: 'Object', spans: [
      { id: 'blank', kind: 'blank', start: 1, end: 1000 },
      { id: 'motion', kind: 'tween', start: 1001, end: 1101, easing, tracks: { value: rawKeys } }
    ] };
    const source = { start: 1001, end: 1101, keys: rawKeys.map((key) => ({ frame: key.frame, value: number(key.value) })), legacyEasing: easing };
    const frames = [1001, 1021, 1041, 1071, 1101];
    const track: IPropertyTimeline = { initialValue: number(-1),
      keys: frames.map((frame) => ({ frame, value: number(evaluateLayer(layer, frame, { registry }).values.value) })),
      transitions: frames.slice(0, -1).map((fromFrame, index) => ({ id: `part-${index}`, fromFrame, toFrame: frames[index + 1], source })) };

    for (let frame = 999; frame < 1103; frame += 0.137) {
      expect(evaluatePropertyTimeline(track, frame, descriptor)).toEqual(number(evaluateLayer(layer, frame, { registry }).values.value));
    }
    // With these raw segments, normalization changes the custom floor result from 62 to 63.
    if (easing === 'linear') expect(evaluatePropertyTimeline(track, 1029, descriptor)).toEqual(number(62));
  });

  it('uses the same legacy linear calculation without a registry descriptor', () => {
    const keys = [{ frame: 1, value: number(2) }, { frame: 11, value: number(12) }];
    const track: IPropertyTimeline = { initialValue: number(2), keys,
      transitions: [{ id: 'legacy', fromFrame: 1, toFrame: 11, source: { start: 1, end: 11, keys, legacyEasing: 'linear' } }] };
    expect(evaluatePropertyTimeline(track, 3.5)).toEqual(number(4.5));
  });

  it.each([undefined, (() => Infinity), (() => NaN)])('refuses non-finite results from imported legacy sources (%s)', (interpolate) => {
    const keys = [{ frame: 1, value: number(-1e308) }, { frame: 11, value: number(1e308) }];
    const track: IPropertyTimeline = { initialValue: number(0), keys,
      transitions: [{ id: 'legacy', fromFrame: 1, toFrame: 11, source: { start: 1, end: 11, keys, legacyEasing: 'linear' } }] };
    const descriptor: PropertyDescriptor | undefined = interpolate === undefined ? undefined
      : { name: 'counter', kind: 'value', unit: '', defaultValue: 0, interpolate };
    expect(() => evaluatePropertyTimeline(track, 6, descriptor)).toThrow(/non-finite/);
  });
});
