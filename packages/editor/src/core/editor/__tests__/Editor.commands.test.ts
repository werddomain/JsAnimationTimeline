// packages/editor/src/core/editor/__tests__/Editor.commands.test.ts
/**
 * Tests de l'historique et du document à travers l'éditeur : execute / undo
 * / redo par `IEditor` et par `ctx.commands`, `document:changed` reçu par un
 * plugin, veto d'un plugin et refus d'une commande, `load` qui vide
 * l'historique, `toJSON`, services lus par `getService`, abonnements de
 * l'application (`on`, `once`, `off`).
 */

import {
  NOOP_COMMAND,
  createDocument,
  layerName,
  renameLayer,
  renameUnlessLocked,
  setFps
} from '../../commands/__tests__/fixtures';
import type { DocumentChangedEvent } from '../../store/storeEvents';
import type { IEditorContext } from '../../context/IEditorContext';
import { StoreError } from '../../store/StoreError';
import { createEditor } from '../createEditor';
import { captureContext, catchError, cleanBody, createContainer, createCounter, makeEditorPlugin } from './fixtures';

afterEach(cleanBody);

function editorWithContext(): { readonly editor: ReturnType<typeof createEditor>; readonly ctx: IEditorContext } {
  const { plugin, context } = captureContext();
  const editor = createEditor(createContainer(), { data: createDocument(), plugins: [plugin] });
  return { editor, ctx: context() };
}

describe('Editor history', () => {
  it('executes, undoes and redoes a command through IEditor', () => {
    // Arrange
    const { editor } = editorWithContext();

    // Act
    const executed = editor.execute(renameLayer('l1', 'Titre', 'Logo'));
    const afterExecute = layerName(editor.document, 'l1');
    const undone = editor.undo();
    const afterUndo = layerName(editor.document, 'l1');
    const redone = editor.redo();

    // Assert
    expect([executed, undone, redone]).toEqual([true, true, true]);
    expect([afterExecute, afterUndo]).toEqual(['Titre', 'Logo']);
    expect(layerName(editor.document, 'l1')).toBe('Titre');
    expect(editor.canUndo).toBe(true);
    expect(editor.canRedo).toBe(false);
  });

  it('returns false from undo and redo when the history is empty, and for a no-op', () => {
    // Arrange
    const { editor } = editorWithContext();

    // Act
    const results = [editor.undo(), editor.redo(), editor.execute(NOOP_COMMAND)];

    // Assert
    expect(results).toEqual([false, false, false]);
  });

  it('shares one history between ctx.commands and IEditor, seen by a plugin', () => {
    // Arrange
    const changes: DocumentChangedEvent[] = [];
    const watcher = makeEditorPlugin([], 'watcher', [], {
      onInit: (ctx) => void ctx.events.on('document:changed', (event) => changes.push(event))
    });
    const { plugin, context } = captureContext();
    const editor = createEditor(createContainer(), { data: createDocument(), plugins: [plugin, watcher] });

    // Act
    context().commands.execute(setFps(30, 24));
    editor.undo();
    context().commands.redo();

    // Assert
    expect(changes.map((event) => [event.cause, event.document.settings.fps])).toEqual([
      ['execute', 30],
      ['undo', 24],
      ['redo', 30]
    ]);
    expect(editor.document.settings.fps).toBe(30);
    expect(context().commands.undoLabel).toBe('Fps 30');
  });

  it('lets a plugin veto a command through command:before', () => {
    // Arrange
    const refused: string[] = [];
    const guard = makeEditorPlugin([], 'guard', [], {
      onInit: (ctx) => {
        ctx.events.onCancellable('command:before', (event) => event.cancel());
        ctx.events.on('command:refused', (event) => refused.push(event.reason));
      }
    });
    const data = createDocument();
    const editor = createEditor(createContainer(), { data, plugins: [guard] });

    // Act
    const executed = editor.execute(renameLayer('l1', 'Titre', 'Logo'));

    // Assert
    expect(executed).toBe(false);
    expect(refused).toEqual(['cancelled']);
    expect(editor.document).toBe(data);
    expect(editor.canUndo).toBe(false);
  });

  it('reports a command refused by its own rule (locked layer)', () => {
    // Arrange
    const { editor } = editorWithContext();
    const reasons: string[] = [];
    editor.on('command:refused', (event) => reasons.push(event.reason));

    // Act
    const executed = editor.execute(renameUnlessLocked('l2', 'Nouveau', 'Fond'));

    // Assert
    expect(executed).toBe(false);
    expect(reasons).toEqual(['calque verrouillé']);
  });
});

describe('Editor document', () => {
  it('loads a new document, clears the history and emits document:loaded', () => {
    // Arrange
    const { editor } = editorWithContext();
    editor.execute(setFps(30, 24));
    const loaded: number[] = [];
    editor.on('document:loaded', (event) => loaded.push(event.document.settings.fps));
    const next = createDocument(12);

    // Act
    editor.load(next);

    // Assert
    expect(editor.document).toBe(next);
    expect(loaded).toEqual([12]);
    expect(editor.canUndo).toBe(false);
    expect(editor.undo()).toBe(false);
  });

  it('rejects an invalid document in load and keeps the current one', () => {
    // Arrange
    const { editor } = editorWithContext();
    const before = editor.document;
    const invalid = { ...before, settings: { fps: 24, totalFrames: 10 } };

    // Act
    const error = catchError(() => editor.load(invalid));

    // Assert
    expect(error).toBeInstanceOf(StoreError);
    expect(editor.document).toBe(before);
  });

  it('returns the current immutable document from toJSON, ready for JSON.stringify', () => {
    // Arrange
    const { editor } = editorWithContext();
    editor.execute(renameLayer('l1', 'Titre', 'Logo'));

    // Act
    const json = editor.toJSON();

    // Assert
    expect(json).toBe(editor.document);
    expect(JSON.parse(JSON.stringify(editor))).toEqual(json);
  });
});

describe('Editor services and subscriptions', () => {
  it('reads a service provided by a plugin, typed by EditorServiceMap', () => {
    // Arrange
    const counter = createCounter();
    const provider = makeEditorPlugin([], 'test.counter', [], {
      onInit: (ctx) => void ctx.services.provide('test.counter', counter)
    });
    let seenByConsumer = 0;
    const consumer = makeEditorPlugin([], 'consumer', ['test.counter'], {
      onInit: (ctx) => (seenByConsumer = ctx.services.require('test.counter').increment())
    });

    // Act
    const editor = createEditor(createContainer(), { plugins: [consumer, provider] });

    // Assert
    expect(seenByConsumer).toBe(1);
    expect(editor.getService('test.counter')).toBe(counter);
    expect(editor.getService('test.greeter')).toBeUndefined();
  });

  it('subscribes with on and once and unsubscribes with off', () => {
    // Arrange
    const { editor } = editorWithContext();
    const seen: string[] = [];
    const handler = (): void => void seen.push('on');
    editor.on('history:changed', handler);
    editor.once('history:changed', () => seen.push('once'));

    // Act
    editor.execute(setFps(30, 24));
    editor.off('history:changed', handler);
    editor.undo();

    // Assert
    expect(seen).toEqual(['on', 'once']);
  });
});
