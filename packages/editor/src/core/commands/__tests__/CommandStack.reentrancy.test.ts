// packages/editor/src/core/commands/__tests__/CommandStack.reentrancy.test.ts
/**
 * Tests de réentrance de la CommandStack : un gestionnaire de
 * `command:before` ou de `document:changed` qui exécute une autre commande
 * (ou charge un document) ne doit faire perdre aucune modification, et
 * l'historique doit rester cohérent.
 */

import type { ICommand } from '../ICommand';
import { CommandRefusedError } from '../CommandRefusedError';
import { createDocument, createHarness, layerName, recordEvents, renameLayer, setFps } from './fixtures';

/** Retourne une fonction qui n'exécute `action` qu'à son premier appel. */
function once(action: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    action();
  };
}

describe('CommandStack re-entrancy', () => {
  it('applies the command to the current document when a command:before handler executes another command', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const original = store.document;
    const outer = renameLayer('l1', 'Titre', 'Logo');
    const nested = setFps(30, 24);
    const runNested = once(() => stack.execute(nested));
    bus.onCancellable('command:before', (event) => {
      if (event.payload.command === outer) runNested();
    });

    // Act
    const changed = stack.execute(outer);

    // Assert
    expect(changed).toBe(true);
    expect(store.document.settings.fps).toBe(30);
    expect(layerName(store.document, 'l1')).toBe('Titre');
    expect(stack.undoLabel).toBe(outer.label);
    expect(stack.undo()).toBe(true);
    expect(store.document.settings.fps).toBe(30);
    expect(layerName(store.document, 'l1')).toBe('Logo');
    expect(stack.undo()).toBe(true);
    expect(store.document).toEqual(original);
  });

  it('applies the command to the loaded document when a command:before handler calls store.load', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const loaded = createDocument(12);
    const outer = renameLayer('l1', 'Titre', 'Logo');
    const runLoad = once(() => store.load(loaded));
    bus.onCancellable('command:before', () => runLoad());

    // Act
    const changed = stack.execute(outer);

    // Assert
    expect(changed).toBe(true);
    expect(store.document.settings.fps).toBe(12);
    expect(layerName(store.document, 'l1')).toBe('Titre');
    expect(stack.undo()).toBe(true);
    expect(store.document).toEqual(loaded);
    expect(stack.canUndo).toBe(false);
  });

  it('records a command executed from a document:changed handler after the triggering one', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const original = store.document;
    const outer = setFps(30, 24);
    const nested = renameLayer('l1', 'Titre', 'Logo');
    const runNested = once(() => stack.execute(nested));
    bus.on('document:changed', () => runNested());
    const history = recordEvents(bus, ['history:changed']);

    // Act
    stack.execute(outer);

    // Assert
    expect(store.document.settings.fps).toBe(30);
    expect(layerName(store.document, 'l1')).toBe('Titre');
    expect(history[history.length - 1].payload).toEqual({
      canUndo: true,
      canRedo: false,
      undoLabel: nested.label,
      redoLabel: undefined
    });
    expect(stack.undo()).toBe(true);
    expect(layerName(store.document, 'l1')).toBe('Logo');
    expect(store.document.settings.fps).toBe(30);
    expect(stack.undo()).toBe(true);
    expect(store.document).toEqual(original);
  });

  it('groups a command executed from a document:changed handler during a drag', () => {
    // Arrange
    const { bus, store, stack } = createHarness();
    const original = store.document;
    const nested: ICommand = renameLayer('l1', 'Titre', 'Logo');
    const runNested = once(() => stack.execute(nested));
    bus.on('document:changed', () => runNested());

    // Act
    stack.beginGroup('Glisser');
    stack.execute(setFps(25, 24));
    const pushed = stack.endGroup();

    // Assert
    expect(pushed).toBe(true);
    expect(layerName(store.document, 'l1')).toBe('Titre');
    expect(stack.undoLabel).toBe('Glisser');
    expect(stack.undo()).toBe(true);
    expect(store.document).toEqual(original);
    expect(stack.canUndo).toBe(false);
  });
});

it('preserves a document loaded during a command transform', () => {
  const { store, stack } = createHarness();
  const loaded = createDocument(12);
  const inner = setFps(30, 24);
  const outer: ICommand = {
    label: 'Outer',
    do: (doc) => { store.load(loaded); return inner.do(doc); },
    undo: inner.undo
  };
  expect(stack.execute(outer)).toBe(false);
  expect(store.document).toBe(loaded);
  expect(stack.canUndo).toBe(false);
});


