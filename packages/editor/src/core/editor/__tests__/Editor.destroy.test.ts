// packages/editor/src/core/editor/__tests__/Editor.destroy.test.ts
/**
 * Tests de la destruction de l'éditeur et des démarrages ratés :
 * `editor:destroying` avant la destruction des plugins, ordre inverse,
 * retrait du DOM, idempotence, erreurs après destruction (IEditor et
 * contexte), erreur d'un `destroy` de plugin, et nettoyage complet quand le
 * démarrage d'un plugin échoue.
 */

import { createDocument, setFps } from '../../commands/__tests__/fixtures';
import { PluginError } from '../../plugin/PluginError';
import { createEditor } from '../createEditor';
import { captureContext, catchError, cleanBody, createContainer, createCounter, makeEditorPlugin } from './fixtures';

afterEach(cleanBody);

describe('Editor.destroy', () => {
  it('emits editor:destroying before destroying plugins in reverse order', () => {
    // Arrange
    const log: string[] = [];
    const first = makeEditorPlugin(log, 'first', [], {
      onInit: (ctx) => void ctx.events.on('editor:destroying', (event) => log.push(`destroying:${event.reason ?? '-'}`))
    });
    const second = makeEditorPlugin(log, 'second', ['first']);
    const editor = createEditor(createContainer(), { plugins: [second, first] });

    // Act
    editor.destroy('fermeture');

    // Assert
    expect(log).toEqual(['init:first', 'init:second', 'destroying:fermeture', 'destroy:second', 'destroy:first']);
  });

  it('emits editor:destroying without reason by default', () => {
    // Arrange
    const payloads: unknown[] = [];
    const listener = makeEditorPlugin([], 'listener', [], {
      onInit: (ctx) => void ctx.events.on('editor:destroying', (event) => payloads.push(event))
    });
    const editor = createEditor(createContainer(), { plugins: [listener] });

    // Act
    editor.destroy();

    // Assert
    expect(payloads).toEqual([{}]);
  });

  it('removes the root element, the services and every subscription', () => {
    // Arrange
    const container = createContainer();
    const { plugin, context } = captureContext();
    const editor = createEditor(container, { plugins: [plugin] });
    context().services.provide('test.counter', createCounter());
    const changes: number[] = [];
    context().events.on('document:changed', () => changes.push(1));

    // Act
    editor.destroy();

    // Assert
    expect(container.childNodes).toHaveLength(0);
    expect(context().services.get('test.counter')).toBeUndefined();
    expect(context().slots.names()).toEqual([]);
    expect(editor.isDestroyed).toBe(true);
    expect(changes).toEqual([]);
  });

  it('is idempotent, including when called again from a destroying handler', () => {
    // Arrange
    const log: string[] = [];
    const holder: { editor?: { destroy(): void } } = {};
    const plugin = makeEditorPlugin(log, 'p', [], {
      onInit: (ctx) => void ctx.events.on('editor:destroying', () => holder.editor?.destroy())
    });
    const editor = createEditor(createContainer(), { plugins: [plugin] });
    holder.editor = editor;

    // Act
    editor.destroy();
    editor.destroy();

    // Assert
    expect(log).toEqual(['init:p', 'destroy:p']);
  });

  it('keeps the editor usable while plugins are being destroyed', () => {
    // Arrange
    const { plugin, context } = captureContext();
    let fpsDuringDestroy = 0;
    const cleaner = makeEditorPlugin([], 'cleaner', [], {
      onDestroy: () => {
        context().commands.execute(setFps(12, 24));
        fpsDuringDestroy = context().document.settings.fps;
      }
    });
    const editor = createEditor(createContainer(), { data: createDocument(), plugins: [plugin, cleaner] });

    // Act
    editor.destroy();

    // Assert
    expect(fpsDuringDestroy).toBe(12);
  });

  it('throws a French error from every other member after destroy', () => {
    // Arrange
    const editor = createEditor(createContainer());
    editor.destroy();
    const calls: Array<() => unknown> = [
      () => editor.container,
      () => editor.document,
      () => editor.canUndo,
      () => editor.canRedo,
      () => editor.on('editor:ready', () => undefined),
      () => editor.once('editor:ready', () => undefined),
      () => editor.off('editor:ready', () => undefined),
      () => editor.execute(setFps(30, 24)),
      () => editor.undo(),
      () => editor.redo(),
      () => editor.toJSON(),
      () => editor.load(createDocument()),
      () => editor.getService('test.counter')
    ];

    // Act
    const messages = calls.map((call) => (catchError(call) as Error).message);

    // Assert
    messages.forEach((message) => expect(message).toMatch(/^L'éditeur a été détruit : « \w+ » n'est plus disponible\.$/));
    expect(messages[7]).toContain('« execute »');
    expect(editor.isDestroyed).toBe(true);
  });

  it('makes the plugin context refuse actions after destroy', () => {
    // Arrange
    const { plugin, context } = captureContext();
    const editor = createEditor(createContainer(), { plugins: [plugin] });
    editor.destroy();

    // Act
    const error = catchError(() => context().commands.execute(setFps(30, 24)));

    // Assert
    expect((error as Error).message).toContain('« commands.execute »');
  });

  it('still cleans up and rethrows when a plugin destroy throws', () => {
    // Arrange
    const container = createContainer();
    const log: string[] = [];
    const failing = makeEditorPlugin(log, 'failing', [], {
      onDestroy: () => {
        throw new Error('boom');
      }
    });
    const other = makeEditorPlugin(log, 'other');
    const editor = createEditor(container, { plugins: [other, failing] });

    // Act
    const error = catchError(() => editor.destroy());

    // Assert
    expect((error as Error).message).toBe('boom');
    expect(log).toEqual(['init:other', 'init:failing', 'destroy:failing', 'destroy:other']);
    expect(container.childNodes).toHaveLength(0);
    expect(editor.isDestroyed).toBe(true);
  });
});

