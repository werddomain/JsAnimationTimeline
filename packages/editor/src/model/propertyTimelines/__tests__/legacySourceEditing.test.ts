// packages/editor/src/model/propertyTimelines/__tests__/legacySourceEditing.test.ts
import { createEasingFunction, evaluatePropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { Easing, IPropertyTimeline, PropertyEasing } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import { createDoc, createRegistry, expectValid, layer, layerOf } from '../../spans/__tests__/fixtures';
import { PropertyTimelineCommand } from '../PropertyTimelineCommand';
import type { PropertyTimelineOperation } from '../types';

const number = (value: number) => ({ kind: 'number' as const, value });
const keys = [{ frame: 1, value: number(0) }, { frame: 101, value: number(100) }];
const context = { registry: createRegistry() };
const legacyEase: PropertyEasing = { kind: 'bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 };
const cases: readonly { operation: PropertyTimelineOperation; midpoint: number; startValue: number }[] = [
  { operation: { kind: 'set', layerId: 'logo', property: 'x', frame: 1, value: number(10) }, midpoint: 51, startValue: 10 },
  { operation: { kind: 'move-key', layerId: 'logo', property: 'x', frame: 1, toFrame: 11 }, midpoint: 56, startValue: 0 }
];

function importedTrack(legacyEasing: Easing = 'ease-in', easing?: PropertyEasing): IPropertyTimeline {
  return { initialValue: number(0), keys, transitions: [{ id: 'curve', fromFrame: 1, toFrame: 101,
    source: { start: 1, end: 101, keys, legacyEasing }, ...(easing === undefined ? {} : { easing }) }] };
}

it.each(cases)('preserves an imported legacy source effect when $operation.kind detaches it, with undo/redo', ({ operation, midpoint, startValue }) => {
  const doc = createDoc([layer('logo', [], { propertyTimelines: { x: importedTrack() } })], 110);
  expectValid(doc);
  const command = new PropertyTimelineCommand(operation, context);
  const changed = command.do(doc);
  const track = layerOf(changed, 'logo').propertyTimelines!.x;
  expect(track.transitions?.[0].source).toBeUndefined();
  expect(track.transitions?.[0].easing).toEqual(legacyEase);
  const expected = startValue + (100 - startValue) * createEasingFunction('ease-in')(0.5);
  expect(evaluatePropertyTimeline(track, midpoint)).toEqual(number(expected));
  expectValid(changed);
  const undone = command.undo(changed);
  expect(undone.layers[0]).toBe(doc.layers[0]);
  expect(command.do(undone)).toEqual(changed);
});

it('prefers the authoritative legacy source effect over a different duplicated transition effect', () => {
  const linear: PropertyEasing = { kind: 'effect', family: 'linear', mode: 'in' };
  const doc = createDoc([layer('logo', [], { propertyTimelines: { x: importedTrack('ease-in', linear) } })], 110);
  const command = new PropertyTimelineCommand(cases[0].operation, context);
  const changed = command.do(doc);
  expect(layerOf(changed, 'logo').propertyTimelines!.x.transitions?.[0].easing).toEqual(legacyEase);
});

it.each(cases)('refuses $operation.kind when the legacy source effect cannot be represented after detachment', ({ operation }) => {
  const source = importedTrack('cubic-bezier(0.42, 200, 1, 1)', legacyEase);
  const doc = createDoc([layer('logo', [], { propertyTimelines: { x: source } })], 110);
  expectValid(doc);
  const command = new PropertyTimelineCommand(operation, context);
  expect(() => command.do(doc)).toThrow(CommandRefusedError);
  expect(() => command.do(doc)).toThrow(/courbe historique.*représent/i);
  expect(layerOf(doc, 'logo').propertyTimelines!.x).toBe(source);
  expect(command.undo(doc)).toBe(doc);
});

it.each(cases)('keeps an implicitly linear modern source authoritative when $operation.kind detaches it', ({ operation, midpoint, startValue }) => {
  const source: IPropertyTimeline = { initialValue: number(0), keys, transitions: [{ id: 'curve', fromFrame: 1, toFrame: 101,
    source: { start: 1, end: 101, keys }, easing: { kind: 'effect', family: 'quadratic', mode: 'in' } }] };
  const doc = createDoc([layer('logo', [], { propertyTimelines: { x: source } })], 110);
  expectValid(doc);
  const command = new PropertyTimelineCommand(operation, context);
  const changed = command.do(doc);
  const track = layerOf(changed, 'logo').propertyTimelines!.x;
  expect(track.transitions?.[0].source).toBeUndefined();
  expect(track.transitions?.[0].easing).toBeUndefined();
  expect(evaluatePropertyTimeline(track, midpoint)).toEqual(number(startValue + (100 - startValue) / 2));
  expect(command.undo(changed)).toEqual(doc);
  expect(command.do(doc)).toEqual(changed);
});
