// packages/editor/src/model/propertyTimelines/__tests__/capabilities.test.ts
import { evaluatePropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { IPropertyTimeline, ITargetPropertyInfo, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import { createDoc, createRegistry, layer, layerOf } from '../../spans/__tests__/fixtures';
import { PropertyTimelineCommand } from '../PropertyTimelineCommand';
import { getTargetPropertyNames } from '../../properties/targetProperties';

const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const docOf = (motion = false) => createDoc([layer('logo', [], { target: { ref: 'logo' }, propertyTimelines: {
  x: { initialValue: number(1), keys: [{ frame: 20, value: number(0.8) }, { frame: 40, value: number(0.6) }],
    ...(motion ? { transitions: [{ id: 'motion', fromFrame: 20, toFrame: 40 }] } : {}) }
} })], 100);
const context = (property: () => ITargetPropertyInfo) => ({ registry: createRegistry(),
  describe: () => ({ target: { ref: 'logo' }, label: 'Objet', properties: [property()] }) });

it('captures the host-resolved value rather than the local initial value and supports undo/redo', () => {
  const sample = jest.fn(() => number(0.8));
  const command = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 10 },
    context(() => ({ name: 'x', sample })));
  const before = docOf();
  const after = command.do(before);
  expect(layerOf(after, 'logo').propertyTimelines?.x.keys[0]).toEqual({ frame: 10, value: number(0.8) });
  expect(sample).toHaveBeenCalledWith('logo', 10);
  expect(command.undo(after)).toEqual(before);
  expect(command.do(before)).toEqual(after);
});

it('owns captured host values and refuses a type-incompatible host sample', () => {
  const value = { kind: 'number' as const, value: 0.8 };
  const command = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 10 },
    context(() => ({ name: 'x', sample: () => value })));
  const result = command.do(docOf());
  value.value = 99;
  expect(layerOf(result, 'logo').propertyTimelines?.x.keys[0].value).toEqual(number(0.8));
  const invalid = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 10 },
    context(() => ({ name: 'x', sample: () => ({ kind: 'text', value: 'bad' }) })));
  expect(() => invalid.do(docOf())).toThrow(/type/i);
});

it('does not sample an existing explicit key on capture', () => {
  const sample = jest.fn(() => { throw new Error('Unavailable'); });
  const before = docOf();
  const command = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 20 },
    context(() => ({ name: 'x', sample })));
  expect(command.do(before)).toBe(before);
  expect(sample).not.toHaveBeenCalled();
});

it('refuses a disabled property with its reason and removes it from legacy editable names', () => {
  const editContext = context(() => ({ name: 'x', editable: false, reason: 'Les valeurs du groupe diffèrent.' }));
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(7) }, editContext);
  expect(() => command.do(docOf())).toThrow('Les valeurs du groupe diffèrent.');
  expect(getTargetPropertyNames({ ref: 'logo' }, editContext)).toEqual([]);
});

it('allows held values but rejects creating or retaining a tween for a non-interpolable property', () => {
  const editContext = context(() => ({ name: 'x', interpolable: false, reason: 'Cette unité ne peut pas être interpolée.' }));
  const set = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 20, value: number(7) }, editContext);
  expect(layerOf(set.do(docOf()), 'logo').propertyTimelines?.x.keys[0].value).toEqual(number(7));
  const motion = new PropertyTimelineCommand({ kind: 'create-transition', layerId: 'logo', property: 'x', frames: [20, 40] }, editContext);
  expect(() => motion.do(docOf())).toThrow('Cette unité ne peut pas être interpolée.');
  expect(() => set.do(docOf(true))).toThrow('Cette unité ne peut pas être interpolée.');
  const remove = new PropertyTimelineCommand({ kind: 'remove-transition', layerId: 'logo', property: 'x', transitionId: 'motion' }, editContext);
  expect(layerOf(remove.do(docOf(true)), 'logo').propertyTimelines?.x.transitions).toEqual([]);
});

it('validates the proposed full track, permits warnings and rechecks current capability on redo', () => {
  let error = false;
  const validate = jest.fn(() => [{ severity: error ? 'error' as const : 'warning' as const, message: 'Période incompatible.' }]);
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 20, value: number(7) },
    context(() => ({ name: 'x', validate })));
  const before = docOf();
  const after = command.do(before);
  expect(validate).toHaveBeenCalledWith('logo', expect.objectContaining({ keys: [
    { frame: 20, value: number(7) }, { frame: 40, value: number(0.6) }
  ] }));
  expect(command.undo(after)).toEqual(before);
  error = true;
  expect(() => command.do(before)).toThrow('Période incompatible.');
});

it('refuses invalid initial host state and failures of sample or validation without mutating the document', () => {
  const before = createDoc([layer('logo', [], { target: { ref: 'logo' } })], 100);
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 10,
    value: number(7), initialValue: number(1) }, context(() => ({ name: 'x', initialValue: number(2) })));
  expect(() => command.do(before)).toThrow(/initiale/i);
  for (const property of [
    { name: 'x', sample: () => { throw new Error('Échantillon indisponible.'); } },
    { name: 'x', validate: () => { throw new Error('Validation indisponible.'); } }
  ]) {
    const capture = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 10 }, context(() => property));
    expect(() => capture.do(docOf())).toThrow(/indisponible/i);
  }
  expect(before.layers[0]).not.toHaveProperty('propertyTimelines');
});

