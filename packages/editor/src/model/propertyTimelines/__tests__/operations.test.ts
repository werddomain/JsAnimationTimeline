// packages/editor/src/model/propertyTimelines/__tests__/operations.test.ts
import { evaluatePropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { IPropertyTimeline, PropertyEasing, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import { createDoc, createRegistry, expectValid, layer, layerOf } from '../../spans/__tests__/fixtures';
import { applyPropertyTimelineOperation as apply } from '../operations';
import type { PropertyTimelineOperation } from '../types';

const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const key = (frame: number, value: number) => ({ frame, value: number(value) });
const context = { registry: createRegistry() };
const ease: PropertyEasing = { kind: 'effect', family: 'quadratic', mode: 'in' };
const simple: IPropertyTimeline = { initialValue: number(-5), keys: [key(1, 0), key(21, 100)] };
const motion: IPropertyTimeline = { ...simple, transitions: [{ id: 'curve', fromFrame: 1, toFrame: 21, easing: ease }] };
const docOf = (track: IPropertyTimeline = simple) => createDoc([layer('logo', [], { propertyTimelines: { x: track } })]);
const trackOf = (doc: ReturnType<typeof createDoc>): IPropertyTimeline => layerOf(doc, 'logo').propertyTimelines!.x;

it('requires an explicit initial state and records only the requested first key', () => {
  const doc = createDoc([layer('logo', [])]);
  expect(() => apply(doc, { kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(30) }, context)).toThrow(/initial/i);
  const next = apply(doc, { kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(30), initialValue: number(2) }, context);
  expect(trackOf(next)).toEqual({ initialValue: number(2), keys: [key(10, 30)] });
  expect(evaluatePropertyTimeline(trackOf(next), 9)).toEqual(number(2));
  expect(evaluatePropertyTimeline(trackOf(next), 11)).toEqual(number(30));
  expectValid(next);
});

it('creates an equal-valued capture but an existing equal-valued key is a no-op', () => {
  const doc = docOf();
  const next = apply(doc, { kind: 'capture', layerId: 'logo', property: 'x', frame: 10 }, context);
  expect(trackOf(next).keys).toEqual([key(1, 0), key(10, 0), key(21, 100)]);
  expect(apply(next, { kind: 'capture', layerId: 'logo', property: 'x', frame: 10 }, context)).toBe(next);
  expect(apply(next, { kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(0) }, context)).toBe(next);
});

it.each<PropertyEasing>([
  ease,
  { kind: 'effect', family: 'elastic', mode: 'out', parameters: { oscillations: 3, springiness: 4 } },
  { kind: 'bezier', x1: 0.1, y1: -1.5, x2: 0.7, y2: 2.5 }
])('preserves exact fractional evaluations across repeated captures for %j', (easing) => {
  const original = { ...motion, transitions: [{ ...motion.transitions![0], easing }] };
  const doc = docOf(original);
  const once = apply(doc, { kind: 'capture', layerId: 'logo', property: 'x', frame: 7 }, context);
  const twice = apply(once, { kind: 'capture', layerId: 'logo', property: 'x', frame: 13 }, context);
  const actual = trackOf(twice);
  expect(actual.keys).toHaveLength(4);
  expect(actual.transitions).toHaveLength(3);
  expect(actual.transitions?.every((transition) => transition.source === actual.transitions?.[0].source)).toBe(true);
  for (let frame = 1; frame <= 21; frame += 0.125) {
    expect(evaluatePropertyTimeline(actual, frame)).toEqual(evaluatePropertyTimeline(original, frame));
  }
  expectValid(twice);
});

it('preserves custom floor interpolation at fractional frames when capturing', () => {
  const registry = createRegistry().register({ name: 'counter', kind: 'value', unit: '', defaultValue: 0,
    interpolate: (from, to, progress) => Math.floor(from + (to - from) * progress) });
  const doc = createDoc([layer('logo', [], { propertyTimelines: { counter: motion } })]);
  const next = apply(doc, { kind: 'capture', layerId: 'logo', property: 'counter', frame: 9 }, { registry });
  const actual = layerOf(next, 'logo').propertyTimelines!.counter;
  for (let frame = 1; frame <= 21; frame += 0.1) {
    expect(evaluatePropertyTimeline(actual, frame, registry.get('counter'))).toEqual(evaluatePropertyTimeline(motion, frame, registry.get('counter')));
  }
  expect(actual.keys).toHaveLength(3);
});

it('detaches incident curve sources so changing an inserted key takes effect', () => {
  const next = apply(docOf(motion), { kind: 'set', layerId: 'logo', property: 'x', frame: 11, value: number(70) }, context);
  const actual = trackOf(next);
  expect(actual.keys).toEqual([key(1, 0), key(11, 70), key(21, 100)]);
  expect(actual.transitions).toHaveLength(2);
  expect(actual.transitions?.every((transition) => transition.source === undefined && transition.easing === ease)).toBe(true);
  expect(evaluatePropertyTimeline(actual, 6)).toEqual(number(17.5));
  expectValid(next);
});

it('preserves unrelated property tracks and object identities', () => {
  const y = { initialValue: number(2), keys: [key(1, 20)] };
  const doc = createDoc([layer('logo', [], { propertyTimelines: { x: simple, y } }), layer('other', [])]);
  const next = apply(doc, { kind: 'set', layerId: 'logo', property: 'x', frame: 1, value: number(3) }, context);
  expect(trackOf(next).keys[0]).toEqual(key(1, 3));
  expect(layerOf(next, 'logo').propertyTimelines?.y).toBe(y);
  expect(next.layers[1]).toBe(doc.layers[1]);
  expect(next.settings).toBe(doc.settings);
  expect(trackOf(doc)).toBe(simple);
});

it('creates a unique transition from exactly two consecutive property keys', () => {
  const doc = createDoc([layer('logo', [{ id: 'logo-p2', start: 1, end: 24, kind: 'blank' }], {
    propertyTimelines: { x: simple, y: { ...simple, transitions: [{ id: 'logo-p3', fromFrame: 1, toFrame: 21 }] } }
  }), layer('logo-p1', [])]);
  const next = apply(doc, { kind: 'create-transition', layerId: 'logo', property: 'x', frames: [21, 1], easing: ease }, context);
  expect(trackOf(next).transitions).toEqual([{ id: 'logo-p4', fromFrame: 1, toFrame: 21, easing: ease }]);
  expectValid(next);
});

it.each([[1], [1, 1], [1, 10, 21], [1, 21], [1, 8]].map((frames) => ({ frames })))('refuses an invalid selected pair $frames', ({ frames }) => {
  const doc = docOf({ ...simple, keys: [key(1, 0), key(10, 5), key(21, 100)] });
  expect(() => apply(doc, { kind: 'create-transition', layerId: 'logo', property: 'x', frames }, context)).toThrow();
});

it('refuses deleting a connected key until its transition is removed explicitly', () => {
  const doc = docOf(motion);
  expect(() => apply(doc, { kind: 'delete-key', layerId: 'logo', property: 'x', frame: 1 }, context)).toThrow(/interpolation|transition/i);
  const unlinked = apply(doc, { kind: 'remove-transition', layerId: 'logo', property: 'x', transitionId: 'curve' }, context);
  const deleted = apply(unlinked, { kind: 'delete-key', layerId: 'logo', property: 'x', frame: 1 }, context);
  expect(trackOf(deleted).keys).toEqual([key(21, 100)]);
  const empty = apply(deleted, { kind: 'delete-key', layerId: 'logo', property: 'x', frame: 21 }, context);
  expect(Object.keys(layerOf(empty, 'logo').propertyTimelines ?? {})).toEqual([]);
});

it('moves an existing key without crossing neighbors and updates incident transitions', () => {
  const captured = apply(docOf(motion), { kind: 'capture', layerId: 'logo', property: 'x', frame: 11 }, context);
  for (const toFrame of [1, 21, 22, 0, 25, 5.5]) {
    expect(() => apply(captured, { kind: 'move-key', layerId: 'logo', property: 'x', frame: 11, toFrame }, context)).toThrow();
  }
  const moved = apply(captured, { kind: 'move-key', layerId: 'logo', property: 'x', frame: 11, toFrame: 9 }, context);
  expect(trackOf(moved).keys.map(({ frame }) => frame)).toEqual([1, 9, 21]);
  expect(trackOf(moved).transitions?.map(({ fromFrame, toFrame, source }) => [fromFrame, toFrame, source])).toEqual([[1, 9, undefined], [9, 21, undefined]]);
  expect(apply(moved, { kind: 'move-key', layerId: 'logo', property: 'x', frame: 9, toFrame: 9 }, context)).toBe(moved);
  expectValid(moved);
});

it('changes an easing on only one split transition and makes the chosen effect effective', () => {
  const captured = apply(docOf(motion), { kind: 'capture', layerId: 'logo', property: 'x', frame: 11 }, context);
  const transitions = trackOf(captured).transitions!;
  const changed = apply(captured, { kind: 'set-easing', layerId: 'logo', property: 'x', transitionId: transitions[0].id }, context);
  expect(trackOf(changed).transitions?.[0].source).toBeUndefined();
  expect(trackOf(changed).transitions?.[0].easing).toBeUndefined();
  expect(trackOf(changed).transitions?.[1]).toBe(transitions[1]);
  expect(evaluatePropertyTimeline(trackOf(changed), 6)).toEqual(number(12.5));
  expect(apply(changed, { kind: 'set-easing', layerId: 'logo', property: 'x', transitionId: transitions[0].id }, context)).toBe(changed);
});

it('allows self-described rich properties, respecting explicit stage metadata', () => {
  const doc = createDoc([layer('logo', [], { target: { ref: 'object' } })]);
  const operation = { kind: 'set', layerId: 'logo', property: 'caption', frame: 5,
    value: { kind: 'text', value: 'Bonjour' }, initialValue: { kind: 'text', value: 'Salut' } } as const;
  const describe = () => ({ label: 'Object', target: { ref: 'object' }, properties: ['caption'] });
  const next = apply(doc, operation, { ...context, describe });
  expect(layerOf(next, 'logo').propertyTimelines?.caption.keys[0].value).toEqual(operation.value);
  expect(() => apply(doc, operation, { ...context, describe: () => ({ label: 'Object', target: { ref: 'object' }, properties: [] }) })).toThrow();
  expect(() => apply(doc, operation, { ...context, listTargets: () => [{ label: 'Object', target: { ref: 'object' }, properties: ['x'] }] })).toThrow();
  expectValid(next);
});

it.each(['text', 'boolean'] as const)('refuses interpolation for %s values', (kind) => {
  const value: TimelinePropertyValue = kind === 'text' ? { kind, value: 'a' } : { kind, value: true };
  const doc = docOf({ initialValue: value, keys: [{ frame: 1, value }, { frame: 21, value }] });
  expect(() => apply(doc, { kind: 'create-transition', layerId: 'logo', property: 'x', frames: [1, 21] }, context)).toThrow();
});

it.each(['constructor', '__proto__', 'prototype', '', 'not-valid'])('rejects unsafe property name %s', (property) => {
  expect(() => apply(createDoc([layer('logo', [])]), { kind: 'capture', layerId: 'logo', property, frame: 1, initialValue: number(0) }, context)).toThrow();
});

it.each([0, 25, 1.5, Infinity, NaN])('rejects invalid key frame %s', (frame) => {
  expect(() => apply(docOf(), { kind: 'capture', layerId: 'logo', property: 'x', frame }, context)).toThrow();
});

it('requires explicit migration and refuses locked ancestor edits', () => {
  const legacy = createDoc([layer('logo', [{ id: 'legacy', kind: 'static', start: 1, end: 24, tracks: { x: [{ frame: 1, value: 3 }] } }])]);
  expect(() => apply(legacy, { kind: 'capture', layerId: 'logo', property: 'x', frame: 10, initialValue: number(0) }, context)).toThrow(/migr/i);
  const locked = createDoc([{ id: 'folder', type: 'folder', name: 'Folder', locked: true, children: docOf().layers }]);
  expect(() => apply(locked, { kind: 'set', layerId: 'logo', property: 'x', frame: 1, value: number(5) }, context)).toThrow(/verrouill/i);
});

it('rejects changing value kind or overwriting a recorded initial state', () => {
  expect(() => apply(docOf(), { kind: 'set', layerId: 'logo', property: 'x', frame: 1, value: { kind: 'text', value: 'wrong' } }, context)).toThrow();
  expect(() => apply(docOf(), { kind: 'capture', layerId: 'logo', property: 'x', frame: 1, initialValue: number(99) }, context)).toThrow();
});

it('retains the source when setting a new key to exactly its evaluated value', () => {
  const next = apply(docOf(motion), { kind: 'set', layerId: 'logo', property: 'x', frame: 11, value: number(25) }, context);
  expect(trackOf(next).transitions?.every((transition) => transition.source !== undefined)).toBe(true);
  for (let frame = 1; frame <= 21; frame += 0.125) {
    expect(evaluatePropertyTimeline(trackOf(next), frame)).toEqual(evaluatePropertyTimeline(motion, frame));
  }
});

it('detaches only transitions incident to an edited existing key', () => {
  const once = apply(docOf(motion), { kind: 'capture', layerId: 'logo', property: 'x', frame: 7 }, context);
  const twice = apply(once, { kind: 'capture', layerId: 'logo', property: 'x', frame: 13 }, context);
  const previous = trackOf(twice).transitions!;
  const changed = apply(twice, { kind: 'set', layerId: 'logo', property: 'x', frame: 7, value: number(80) }, context);
  expect(trackOf(changed).transitions?.slice(0, 2).every((transition) => transition.source === undefined)).toBe(true);
  expect(trackOf(changed).transitions?.[2]).toBe(previous[2]);
  expect(evaluatePropertyTimeline(trackOf(changed), 7)).toEqual(number(80));
});

it('uses unknown rich color values without the numeric registry and keeps alpha interpolation', () => {
  const transparent: TimelinePropertyValue = { kind: 'color', r: 0, g: 0, b: 1, a: 0 };
  const opaque: TimelinePropertyValue = { kind: 'color', r: 1, g: 0, b: 0, a: 1 };
  const doc = createDoc([layer('logo', [])]);
  const first = apply(doc, { kind: 'capture', layerId: 'logo', property: 'fill', frame: 1, initialValue: transparent }, context);
  const second = apply(first, { kind: 'set', layerId: 'logo', property: 'fill', frame: 21, value: opaque }, context);
  const animated = apply(second, { kind: 'create-transition', layerId: 'logo', property: 'fill', frames: [1, 21] }, context);
  const captured = apply(animated, { kind: 'capture', layerId: 'logo', property: 'fill', frame: 11 }, context);
  const actual = layerOf(captured, 'logo').propertyTimelines!.fill;
  expect(actual.keys[1].value).toEqual({ kind: 'color', r: 0.5, g: 0, b: 0.5, a: 0.5 });
  expect(evaluatePropertyTimeline(actual, 16)).toEqual({ kind: 'color', r: 0.75, g: 0, b: 0.25, a: 0.75 });
  expectValid(captured);
});

it('treats prototype-inherited property names as absent until explicitly recorded', () => {
  const doc = createDoc([layer('logo', [])]);
  const next = apply(doc, { kind: 'capture', layerId: 'logo', property: 'toString', frame: 5,
    initialValue: { kind: 'text', value: 'A' } }, context);
  expect(Object.prototype.hasOwnProperty.call(layerOf(next, 'logo').propertyTimelines, 'toString')).toBe(true);
  expectValid(next);
});

it.each([
  undefined, null, { kind: 'number', value: Infinity }, { kind: 'number', value: NaN },
  { kind: 'number', value: '3' }, { kind: 'number', value: 3, extra: true },
  { kind: 'text', value: false }, { kind: 'boolean', value: 'false' },
  { kind: 'color', r: 1, g: 0, b: 0, a: 2 }, { kind: 'color', r: 1, g: 0, b: 0 },
  { kind: 'color', r: 1, g: 0, b: NaN, a: 0 }, { kind: 'object', value: {} }
])('rejects malformed typed values %j', (value) => {
  const doc = docOf();
  expect(() => apply(doc, { kind: 'set', layerId: 'logo', property: 'x', frame: 1,
    value: value as TimelinePropertyValue }, context)).toThrow();
  expect(trackOf(doc)).toBe(simple);
});

it.each([
  { kind: 'bezier', x1: -1, y1: 0, x2: 1, y2: 1 },
  { kind: 'effect', family: 'unknown', mode: 'in' },
  { kind: 'effect', family: 'elastic', mode: 'out', parameters: { oscillations: 1.5 } },
  { kind: 'effect', family: 'bounce', mode: 'in', parameters: { amplitude: 1 } },
  { kind: 'effect', family: 'back', mode: 'in', parameters: { amplitude: Infinity } }
])('rejects invalid effects without changing an existing transition %j', (easing) => {
  const doc = docOf(motion);
  expect(() => apply(doc, { kind: 'set-easing', layerId: 'logo', property: 'x', transitionId: 'curve',
    easing: easing as PropertyEasing }, context)).toThrow();
  expect(trackOf(doc)).toBe(motion);
});

it.each<PropertyTimelineOperation>([
  { kind: 'set', layerId: 'missing', property: 'x', frame: 1, value: number(1) },
  { kind: 'capture', layerId: 'folder', property: 'x', frame: 1, initialValue: number(1) },
  { kind: 'delete-key', layerId: 'logo', property: 'x', frame: 10 },
  { kind: 'move-key', layerId: 'logo', property: 'x', frame: 10, toFrame: 12 },
  { kind: 'delete-key', layerId: 'logo', property: 'missing', frame: 1 },
  { kind: 'remove-transition', layerId: 'logo', property: 'x', transitionId: 'missing' },
  { kind: 'set-easing', layerId: 'logo', property: 'x', transitionId: 'missing' }
])('refuses a missing layer, property, key or transition for $kind', (operation) => {
  const doc = createDoc([...docOf().layers, { id: 'folder', type: 'folder', name: 'Folder', children: [] }]);
  expect(() => apply(doc, operation, context)).toThrow();
});

it('refuses a second transition instead of replacing the original effect silently', () => {
  const doc = docOf(motion);
  expect(() => apply(doc, { kind: 'create-transition', layerId: 'logo', property: 'x', frames: [1, 21] }, context)).toThrow(/existe déjà/);
  expect(trackOf(doc)).toBe(motion);
});

it('does not share a pure operation input value, baseline or nested effect with its result', () => {
  const value = { kind: 'number' as const, value: 20 };
  const initialValue = { kind: 'number' as const, value: 3 };
  const first = apply(createDoc([layer('logo', [])]), { kind: 'set', layerId: 'logo', property: 'x', frame: 1, value, initialValue }, context);
  const second = apply(first, { kind: 'set', layerId: 'logo', property: 'x', frame: 21, value: number(100) }, context);
  const easing = { kind: 'effect' as const, family: 'back' as const, mode: 'in' as const, parameters: { amplitude: 2 } };
  const next = apply(second, { kind: 'create-transition', layerId: 'logo', property: 'x', frames: [1, 21], easing }, context);
  value.value = 99;
  initialValue.value = 88;
  easing.parameters.amplitude = 7;
  expect(trackOf(next).initialValue).toEqual(number(3));
  expect(trackOf(next).keys[0].value).toEqual(number(20));
  expect(trackOf(next).transitions?.[0].easing).toEqual({ ...easing, parameters: { amplitude: 2 } });
});

it('reports an evaluation failure without leaving partial split transitions', () => {
  const registry = createRegistry().register({ name: 'counter', kind: 'value', defaultValue: 0, unit: '',
    interpolate: () => { throw new Error('Bad interpolator'); } });
  const doc = createDoc([layer('logo', [], { propertyTimelines: { counter: motion } })]);
  expect(() => apply(doc, { kind: 'capture', layerId: 'logo', property: 'counter', frame: 11 }, { registry })).toThrow(/Impossible de calculer/);
  expect(layerOf(doc, 'logo').propertyTimelines?.counter).toBe(motion);
});

it('rejects an unknown operation with a domain refusal', () => {
  expect(() => apply(docOf(), { kind: 'unexpected', layerId: 'logo', property: 'x' } as unknown as PropertyTimelineOperation, context)).toThrow(/opération.*inconnue/);
});
