// packages/editor/src/model/propertyTimelines/__tests__/legacyMigration.test.ts
import { evaluateLayer, PropertyRegistry, validateDocument } from '@kazo-ca/timeline-runtime';
import type { Easing, ILayer, ISpan, ITimelineDocument, PropertyDescriptor } from '@kazo-ca/timeline-runtime';
import { migrateLegacyProperty } from '../legacyMigration';
import { PropertyOperationError } from '../../properties/propertyValue';
import { applyPropertyTimelineOperation } from '../operations';

const descriptor: PropertyDescriptor = { name: 'value', kind: 'value', unit: '', defaultValue: 5 };
const registry = new PropertyRegistry([]).register(descriptor).register({ ...descriptor, name: 'other' });
const layer = (spans: readonly ISpan[]): ILayer => ({ id: 'layer', name: 'Object', type: 'layer', spans });
const document = (item: ILayer): ITimelineDocument => ({ version: '2.0.0', settings: { fps: 24, totalFrames: 1200 }, layers: [item] });
const motion = (easing: Easing = 'linear'): ISpan => ({ id: 'motion', kind: 'tween', start: 1001, end: 1101, easing,
  tracks: { value: [{ frame: 1001, value: 0 }, { frame: 1041, value: 90 }, { frame: 1101, value: 100 }], other: [{ frame: 1001, value: 7 }] } });
const lead: ISpan = { id: 'lead', kind: 'blank', start: 1, end: 1000 };
const tail: ISpan = { id: 'tail', kind: 'static', start: 1102, end: 1200, tracks: { other: [{ frame: 1102, value: 3 }] } };

function expectSameValues(before: ILayer, after: ILayer, properties = registry): void {
  for (let frame = 999; frame <= 1201; frame += 0.137) {
    const original = evaluateLayer(before, frame, { registry: properties });
    const migrated = evaluateLayer(after, frame, { registry: properties });
    expect(migrated.values).toEqual(original.values);
    expect(migrated.visible).toBe(original.visible);
    expect(migrated.spanId).toBe(original.spanId);
  }
  for (const frame of [0, 1, 1000, 1001, 1041, 1101, 1101.9, 1102, 1200, 1201]) {
    expect(evaluateLayer(after, frame, { registry: properties }).values).toEqual(evaluateLayer(before, frame, { registry: properties }).values);
  }
}

