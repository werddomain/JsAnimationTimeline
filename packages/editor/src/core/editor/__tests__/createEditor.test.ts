// packages/editor/src/core/editor/__tests__/createEditor.test.ts
/**
 * Tests de `createEditor()` : document par défaut ou fourni, refus d'un
 * document invalide ou d'un conteneur invalide sans rien laisser dans le
 * DOM, contexte reçu par les plugins, ordre des dépendances, rendu dans
 * `ROOT_SLOT`, jeu de plugins par défaut (true / false / tableau) suivi des
 * plugins optionnels, et charge utile de `editor:ready`.
 */

import { SCHEMA_VERSION, validateDocument } from '@werddomain/timeline-runtime';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { createDocument } from '../../commands/__tests__/fixtures';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import type { IEditorContext } from '../../context/IEditorContext';
import { PluginError } from '../../plugin/PluginError';
import { ROOT_SLOT } from '../../plugin/SlotRegistry';
import { StoreError } from '../../store/StoreError';
import { EDITOR_ROOT_CLASS, createEditor, resolvePlugins } from '../createEditor';
import { defaultPlugins } from '../defaultPlugins';
import { DEFAULT_FPS, DEFAULT_TOTAL_FRAMES, createEmptyDocument } from '../emptyDocument';
import { captureContext, catchError, cleanBody, createContainer, makeEditorPlugin } from './fixtures';

afterEach(cleanBody);