it.each(['same load', 'ABA load', 'clear', 'group'] as const)(
  'abandons even a no-op after %s changes history', (mutation) => {
    const { bus, store, stack } = createHarness();
    const original = store.document;
    const events = recordEvents(bus, ['command:refused']);
    const command: ICommand = { label: 'Outer', do: (doc) => {
      if (mutation === 'same load') store.load(original);
      if (mutation === 'ABA load') { store.load(createDocument(12)); store.load(original); }
      if (mutation === 'clear') stack.clear();
      if (mutation === 'group') { stack.beginGroup('Nested'); stack.endGroup(); }
      return doc;
    }, undo: (doc) => doc };
    expect(stack.execute(command)).toBe(false);
    expect(store.document).toBe(original);
    expect(stack.canUndo).toBe(false);
    expect(events).toHaveLength(1);
  }
);

it('preserves a nested command and its history when the outer transform finishes', () => {
  const { bus, store, stack } = createHarness();
  const inner = setFps(30, 24);
  const outer: ICommand = { label: 'Outer', do: (doc) => {
    stack.execute(inner);
    return renameLayer('l1', 'Outer', 'Logo').do(doc);
  }, undo: (doc) => doc };
  const events = recordEvents(bus, ['command:refused', 'document:changed']);
  expect(stack.execute(outer)).toBe(false);
  expect(store.document.settings.fps).toBe(30);
  expect(layerName(store.document, 'l1')).toBe('Logo');
  expect(stack.undoLabel).toBe(inner.label);
  expect(events.filter((event) => event.name === 'document:changed')).toHaveLength(1);
  expect(events.filter((event) => event.name === 'command:refused')).toHaveLength(1);
  expect(stack.undo()).toBe(true);
});

it.each(['undo', 'redo'] as const)('preserves nested history during %s and allows a retry', (operation) => {
  const { bus, store, stack } = createHarness();
  let mutate = false;
  const nested = renameLayer('l1', 'Nested', 'Logo');
  const base = setFps(30, 24);
  const command: ICommand = { label: 'Outer',
    do: (doc) => { if (mutate && operation === 'redo') { mutate = false; stack.execute(nested); } return base.do(doc); },
    undo: (doc) => { if (mutate && operation === 'undo') { mutate = false; stack.execute(nested); } return base.undo(doc); }
  };
  expect(stack.execute(command)).toBe(true);
  if (operation === 'redo') expect(stack.undo()).toBe(true);
  const events = recordEvents(bus, ['command:refused', 'document:changed']);
  mutate = true;
  expect(stack[operation]()).toBe(false);
  expect(layerName(store.document, 'l1')).toBe('Nested');
  expect(stack.undoLabel).toBe(nested.label);
  expect(events.filter((event) => event.name === 'command:refused')).toHaveLength(1);
  expect(events.filter((event) => event.name === 'document:changed')).toHaveLength(1);
  expect(stack.undo()).toBe(true);
  if (operation === 'undo') expect(stack.undo()).toBe(true);
});

it.each(['refusal', 'exception'] as const)('preserves nested effects when a transform ends with %s', (ending) => {
  const { bus, store, stack } = createHarness();
  const loaded = createDocument(12);
  const events = recordEvents(bus, ['command:refused']);
  const command: ICommand = { label: 'Outer', do: () => {
    store.load(loaded);
    if (ending === 'refusal') throw new CommandRefusedError('Outer', 'refus explicite');
    throw new Error('failure');
  }, undo: (doc) => doc };
  if (ending === 'refusal') expect(stack.execute(command)).toBe(false);
  else expect(() => stack.execute(command)).toThrow('failure');
  expect(store.document).toBe(loaded);
  expect(events).toHaveLength(ending === 'refusal' ? 1 : 0);
  expect(stack.execute(setFps(20, 12))).toBe(true);
});

it.each(['undo', 'redo'] as const)('rejects %s after loading the same document during a grouped transform', (operation) => {
  const { bus, store, stack } = createHarness();
  let mutate = false;
  const base = setFps(30, 24);
  const grouped: ICommand = { label: 'Grouped',
    do: (doc) => { if (mutate && operation === 'redo') store.load(store.document); return base.do(doc); },
    undo: (doc) => { if (mutate && operation === 'undo') store.load(store.document); return base.undo(doc); }
  };
  stack.beginGroup('Group');
  expect(stack.execute(grouped)).toBe(true);
  expect(stack.endGroup()).toBe(true);
  if (operation === 'redo') expect(stack.undo()).toBe(true);
  const current = store.document;
  const events = recordEvents(bus, ['command:refused', 'document:changed']);
  mutate = true;
  expect(stack[operation]()).toBe(false);
  expect(store.document).toBe(current);
  expect(stack.canUndo).toBe(false);
  expect(stack.canRedo).toBe(false);
  expect(events.filter((event) => event.name === 'command:refused')).toHaveLength(1);
  expect(events.filter((event) => event.name === 'document:changed')).toHaveLength(0);
});
