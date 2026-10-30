// packages/editor/src/model/spans/__tests__/modernLegacyGuards.test.ts
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ICommand } from '../../../core/commands/ICommand';
import { EventBus } from '../../../core/events/EventBus';
import { Store } from '../../../core/store/Store';
import { buildClip, extractSpans } from '../../../plugins/frames/clipboard/clipboardModel';
import { createPasteCommand } from '../../../plugins/frames/clipboard/pasteCommand';
import { createSetEasingCommand } from '../../../plugins/tweens/easing/easingCommands';
import { createMotionTweenCommands } from '../../../plugins/tweens/motion/motionTweenCommands';
import { SetPropertyCommand } from '../../properties/SetPropertyCommand';
import { visibleRows } from '../../rows';
import { createSpanIdFactory } from '../layerAccess';
import { createSpanCommands } from '../spanCommands';
import { createDoc, createRegistry, expectValid, layer, layerOf } from './fixtures';

const registry = createRegistry();
const commands = createSpanCommands(registry);
const tweens = createMotionTweenCommands(registry);
const modern = { y: { initialValue: { kind: 'number' as const, value: 0 }, keys: [{ frame: 1, value: { kind: 'number' as const, value: 7 } }] } };
const legacyLayer = (id: string) => layer(id, [
  { id: `${id}-motion`, start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] } },
  { id: `${id}-still`, start: 12, end: 24, kind: 'static', tracks: { x: [{ frame: 12, value: 200 }] } }
]);
const mixedDoc = () => createDoc([{ ...legacyLayer('modern'), propertyTimelines: modern }, legacyLayer('legacy')]);
const cases: readonly { name: string; command: (id: string) => ICommand }[] = [
  { name: 'F6', command: (id) => commands.insertKeyframe(id, 6) },
  { name: 'F7', command: (id) => commands.insertBlankKeyframe(id, 6) },
  { name: 'delete key', command: (id) => commands.deleteKeyframe(id, 12) },
  { name: 'insert frame', command: (id) => commands.insertFrame(id, 6) },
  { name: 'remove frame', command: (id) => commands.removeFrame(id, 6) },
  { name: 'move key', command: (id) => commands.moveKeyframe(id, 12, 13) },
  { name: 'legacy property', command: (id) => new SetPropertyCommand(id, 'x', 25, 5, { registry }) },
  { name: 'create tween from span', command: (id) => tweens.createFromSpan(id, 12) },
  { name: 'create tween between keys', command: (id) => tweens.createBetween(id, 1, 12) },
  { name: 'remove tween', command: (id) => tweens.remove([{ layerId: id, frames: [1] }]) },
  { name: 'legacy easing', command: (id) => createSetEasingCommand(id, 1, 'ease-in') },
  { name: 'paste frames', command: (id) => createPasteCommand([{ layerId: id, runs: [{ at: 4, run: {
    length: 2, spans: [{ kind: 'static', start: 1, end: 2, tracks: { x: [{ frame: 1, value: 50 }] } }]
  } }] }], registry) }
];

function harness(doc: ITimelineDocument) {
  const bus = new EventBus({ onError: jest.fn() });
  const store = new Store(bus, doc, { registry });
  const stack = store.createCommandStack();
  const refused: string[] = [];
  bus.on('command:refused', ({ reason }) => refused.push(reason));
  return { bus, store, stack, refused };
}

it.each(cases)('refuses $name on modern property layers without changing the document or redo history', ({ command }) => {
  const doc = mixedDoc();
  const { store, stack, refused } = harness(doc);
  const harmless: ICommand = { label: 'Cadence', do: (input) => ({ ...input, settings: { ...input.settings, fps: 30 } }), undo: () => doc };
  stack.execute(harmless);
  stack.undo();
  expect(stack.canRedo).toBe(true);
  expect(stack.execute(command('modern'))).toBe(false);
  expect(store.document).toBe(doc);
  expect(stack.canUndo).toBe(false);
  expect(stack.canRedo).toBe(true);
  expect(stack.redoLabel).toBe('Cadence');
  expect(refused).toHaveLength(1);
  expect(refused[0]).toMatch(/propriétés indépendantes/);
});

it.each(cases)('keeps $name available for a legacy layer beside a modern layer and supports undo/redo', ({ command }) => {
  const doc = mixedDoc();
  const { store, stack, refused } = harness(doc);
  expect(stack.execute(command('legacy'))).toBe(true);
  const changed = store.document;
  expect(changed.layers[0]).toBe(doc.layers[0]);
  expectValid(changed);
  expect(stack.undo()).toBe(true);
  expect(store.document).toEqual(doc);
  expect(stack.redo()).toBe(true);
  expect(store.document).toEqual(changed);
  expect(refused).toEqual([]);
});

it('allows an empty modern dictionary for legacy commands', () => {
  const doc = createDoc([{ ...legacyLayer('legacy'), propertyTimelines: {} }]);
  const { store, stack } = harness(doc);
  expect(stack.execute(commands.insertBlankKeyframe('legacy', 6))).toBe(true);
  expect(stack.undo()).toBe(true);
  expect(store.document).toEqual(doc);
});

it('refuses modern clipboard sources and still copies locked legacy layers', () => {
  const doc = mixedDoc();
  const cells = [{ rowId: 'modern', frame: 1 }];
  expect(() => buildClip(doc, visibleRows(doc), cells, registry)).toThrow(/propriétés indépendantes/);
  expect(() => extractSpans(layerOf(doc, 'modern'), 1, 2, registry)).toThrow(/propriétés indépendantes/);
  const locked = createDoc([{ ...legacyLayer('legacy'), locked: true }]);
  expect(buildClip(locked, visibleRows(locked), [{ rowId: 'legacy', frame: 1 }], registry)?.rows).toHaveLength(1);
});

it('reserves modern transition ids when creating legacy span ids', () => {
  const doc = createDoc([layer('modern', [], { propertyTimelines: { y: {
    initialValue: { kind: 'number', value: 0 },
    keys: [{ frame: 1, value: { kind: 'number', value: 0 } }, { frame: 24, value: { kind: 'number', value: 1 } }],
    transitions: [{ id: 'legacy-k1', fromFrame: 1, toFrame: 24 }]
  } } }), legacyLayer('legacy')]);
  expect(createSpanIdFactory(doc, 'legacy')()).toBe('legacy-k2');
  const { store, stack } = harness(doc);
  expect(stack.execute(commands.insertBlankKeyframe('legacy', 6))).toBe(true);
  expectValid(store.document);
});