describe('createEditor document', () => {
  it('starts with a valid empty v2 document by default', () => {
    // Arrange
    const container = createContainer();

    // Act
    const editor = createEditor(container);

    // Assert
    expect(editor.document).toEqual({
      version: SCHEMA_VERSION,
      settings: { fps: DEFAULT_FPS, totalFrames: DEFAULT_TOTAL_FRAMES },
      layers: []
    });
    expect(validateDocument(editor.document)).toEqual([]);
    expect(Object.isFrozen(editor.document)).toBe(true);
    expect(editor.canUndo).toBe(false);
    expect(editor.canRedo).toBe(false);
  });

  it('creates a new empty document on each call', () => {
    // Act
    const first = createEmptyDocument();
    const second = createEmptyDocument();

    // Assert
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it('uses the given data by reference', () => {
    // Arrange
    const data = createDocument();

    // Act
    const editor = createEditor(createContainer(), { data });

    // Assert
    expect(editor.document).toBe(data);
    expect(editor.toJSON()).toBe(data);
  });

  it('rejects invalid data with a StoreError and leaves the container untouched', () => {
    // Arrange
    const container = createContainer();
    const invalid = deepFreeze<ITimelineDocument>({
      version: SCHEMA_VERSION,
      settings: { fps: 24, totalFrames: 5 },
      layers: [{ id: 'a', type: 'layer', name: 'A', spans: [{ id: 's', start: 1, end: 9, kind: 'static' }] }]
    });
    const log: string[] = [];

    // Act
    const error = catchError(() =>
      createEditor(container, { data: invalid, plugins: [makeEditorPlugin(log, 'never')] })
    );

    // Assert
    expect(error).toBeInstanceOf(StoreError);
    expect(container.childNodes).toHaveLength(0);
    expect(log).toEqual([]);
  });

  it('rejects an invalid history limit before touching the DOM', () => {
    // Arrange
    const container = createContainer();

    // Act
    const error = catchError(() => createEditor(container, { historyLimit: 0 }));

    // Assert
    expect(error).toBeInstanceOf(RangeError);
    expect(container.childNodes).toHaveLength(0);
  });

  it('rejects a container that is not an element with a French TypeError', () => {
    // Act
    const error = catchError(() => createEditor(null as unknown as HTMLElement));

    // Assert
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toContain('doit être un élément HTML');
  });
});

describe('createEditor root element and context', () => {
  it('appends a JsTimeLine root element to the container', () => {
    // Arrange
    const container = createContainer();

    // Act
    const editor = createEditor(container);

    // Assert
    expect(EDITOR_ROOT_CLASS).toBe('JsTimeLine');
    expect(container.children).toHaveLength(1);
    expect(editor.container.parentElement).toBe(container);
    expect(editor.container.classList.contains('JsTimeLine')).toBe(true);
  });

  it('gives each plugin the editor context', () => {
    // Arrange
    const container = createContainer();
    const data = createDocument();
    const { plugin, context } = captureContext();

    // Act
    const editor = createEditor(container, { data, plugins: [plugin] });
    const ctx: IEditorContext = context();

    // Assert
    expect(ctx.document).toBe(data);
    expect(ctx.container).toBe(editor.container);
    expect(ctx.slots.get(ROOT_SLOT)).toBe(editor.container);
    expect(ctx.root).toBe(document);
    expect(typeof ctx.events.on).toBe('function');
    expect(typeof ctx.commands.execute).toBe('function');
    expect(typeof ctx.services.provide).toBe('function');
  });

  it('passes options.root to the context', () => {
    // Arrange
    const root = document.createElement('main');
    const { plugin, context } = captureContext();

    // Act
    createEditor(createContainer(), { root, plugins: [plugin] });

    // Assert
    expect(context().root).toBe(root);
  });

  it('initialises plugins in dependency order, whatever the given order', () => {
    // Arrange
    const log: string[] = [];
    const plugins = [
      makeEditorPlugin(log, 'layers.lock', ['layers.list']),
      makeEditorPlugin(log, 'layers.list', ['layout']),
      makeEditorPlugin(log, 'layout', ['core'])
    ];

    // Act
    createEditor(createContainer(), { defaultPlugins: false, plugins });

    // Assert
    expect(log).toEqual(['init:layout', 'init:layers.list', 'init:layers.lock']);
  });

  it('lets a plugin render into ROOT_SLOT and define slots for the next ones', () => {
    // Arrange
    const log: string[] = [];
    const shell = makeEditorPlugin(log, 'shell', [], {
      onInit: (ctx) => {
        const zone = document.createElement('div');
        zone.className = 'zone';
        ctx.container.appendChild(zone);
        ctx.slots.define('shell.zone', zone);
      },
      onRender: (slot) => slot.setAttribute('data-shell', 'yes')
    });
    const panel = makeEditorPlugin(log, 'panel', ['shell'], {
      slot: 'shell.zone',
      onRender: (slot) => (slot.textContent = 'Calques')
    });

    // Act
    const editor = createEditor(createContainer(), { plugins: [panel, shell] });

    // Assert
    expect(editor.container.getAttribute('data-shell')).toBe('yes');
    expect(editor.container.querySelector('.zone')?.textContent).toBe('Calques');
    expect(log).toEqual(['init:shell', 'init:panel', 'render:shell', 'render:panel']);
  });

  it('emits editor:ready with the plugin ids in initialisation order', () => {
    // Arrange
    const payloads: Array<readonly string[]> = [];
    const listener = makeEditorPlugin([], 'listener', ['core'], {
      onInit: (ctx) => void ctx.events.on('editor:ready', (event) => payloads.push(event.pluginIds))
    });
    const late = makeEditorPlugin([], 'late', ['listener']);

    // Act
    createEditor(createContainer(), { defaultPlugins: false, plugins: [late, listener] });

    // Assert
    expect(payloads).toEqual([['listener', 'late']]);
  });
});

describe('createEditor plugin sets', () => {
  it('returns new instances of the default set on each call (layout epic first)', () => {
    // Act
    const first = defaultPlugins();
    const second = defaultPlugins();

    // Assert
    expect(first.map((plugin) => plugin.id)).toEqual(['layout']);
    expect(second).not.toBe(first);
    expect(second[0]).not.toBe(first[0]);
  });

  it('uses the default set, then options.plugins, when defaultPlugins is omitted or true', () => {
    // Arrange
    const extra = makeEditorPlugin([], 'extra');

    // Act
    const omitted = resolvePlugins({ plugins: [extra] });
    const explicit = resolvePlugins({ defaultPlugins: true, plugins: [extra] });

    // Assert
    const expectedIds = [...defaultPlugins().map((plugin) => plugin.id), 'extra'];
    expect(omitted.map((plugin) => plugin.id)).toEqual(expectedIds);
    expect(explicit.map((plugin) => plugin.id)).toEqual(expectedIds);
    expect(omitted[omitted.length - 1]).toBe(extra);
  });

  it('loads no default plugin when defaultPlugins is false', () => {
    // Arrange
    const extra = makeEditorPlugin([], 'extra');

    // Act
    const plugins = resolvePlugins({ defaultPlugins: false, plugins: [extra] });

    // Assert
    expect(plugins).toEqual([extra]);
  });

  it('replaces the default set with an array and adds options.plugins after it', () => {
    // Arrange
    const log: string[] = [];
    const replacement = [makeEditorPlugin(log, 'base.one'), makeEditorPlugin(log, 'base.two')];
    const extra = makeEditorPlugin(log, 'extra');

    // Act
    createEditor(createContainer(), { defaultPlugins: replacement, plugins: [extra] });

    // Assert
    expect(log).toEqual(['init:base.one', 'init:base.two', 'init:extra']);
  });

  it('refuses a duplicate plugin id before touching the DOM', () => {
    // Arrange
    const container = createContainer();
    const plugins = [makeEditorPlugin([], 'twin'), makeEditorPlugin([], 'twin')];

    // Act
    const error = catchError(() => createEditor(container, { plugins }));

    // Assert
    expect(error).toBeInstanceOf(PluginError);
    expect((error as PluginError).code).toBe('duplicate-id');
    expect(container.childNodes).toHaveLength(0);
  });
});
