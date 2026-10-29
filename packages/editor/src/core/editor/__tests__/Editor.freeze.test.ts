// packages/editor/src/core/editor/__tests__/Editor.freeze.test.ts
/**
 * Tests du gel en profondeur des documents : document initial (donné ou
 * vide), documents produits par les commandes, annuler / rétablir et
 * `load`, vus gelés par les gestionnaires des plugins ; modification en
 * place refusée ; document invalide laissé intact ; `freezeDocument` qui
 * parcourt un objet gelé en surface par l'hôte.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createDocument, renameLayer, setFps } from '../../commands/__tests__/fixtures';
import type { IEditorContext } from '../../context/IEditorContext';
import { StoreError } from '../../store/StoreError';
import { createEditor } from '../createEditor';
import { freezeDocument } from '../freezeDocument';
import { captureContext, catchError, cleanBody, createContainer, makeEditorPlugin } from './fixtures';

afterEach(cleanBody);

/** Copie modifiable (non gelée) d'un document de test. */
function mutableDocument(fps = 24): ITimelineDocument {
  return JSON.parse(JSON.stringify(createDocument(fps))) as ITimelineDocument;
}

/** Vrai si `value` et tous ses descendants sont gelés. */
function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

function editorWithContext(data: ITimelineDocument): IEditorContext {
  const { plugin, context } = captureContext();
  createEditor(createContainer(), { data, plugins: [plugin] });
  return context();
}

describe('Editor document freezing', () => {
  it('deep-freezes the given data in place once validated', () => {
    // Arrange
    const data = mutableDocument();

    // Act
    const editor = createEditor(createContainer(), { data });

    // Assert
    expect(editor.document).toBe(data);
    expect(isDeepFrozen(data)).toBe(true);
  });

  it('deep-freezes the default empty document', () => {
    // Act
    const editor = createEditor(createContainer());

    // Assert
    expect(isDeepFrozen(editor.document)).toBe(true);
  });

  it('refuses in-place mutation of ctx.document without any event', () => {
    // Arrange
    const ctx = editorWithContext(mutableDocument());
    const changes: string[] = [];
    ctx.events.on('document:changed', ({ label }) => changes.push(label));
    const layers = ctx.document.layers as ITimelineDocument['layers'][number][];

    // Act
    const pushError = catchError(() => layers.push({ id: 'l3', type: 'layer', name: 'X', spans: [] }));
    const assignError = catchError(() => {
      (ctx.document.settings as { fps: number }).fps = 60;
    });

    // Assert
    expect(pushError).toBeInstanceOf(TypeError);
    expect(assignError).toBeInstanceOf(TypeError);
    expect(ctx.document.layers).toHaveLength(2);
    expect(ctx.document.settings.fps).toBe(24);
    expect(changes).toEqual([]);
  });

  it('shows plugins a frozen document after execute, undo and redo', () => {
    // Arrange
    const frozen: boolean[] = [];
    const plugin = makeEditorPlugin([], 'watcher', [], {
      onInit: (ctx) => void ctx.events.on('document:changed', ({ document }) => frozen.push(isDeepFrozen(document)))
    });
    const editor = createEditor(createContainer(), { data: mutableDocument(), plugins: [plugin] });

    // Act
    editor.execute(renameLayer('l1', 'Titre', 'Logo'));
    editor.execute(setFps(30, 24));
    editor.undo();
    editor.redo();

    // Assert
    expect(frozen).toEqual([true, true, true, true]);
    expect(isDeepFrozen(editor.document)).toBe(true);
  });

  it('deep-freezes a loaded document before plugins see document:loaded', () => {
    // Arrange
    const seen: boolean[] = [];
    const plugin = makeEditorPlugin([], 'watcher', [], {
      onInit: (ctx) => void ctx.events.on('document:loaded', ({ document }) => seen.push(isDeepFrozen(document)))
    });
    const editor = createEditor(createContainer(), { plugins: [plugin] });
    const next = mutableDocument(30);

    // Act
    editor.load(next);

    // Assert
    expect(seen).toEqual([true]);
    expect(editor.document).toBe(next);
    expect(isDeepFrozen(next)).toBe(true);
  });

  it('leaves invalid data unfrozen', () => {
    // Arrange
    const base = mutableDocument();
    const invalid: ITimelineDocument = { ...base, settings: { ...base.settings, totalFrames: 5 } };

    // Act
    const error = catchError(() => createEditor(createContainer(), { data: invalid }));
    const editor = createEditor(createContainer());
    const loadError = catchError(() => editor.load(invalid));

    // Assert
    expect(error).toBeInstanceOf(StoreError);
    expect(loadError).toBeInstanceOf(StoreError);
    expect(Object.isFrozen(invalid)).toBe(false);
    expect(Object.isFrozen(invalid.layers)).toBe(false);
  });
});

describe('freezeDocument', () => {
  it('walks into an object that the host froze only at the surface', () => {
    // Arrange
    const doc = Object.freeze(mutableDocument());

    // Act
    const result = freezeDocument(doc);

    // Assert
    expect(result).toBe(doc);
    expect(isDeepFrozen(doc)).toBe(true);
  });
});
