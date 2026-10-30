// packages/editor/src/model/propertyTimelines/__tests__/PropertyTimelineCommand.test.ts
import type { IPropertyTimeline, ITimelineDocument, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import { createDoc, createRegistry, expectValid, layer, layerOf } from '../../spans/__tests__/fixtures';
import { PropertyTimelineCommand } from '../PropertyTimelineCommand';
import type { PropertyTimelineOperation } from '../types';

const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const track: IPropertyTimeline = { initialValue: number(0), keys: [{ frame: 1, value: number(0) }, { frame: 21, value: number(100) }] };
const context = { registry: createRegistry() };
const docOf = (motion = false): ITimelineDocument => createDoc([layer('logo', [], { target: { ref: 'object' }, propertyTimelines: {
  x: motion ? { ...track, transitions: [{ id: 'curve', fromFrame: 1, toFrame: 21 }] } : track
} })]);

const cases: readonly { operation: PropertyTimelineOperation; motion?: boolean }[] = [
  { operation: { kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(7) } },
  { operation: { kind: 'capture', layerId: 'logo', property: 'x', frame: 10 }, motion: true },
  { operation: { kind: 'delete-key', layerId: 'logo', property: 'x', frame: 1 } },
  { operation: { kind: 'move-key', layerId: 'logo', property: 'x', frame: 21, toFrame: 20 }, motion: true },
  { operation: { kind: 'create-transition', layerId: 'logo', property: 'x', frames: [1, 21] } },
  { operation: { kind: 'remove-transition', layerId: 'logo', property: 'x', transitionId: 'curve' }, motion: true },
  { operation: { kind: 'set-easing', layerId: 'logo', property: 'x', transitionId: 'curve', easing: { kind: 'effect', family: 'back', mode: 'in' } }, motion: true }
];

it.each(cases)('undoes and redoes $operation.kind with the exact original layer snapshot', ({ operation, motion }) => {
  const doc = docOf(motion);
  const command = new PropertyTimelineCommand(operation, context);
  const changed = command.do(doc);
  expect(changed).not.toBe(doc);
  expectValid(changed);
  const undone = command.undo(changed);
  expect(undone).toEqual(doc);
  expect(undone.layers[0]).toBe(doc.layers[0]);
  expect(command.do(undone)).toEqual(changed);
});

it('snapshots values at construction and never shares mutable caller data with a result', () => {
  const value = { kind: 'number' as const, value: 7 };
  const initialValue = { kind: 'number' as const, value: 2 };
  const operation = { kind: 'set' as const, layerId: 'logo', property: 'counter', frame: 10, value, initialValue };
  const command = new PropertyTimelineCommand(operation, context);
  value.value = 99;
  initialValue.value = 44;
  operation.frame = 15;
  const doc = createDoc([layer('logo', [])]);
  const changed = command.do(doc);
  expect(layerOf(changed, 'logo').propertyTimelines?.counter).toEqual({ initialValue: number(2), keys: [{ frame: 10, value: number(7) }] });
  expect(command.do(command.undo(changed))).toEqual(changed);
});

it('snapshots selected frames and nested easing parameters for redo', () => {
  const frames = [1, 21];
  const parameters = { amplitude: 2 };
  const easing = { kind: 'effect' as const, family: 'back' as const, mode: 'out' as const, parameters };
  const command = new PropertyTimelineCommand({ kind: 'create-transition', layerId: 'logo', property: 'x', frames, easing }, context);
  frames.push(15);
  parameters.amplitude = 8;
  const changed = command.do(docOf());
  expect(layerOf(changed, 'logo').propertyTimelines?.x.transitions?.[0].easing).toEqual({ ...easing, parameters: { amplitude: 2 } });
  expect(command.do(command.undo(changed))).toEqual(changed);
});

it('rechecks target metadata on redo and returns a French command refusal', () => {
  let allowed = true;
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(7) }, {
    ...context, describe: () => ({ label: 'Object', target: { ref: 'object' }, properties: allowed ? ['x'] : [] })
  });
  const changed = command.do(docOf());
  const undone = command.undo(changed);
  allowed = false;
  expect(() => command.do(undone)).toThrow(CommandRefusedError);
  expect(() => command.do(undone)).toThrow(/modifiable/);
  expect(undone).toEqual(docOf());
});

it('rechecks locks on redo and leaves unrelated layers unchanged during undo', () => {
  const doc = docOf();
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(7) }, context);
  const changed = command.do(doc);
  const other = layer('other', []);
  const undone = command.undo({ ...changed, layers: [...changed.layers, other] });
  expect(undone.layers[0]).toBe(doc.layers[0]);
  expect(undone.layers[1]).toBe(other);
  const locked = { ...undone, layers: [{ ...layerOf(undone, 'logo'), locked: true }, other] };
  expect(() => command.do(locked)).toThrow(CommandRefusedError);
  expect(locked.layers[0].locked).toBe(true);
});

it('keeps no-op commands identity-preserving and does not restore a stale snapshot', () => {
  const doc = docOf();
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 1, value: number(0) }, context);
  expect(command.do(doc)).toBe(doc);
  expect(command.undo(doc)).toBe(doc);
});

it('migrates explicitly and restores the complete legacy property on undo', () => {
  const doc = createDoc([layer('logo', [{ id: 'legacy', kind: 'tween', start: 1, end: 21, easing: 'ease-in', tracks: {
    x: [{ frame: 1, value: 0 }, { frame: 21, value: 100 }], y: [{ frame: 1, value: 5 }]
  } }])]);
  const command = new PropertyTimelineCommand({ kind: 'migrate', layerId: 'logo', property: 'x' }, context);
  const changed = command.do(doc);
  expect(layerOf(changed, 'logo').spans[0].tracks).toEqual({ y: [{ frame: 1, value: 5 }] });
  expect(layerOf(changed, 'logo').propertyTimelines?.x.transitions).toHaveLength(1);
  const undone = command.undo(changed);
  expect(undone.layers[0]).toBe(doc.layers[0]);
  expect(undone).toEqual(doc);
  expect(command.do(undone)).toEqual(changed);
  expectValid(changed);
});

it('clears a prior snapshot when the same command becomes a no-op', () => {
  const doc = docOf();
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x', frame: 10, value: number(7) }, context);
  const changed = command.do(doc);
  expect(command.do(changed)).toBe(changed);
  expect(command.undo(changed)).toBe(changed);
});
