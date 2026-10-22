// packages/editor/src/core/commands/__tests__/CommandStack.reentrancy.test.ts
/**
 * Tests de réentrance de la CommandStack : un gestionnaire de
 * `command:before` ou de `document:changed` qui exécute une autre commande
 * (ou charge un document) ne doit faire perdre aucune modification, et
 * l'historique doit rester cohérent.
 */

import type { ICommand } from '../ICommand';
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