describe('explicit per-property legacy migration', () => {
  it.each<Easing>(['linear', 'ease-in', 'ease-out', 'cubic-bezier(0.2, -1, 0.8, 2)'])('preserves %s at fractional frames, raw interior keys, visibility and other properties', (easing) => {
    const original = layer([lead, motion(easing), tail]);
    const doc = document(original);
    const snapshot = JSON.stringify(doc);
    const result = migrateLegacyProperty(doc, original, 'value', registry);

    expectSameValues(original, result);
    expect(JSON.stringify(doc)).toBe(snapshot);
    expect(result.spans[0]).toBe(lead);
    expect(result.spans[2]).toBe(tail);
    expect(result.spans[1].tracks?.other).toBe(original.spans[1].tracks?.other);
    expect(result.spans[1].tracks).not.toHaveProperty('value');
    expect(result.propertyTimelines?.value.initialValue).toEqual({ kind: 'number', value: 5 });
    expect(result.propertyTimelines?.value.transitions).toHaveLength(2);
    expect(result.propertyTimelines?.value.transitions?.[0].source).toEqual({ start: 1001, end: 1101,
      keys: original.spans[1].tracks?.value.map((key) => ({ frame: key.frame, value: { kind: 'number', value: key.value } })), legacyEasing: easing });
    expect(validateDocument(document(result))).toEqual([]);
  });

  it('captures actual eased values at existing key positions instead of their old raw values', () => {
    const original = layer([lead, motion('ease-in'), tail]);
    const result = migrateLegacyProperty(document(original), original, 'value', registry);
    const middle = result.propertyTimelines?.value.keys[1].value;
    expect(middle).toEqual({ kind: 'number', value: evaluateLayer(original, 1041, { registry }).values.value });
    expect(middle).not.toEqual({ kind: 'number', value: 90 });
  });

  it('preserves the original legacy curve through repeated capture splits after migration', () => {
    const properties = new PropertyRegistry([]).register({ ...descriptor,
      interpolate: (from, to, progress) => Math.floor(from + (to - from) * progress) }).register({ ...descriptor, name: 'other' });
    const original = layer([lead, motion(), tail]);
    const migrated = migrateLegacyProperty(document(original), original, 'value', properties);
    let doc = document(migrated);
    for (const frame of [1029, 1085]) {
      doc = applyPropertyTimelineOperation(doc, { kind: 'capture', layerId: 'layer', property: 'value', frame }, { registry: properties });
    }
    const result = doc.layers[0] as ILayer;
    expect(result.propertyTimelines?.value.keys.find((key) => key.frame === 1029)?.value).toEqual({ kind: 'number', value: 62 });
    expect(result.propertyTimelines?.value.transitions).toHaveLength(4);
    expectSameValues(original, result, properties);
    expect(validateDocument(doc)).toEqual([]);
  });

  it('preserves custom floor interpolation and bounded overshoot', () => {
    const properties = new PropertyRegistry([]).register({ ...descriptor, min: 0, max: 100,
      interpolate: (from, to, progress) => Math.floor(from + (to - from) * progress) }).register({ ...descriptor, name: 'other' });
    const original = layer([lead, motion('cubic-bezier(0.2, -1, 0.8, 2)'), tail]);
    const result = migrateLegacyProperty(document(original), original, 'value', properties);
    expectSameValues(original, result, properties);
  });

  it('migrates static holds across blank spans and keeps all original span metadata', () => {
    const original = layer([
      { id: 'a', kind: 'static', start: 1, end: 1000, tracks: { value: [{ frame: 1, value: 10 }] } },
      { id: 'hidden', kind: 'blank', start: 1001, end: 1049 },
      { id: 'b', kind: 'static', start: 1050, end: 1200, tracks: { value: [{ frame: 1050, value: 20 }] } }
    ]);
    const result = migrateLegacyProperty(document(original), original, 'value', registry);
    expectSameValues(original, result);
    expect(result.propertyTimelines?.value.keys).toEqual([
      { frame: 1, value: { kind: 'number', value: 10 } }, { frame: 1050, value: { kind: 'number', value: 20 } }
    ]);
    expect(result.propertyTimelines?.value.transitions).toBeUndefined();
  });

  it('migrates an empty legacy track as a held registry default', () => {
    const original = layer([{ id: 'empty', kind: 'tween', start: 1, end: 1200, tracks: { value: [] } }]);
    const result = migrateLegacyProperty(document(original), original, 'value', registry);
    expectSameValues(original, result);
    expect(result.propertyTimelines?.value.keys).toEqual([]);
  });

  it.each([
    ['implicit start', { ...motion(), tracks: { value: [{ frame: 1050, value: 10 }, { frame: 1101, value: 100 }] } }],
    ['missing end', { ...motion(), tracks: { value: [{ frame: 1001, value: 0 }, { frame: 1050, value: 10 }] } }],
    ['uneditable easing', motion('cubic-bezier(0.2, -101, 0.8, 2)')],
    ['unstable range', { ...motion(), tracks: { value: [{ frame: 1001, value: -1e308 }, { frame: 1101, value: 1e308 }] } }]
  ])('refuses %s without touching the original layer', (_label, span) => {
    const original = layer([lead, span, tail]);
    const snapshot = JSON.stringify(original);
    expect(() => migrateLegacyProperty(document(original), original, 'value', registry)).toThrow(PropertyOperationError);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('refuses histories mixing a tween and another explicit content value', () => {
    const original = layer([lead, motion(), { ...tail, tracks: { value: [{ frame: 1102, value: 50 }] } }]);
    expect(() => migrateLegacyProperty(document(original), original, 'value', registry)).toThrow(/plusieurs plages/);
  });

  it('refuses raw legacy holds that modern descriptor bounds would alter', () => {
    const properties = new PropertyRegistry([]).register({ ...descriptor, defaultValue: 0, min: 0, max: 1 });
    const original = layer([{ id: 'a', kind: 'static', start: 1, end: 1200, tracks: { value: [{ frame: 1, value: 2 }] } }]);
    expect(() => migrateLegacyProperty(document(original), original, 'value', properties)).toThrow(/bornes/);
  });

  it('refuses a registry default outside modern descriptor bounds', () => {
    const properties = new PropertyRegistry([]).register({ ...descriptor, defaultValue: 5, min: 0, max: 1 });
    const original = layer([{ id: 'a', kind: 'static', start: 1, end: 1200, tracks: { value: [{ frame: 1, value: 0 }] } }]);
    expect(() => migrateLegacyProperty(document(original), original, 'value', properties)).toThrow(/bornes/);
  });

  it('refuses custom interpolators whose endpoint differs from the raw held value', () => {
    const properties = new PropertyRegistry([]).register({ ...descriptor, interpolate: (from, to, progress) => from + (to - from) * progress + 1 });
    const original = layer([lead, { ...motion(), tracks: { value: motion().tracks!.value } }]);
    expect(() => migrateLegacyProperty(document(original), original, 'value', properties)).toThrow(/extrémités/);
  });

  it('turns a throwing custom interpolator into a business refusal', () => {
    const properties = new PropertyRegistry([]).register({ ...descriptor, interpolate: () => { throw new Error('Internal adapter failure'); } });
    const original = layer([lead, { ...motion(), tracks: { value: motion().tracks!.value } }]);
    expect(() => migrateLegacyProperty(document(original), original, 'value', properties)).toThrow(PropertyOperationError);
  });

  it('keeps registered prototype-like property names as own properties', () => {
    const properties = new PropertyRegistry([]).register({ ...descriptor, name: 'toString' });
    const original = layer([{ id: 'a', kind: 'static', start: 1, end: 1200, tracks: { toString: [{ frame: 1, value: 12 }] } }]);
    const result = migrateLegacyProperty(document(original), original, 'toString', properties);
    expect(Object.prototype.hasOwnProperty.call(result.propertyTimelines, 'toString')).toBe(true);
    expect(evaluateLayer(result, 50, { registry: properties }).values['toString']).toBe(12);
    expect(validateDocument(document(result))).toEqual([]);
  });

  it('allocates deterministic transition ids without colliding with spans or existing property transitions', () => {
    const original = { ...layer([{ ...lead, id: 'layer-p1' }, motion(), tail]), propertyTimelines: {
      existing: { initialValue: { kind: 'number' as const, value: 0 },
        keys: [{ frame: 1, value: { kind: 'number' as const, value: 0 } }, { frame: 2, value: { kind: 'number' as const, value: 1 } }],
        transitions: [{ id: 'layer-p2', fromFrame: 1, toFrame: 2 }] }
    } };
    const result = migrateLegacyProperty(document(original), original, 'value', registry);
    expect(result.propertyTimelines?.value.transitions?.map((transition) => transition.id)).toEqual(['layer-p3', 'layer-p4']);
    expect(migrateLegacyProperty(document(original), original, 'value', registry)).toEqual(result);
    expect(result.propertyTimelines?.existing).toBe(original.propertyTimelines.existing);
    expect(validateDocument(document(result))).toEqual([]);
  });

  it('rejects a missing track and preserves an already modern track by reference', () => {
    const original = layer([]);
    expect(() => migrateLegacyProperty(document(original), original, 'value', registry)).toThrow(PropertyOperationError);
    const modern = { ...original, propertyTimelines: { value: { initialValue: { kind: 'number' as const, value: 5 }, keys: [] } } };
    expect(migrateLegacyProperty(document(modern), modern, 'value', registry)).toBe(modern);
  });
});