describe('createEditor start failure', () => {
  it('removes the root element, destroys started plugins and rethrows', () => {
    // Arrange
    const container = createContainer();
    const log: string[] = [];
    const { plugin, context } = captureContext();
    const ok = makeEditorPlugin(log, 'ok', [], {
      onInit: (ctx) => {
        ctx.services.provide('test.counter', createCounter());
        ctx.slots.define('ok.zone', document.createElement('div'));
      }
    });
    const broken = makeEditorPlugin(log, 'broken', ['ok'], {
      onInit: () => {
        throw new Error('init cassé');
      }
    });

    // Act
    const error = catchError(() => createEditor(container, { plugins: [plugin, broken, ok] }));

    // Assert
    expect(error).toBeInstanceOf(PluginError);
    expect((error as PluginError).code).toBe('init-failed');
    expect(log).toEqual(['init:ok', 'init:broken', 'destroy:ok']);
    expect(container.childNodes).toHaveLength(0);
    expect(context().services.get('test.counter')).toBeUndefined();
    expect(context().slots.names()).toEqual([]);
    expect(() => context().events.on('editor:ready', () => undefined)).toThrow("L'éditeur a été détruit");
  });

  it('cleans up when a dependency is missing', () => {
    // Arrange
    const container = createContainer();

    // Act
    const error = catchError(() =>
      createEditor(container, { plugins: [makeEditorPlugin([], 'orphan', ['absent'])] })
    );

    // Assert
    expect((error as PluginError).code).toBe('missing-dependency');
    expect(container.childNodes).toHaveLength(0);
  });

  it('cleans up when a render fails', () => {
    // Arrange
    const container = createContainer();
    const painter = makeEditorPlugin([], 'painter', [], {
      onRender: (slot) => {
        slot.appendChild(document.createElement('span'));
        throw new Error('rendu cassé');
      }
    });

    // Act
    const error = catchError(() => createEditor(container, { plugins: [painter] }));

    // Assert
    expect((error as PluginError).code).toBe('render-failed');
    expect(container.childNodes).toHaveLength(0);
  });
});