it('rejects reentrant invalidation during host sampling or validation', () => {
  for (const callback of ['sample', 'validate'] as const) {
    let current = true;
    const metadata: ITargetPropertyInfo = callback === 'sample'
      ? { name: 'x', sample: () => { current = false; return number(0.8); } }
      : { name: 'x', validate: () => { current = false; return []; } };
    const command = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 10 }, context(() => metadata), () => current);
    expect(() => command.do(docOf())).toThrow(/contexte/i);
  }
});

it('does not expose stored keys to mutations in host validation callbacks', () => {
  const before = docOf();
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 20, value: number(7) },
    context(() => ({ name: 'x', validate: (_layerId, timeline) => {
      if (timeline === undefined) throw new Error('This edit must provide a proposed timeline.');
      const snapshot = timeline.keys[1].value;
      if (snapshot.kind === 'number') (snapshot as { value: number }).value = 999;
      return [];
    } })));
  const changed = command.do(before);
  expect(layerOf(before, 'logo').propertyTimelines?.x.keys[1].value).toEqual(number(0.6));
  expect(layerOf(changed, 'logo').propertyTimelines?.x.keys[1].value).toEqual(number(0.6));
  expect(command.undo(changed)).toEqual(before);
});

const curve: IPropertyTimeline = { initialValue: number(0), keys: [
  { frame: 1, value: number(0) }, { frame: 100, value: number(1) }
], transitions: [{ id: 'curve', fromFrame: 1, toFrame: 100 }] };
function evaluatedNumber(track: IPropertyTimeline, frame: number): number {
  const value = evaluatePropertyTimeline(track, frame);
  if (value.kind !== 'number') throw new Error('Expected a numeric value');
  return value.value;
}

it('retargets both split curves when a resolved capture differs from the local tween, with undo/redo', () => {
  const before = createDoc([layer('logo', [], { target: { ref: 'logo' }, propertyTimelines: { x: curve } })], 100);
  const command = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 50 },
    context(() => ({ name: 'x', sample: () => number(0.8) })));
  const after = command.do(before);
  const captured = layerOf(after, 'logo').propertyTimelines!.x;
  expect(evaluatedNumber(captured, 49)).toBeCloseTo(0.8 * (48 / 49), 12);
  expect(evaluatedNumber(captured, 50)).toBe(0.8);
  expect(evaluatedNumber(captured, 51)).toBeCloseTo(0.8 + 0.2 / 50, 12);
  expect(captured.transitions).toHaveLength(2);
  expect(captured.transitions?.every((transition) => transition.source === undefined)).toBe(true);
  expect(command.undo(after)).toEqual(before);
  expect(command.do(before)).toEqual(after);
});

it('retains the exact source curve when a host capture equals the local tween value', () => {
  const nonlinear: IPropertyTimeline = { ...curve, transitions: [{ id: 'curve', fromFrame: 1, toFrame: 100,
    easing: { kind: 'effect', family: 'quadratic', mode: 'in' } }] };
  const before = createDoc([layer('logo', [], { target: { ref: 'logo' }, propertyTimelines: { x: nonlinear } })], 100);
  const command = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 50 },
    context(() => ({ name: 'x', sample: () => evaluatePropertyTimeline(nonlinear, 50) })));
  const after = command.do(before);
  const captured = layerOf(after, 'logo').propertyTimelines!.x;
  expect(captured.transitions?.every((transition) => transition.source !== undefined)).toBe(true);
  for (const frame of [1, 20.25, 49, 50, 50.5, 75, 100]) {
    expect(evaluatePropertyTimeline(captured, frame)).toEqual(evaluatePropertyTimeline(nonlinear, frame));
  }
  expect(command.undo(after)).toEqual(before);
  expect(command.do(before)).toEqual(after);
});

it('refuses a changed host capture when its retained legacy easing cannot be detached faithfully', () => {
  const legacy: IPropertyTimeline = { ...curve, transitions: [{ id: 'curve', fromFrame: 1, toFrame: 100,
    source: { start: 1, end: 100, keys: curve.keys, legacyEasing: 'cubic-bezier(0.42, 200, 1, 1)' } }] };
  const before = createDoc([layer('logo', [], { target: { ref: 'logo' }, propertyTimelines: { x: legacy } })], 100);
  const command = new PropertyTimelineCommand({ kind: 'capture', layerId: 'logo', property: 'x', frame: 50 },
    context(() => ({ name: 'x', sample: () => number(0.8) })));
  expect(() => command.do(before)).toThrow(/courbe historique.*représent/i);
  expect(layerOf(before, 'logo').propertyTimelines!.x).toBe(legacy);
  expect(command.undo(before)).toBe(before);
});
