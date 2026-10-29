// packages/editor/src/model/properties/__tests__/SetPropertyCommand.test.ts
import type { ITargetInfo, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import { EventBus } from '../../../core/events/EventBus';
import { Store } from '../../../core/store/Store';
import { createDoc, createRegistry, layer, layerOf, spansOf } from '../../spans/__tests__/fixtures';
import { SetPropertyCommand } from '../SetPropertyCommand';

function documentWithTarget(ref = 'logo'): ITimelineDocument {
  return createDoc([layer('logo', [{ id: 'still', start: 1, end: 10, kind: 'static' }], { target: { ref, stage: 'canvas' } })]);
}

it('restores the exact previous layer while preserving unrelated current document data', () => {
  const doc = documentWithTarget();
  const command = new SetPropertyCommand('logo', 'x', 75, 8, { registry: createRegistry() });
  const next = command.do(doc);
  const otherChange = { ...next, settings: { ...next.settings, fps: 30 } };
  const restored = command.undo(otherChange);
  expect(layerOf(restored, 'logo')).toBe(layerOf(doc, 'logo'));
  expect(restored.settings.fps).toBe(30);
  expect(command.do(restored)).toEqual({ ...next, settings: otherChange.settings });
  expect(command.undo(command.do(doc))).toEqual(doc);
});

it('reads current document target and dynamic permissions at execution and each redo', () => {
  let properties: readonly string[] = ['x'];
  const queries: string[] = [];
  const registry = createRegistry();
  const command = new SetPropertyCommand('logo', 'x', 75, 8, {
    registry,
    describe: (target): ITargetInfo => {
      const ref = 'ref' in target ? target.ref : '';
      queries.push(ref);
      return { target, label: ref, properties: ref === 'other' ? [] : properties };
    }
  });
  expect(() => command.do(documentWithTarget('other'))).toThrow(CommandRefusedError);
  const doc = documentWithTarget();
  const changed = command.do(doc);
  properties = [];
  expect(() => command.do(command.undo(changed))).toThrow(CommandRefusedError);
  properties = ['x'];
  expect(command.do(doc)).toEqual(changed);
  expect(queries).toEqual(['other', 'logo', 'logo', 'logo']);
});

it('keeps refused redo atomic and retryable when metadata changes', () => {
  const bus = new EventBus();
  const store = new Store(bus, documentWithTarget());
  const stack = store.createCommandStack();
  const reasons: string[] = [];
  bus.on('command:refused', ({ reason }) => reasons.push(reason));
  let properties: readonly string[] = ['x'];
  const command = new SetPropertyCommand('logo', 'x', 75, 8, {
    registry: createRegistry(), listTargets: () => [{ target: { stage: 'canvas', ref: 'logo' }, label: 'Logo', properties }]
  });
  expect(stack.execute(command)).toBe(true);
  expect(stack.undo()).toBe(true);
  const before = store.document;
  properties = [];
  expect(stack.redo()).toBe(false);
  expect(store.document).toBe(before);
  expect([stack.canUndo, stack.canRedo]).toEqual([false, true]);
  expect(reasons).toHaveLength(1);
  properties = ['x'];
  expect(stack.redo()).toBe(true);
  expect(spansOf(store.document, 'logo')[0].tracks?.x).toEqual([{ frame: 1, value: 75 }]);
  expect(stack.undo()).toBe(true);
  expect(store.document).toEqual(before);
});

it('checks the current lock inside do and preserves unexpected query errors', () => {
  const doc = documentWithTarget();
  const locked = { ...doc, layers: [{ ...layerOf(doc, 'logo'), locked: true }] };
  const command = new SetPropertyCommand('logo', 'x', 75, 8, { registry: createRegistry() });
  expect(() => command.do(locked)).toThrow(CommandRefusedError);
  const broken = new SetPropertyCommand('logo', 'x', 75, 8, {
    registry: createRegistry(), describe: () => { throw new Error('metadata failed'); }
  });
  expect(() => broken.do(doc)).toThrow('metadata failed');
  expect(command.undo(doc)).toBe(doc);
});
