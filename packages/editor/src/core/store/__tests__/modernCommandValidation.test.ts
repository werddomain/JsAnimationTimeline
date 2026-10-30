// packages/editor/src/core/store/__tests__/modernCommandValidation.test.ts
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ICommand } from '../../commands/ICommand';
import { EventBus } from '../../events/EventBus';
import { Store } from '../Store';

const initial: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 30 }, layers: [{
  id: 'object', type: 'layer', name: 'Object', spans: [], propertyTimelines: {
    x: { initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 20, value: { kind: 'number', value: 8 } }] }
  }
}] };
const invalid: ITimelineDocument = { ...initial, settings: { ...initial.settings, totalFrames: 10 } };
const changed: ITimelineDocument = { ...initial, settings: { ...initial.settings, fps: 30 } };

function setup(doc = initial) {
  const events = new EventBus();
  const refusals: string[] = [];
  const changes: string[] = [];
  events.on('command:refused', ({ reason }) => refusals.push(reason));
  events.on('document:changed', ({ cause }) => changes.push(cause));
  const store = new Store(events, doc);
  const commands = store.createCommandStack();
  return { store, commands, refusals, changes };
}

describe('validation before committing modern command results', () => {
  it('refuses a duration that would orphan a property key without changing history or document', () => {
    const { store, commands, refusals, changes } = setup();
    expect(commands.execute({ label: 'Shorten', do: () => invalid, undo: () => initial })).toBe(false);
    expect(store.document).toBe(initial);
    expect(commands.canUndo).toBe(false);
    expect(changes).toEqual([]);
    expect(refusals).toHaveLength(1);
  });

  it('also validates a command introducing modern tracks into a legacy document', () => {
    const legacy = { ...initial, layers: [] };
    const { store, commands } = setup(legacy);
    expect(commands.execute({ label: 'Introduce', do: () => invalid, undo: () => legacy })).toBe(false);
    expect(store.document).toBe(legacy);
    expect(commands.canUndo).toBe(false);
  });

  it('refuses an invalid undo before consuming its history entry', () => {
    const { store, commands } = setup();
    const command: ICommand = { label: 'Bad undo', do: () => changed, undo: () => invalid };
    expect(commands.execute(command)).toBe(true);
    expect(commands.undo()).toBe(false);
    expect(store.document).toBe(changed);
    expect(commands.canUndo).toBe(true);
    expect(commands.canRedo).toBe(false);
  });

  it('refuses invalid redo while preserving the redo entry', () => {
    const { store, commands } = setup();
    let executions = 0;
    const command: ICommand = { label: 'Bad redo', do: () => ++executions === 1 ? changed : invalid, undo: () => initial };
    commands.execute(command);
    expect(commands.undo()).toBe(true);
    expect(commands.redo()).toBe(false);
    expect(store.document).toBe(initial);
    expect(commands.canRedo).toBe(true);
    expect(commands.canUndo).toBe(false);
  });

  it('keeps a group cancellable when one proposal is refused', () => {
    const { store, commands } = setup();
    commands.beginGroup('Gesture');
    commands.execute({ label: 'Valid', do: () => changed, undo: () => initial });
    expect(commands.execute({ label: 'Invalid', do: () => invalid, undo: () => changed })).toBe(false);
    expect(store.document).toBe(changed);
    commands.cancelGroup();
    expect(store.document).toBe(initial);
    expect(commands.canUndo).toBe(false);
  });
});
