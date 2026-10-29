// packages/editor/src/plugins/persistence/json/__tests__/PersistenceJsonPlugin.test.ts
/**
 * Plugin persistence.json dans un vrai éditeur : service, import annulable,
 * fichiers v1, refus sans effet, veto, événements, export, fichier lu,
 * téléchargement, options et destruction.
 */

import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { PersistenceError } from '../PersistenceError';
import {
  DEFAULT_JSON_FILE_NAME,
  PERSISTENCE_JSON_PLUGIN_ID,
  PersistenceJsonPlugin,
  createPersistenceJsonPlugin
} from '../PersistenceJsonPlugin';
import type {
  IPersistenceJsonOptions,
  IPersistenceJsonService,
  PersistenceExportedEvent,
  PersistenceImportedEvent
} from '../types';
import { makeV1Document, makeV2Document } from './fixtures';

interface IHarness {
  readonly editor: IEditor;
  readonly persistence: IPersistenceJsonService;
  readonly imported: PersistenceImportedEvent[];
  readonly exported: PersistenceExportedEvent[];
}

const editors: IEditor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.innerHTML = '';
});

/** Plugin qui consigne les événements de persistance (un plugin écoute les autres). */
function recorder(harness: Pick<IHarness, 'imported' | 'exported'>): EditorPlugin {
  return {
    id: 'test.recorder',
    dependencies: ['persistence.json'],
    init: (ctx: IEditorContext) => {
      ctx.events.on('persistence:imported', (event) => harness.imported.push(event));
      ctx.events.on('persistence:exported', (event) => harness.exported.push(event));
    },
    destroy: () => undefined
  };
}

function setup(options?: IPersistenceJsonOptions, extra: readonly EditorPlugin[] = []): IHarness {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const events = { imported: [] as PersistenceImportedEvent[], exported: [] as PersistenceExportedEvent[] };
  const editor = createEditor(host, {
    defaultPlugins: options === undefined ? true : [createPersistenceJsonPlugin(options)],
    plugins: [recorder(events), ...extra]
  });
  editors.push(editor);
  const persistence = editor.getService('persistence.json');
  if (persistence === undefined) throw new Error('service persistence.json absent');
  return { editor, persistence, ...events };
}

describe('persistence.json plugin', () => {
  it('is part of the default plugin set and provides its service', () => {
    // Act
    const { persistence } = setup();

    // Assert
    expect(PERSISTENCE_JSON_PLUGIN_ID).toBe('persistence.json');
    expect(Object.isFrozen(persistence)).toBe(true);
  });

  it('declares its id and dependencies', () => {
    // Act
    const plugin = createPersistenceJsonPlugin();

    // Assert
    expect(plugin).toBeInstanceOf(PersistenceJsonPlugin);
    expect(plugin.id).toBe('persistence.json');
    expect(plugin.dependencies).toEqual(['core']);
  });

  it('imports a v2 JSON text through an undoable command and emits persistence:imported', () => {
    // Arrange
    const { editor, persistence, imported } = setup();
    const before = editor.document;
    const doc = makeV2Document();

    // Act
    const result = persistence.importDocument(JSON.stringify(doc));

    // Assert
    expect(result.applied).toBe(true);
    expect(result.migrated).toBe(false);
    expect(editor.document).toEqual(doc);
    expect(Object.isFrozen(editor.document)).toBe(true);
    expect(imported).toEqual([{ document: editor.document, migrated: false, warnings: [] }]);
    expect(editor.canUndo).toBe(true);

    // Act: Ctrl+Z
    editor.undo();

    // Assert
    expect(editor.document).toBe(before);
  });

  it('keeps the targets untouched in the editor document', () => {
    // Arrange
    const { editor, persistence } = setup();

    // Act
    persistence.importDocument(JSON.stringify(makeV2Document()));

    // Assert
    const targets = editor.document.layers.map((node) => (node.type === 'layer' ? node.target : undefined));
    expect(targets).toEqual([{ selector: '#box' }, { ref: 'hero', stage: 'canvas' }, { ref: 'music' }, undefined]);
  });

  it('does not freeze a v2 object given by the caller', () => {
    // Arrange
    const { editor, persistence } = setup();
    const doc = makeV2Document();

    // Act
    persistence.importDocument(doc);

    // Assert
    expect(editor.document).not.toBe(doc);
    expect(Object.isFrozen(doc)).toBe(false);
  });

  it('imports a v1 file through the migrator', () => {
    // Arrange
    const { editor, persistence, imported } = setup();

    // Act
    const result = persistence.importDocument(JSON.stringify(makeV1Document()));

    // Assert
    expect(result.migrated).toBe(true);
    expect(editor.document.version).toBe('2.0.0');
    expect(editor.document.settings.totalFrames).toBe(20);
    expect(imported[0]?.migrated).toBe(true);
  });

  it('throws a PersistenceError and changes nothing for a refused file', () => {
    // Arrange
    const { editor, persistence, imported } = setup();
    const before = editor.document;

    // Act / Assert
    expect(() => persistence.importDocument('{"version":"2.0.0"}')).toThrow(PersistenceError);
    expect(() => persistence.importDocument('pas du json')).toThrow(PersistenceError);
    expect(editor.document).toBe(before);
    expect(editor.canUndo).toBe(false);
    expect(imported).toEqual([]);
  });

  it('reports applied: false and emits nothing when command:before is vetoed', () => {
    // Arrange
    const veto: EditorPlugin = {
      id: 'test.veto',
      dependencies: [],
      init: (ctx) => {
        ctx.events.onCancellable('command:before', (event) => event.cancel());
      },
      destroy: () => undefined
    };
    const { editor, persistence, imported } = setup(undefined, [veto]);
    const before = editor.document;

    // Act
    const result = persistence.importDocument(JSON.stringify(makeV2Document()));

    // Assert
    expect(result.applied).toBe(false);
    expect(editor.document).toBe(before);
    expect(imported).toEqual([]);
  });

  it('reads a document without loading it', () => {
    // Arrange
    const { editor, persistence } = setup();
    const before = editor.document;

    // Act
    const result = persistence.read(JSON.stringify(makeV1Document()));

    // Assert
    expect(result.migrated).toBe(true);
    expect(editor.document).toBe(before);
  });

  it('exports the current document as JSON and emits persistence:exported', () => {
    // Arrange
    const { editor, persistence, exported } = setup();
    persistence.importDocument(JSON.stringify(makeV2Document()));

    // Act
    const json = persistence.exportJson();

    // Assert
    expect(json).toBe(JSON.stringify(editor.toJSON(), null, 2));
    expect(exported).toEqual([{ document: editor.document, json }]);
    expect(persistence.read(json).document).toEqual(editor.document);
  });

  it('uses the space option of the plugin, overridden per call', () => {
    // Arrange
    const { persistence } = setup({ space: 0 });

    // Act
    const compact = persistence.exportJson();
    const indented = persistence.exportJson({ space: 4 });

    // Assert
    expect(compact).not.toContain('\n');
    expect(indented).toContain('\n    "settings"');
  });

  it('uses the importLabel option in the history', () => {
    // Arrange
    const host = document.createElement('div');
    const editor = createEditor(host, { defaultPlugins: [createPersistenceJsonPlugin({ importLabel: 'Ouvrir' })] });
    editors.push(editor);
    const labels: string[] = [];
    editor.on('history:changed', (event) => labels.push(String(event.undoLabel)));

    // Act
    editor.getService('persistence.json')?.importDocument(JSON.stringify(makeV2Document()));

    // Assert
    expect(labels).toEqual(['Ouvrir']);
  });

  it('imports the text of a file', async () => {
    // Arrange
    const { editor, persistence } = setup();
    const text = JSON.stringify(makeV2Document());
    const file = { text: () => Promise.resolve(text) } as Blob;

    // Act
    const result = await persistence.importFile(file);

    // Assert
    expect(result.applied).toBe(true);
    expect(editor.document).toEqual(makeV2Document());
  });

  describe('download', () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    let created: Blob[];
    let revoked: string[];
    let clicked: { href: string; download: string }[];

    beforeEach(() => {
      jest.useFakeTimers();
      created = [];
      revoked = [];
      clicked = [];
      URL.createObjectURL = (blob: Blob): string => {
        created.push(blob);
        return 'blob:test';
      };
      URL.revokeObjectURL = (url: string): void => {
        revoked.push(url);
      };
      jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push({ href: this.href, download: this.download });
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });

    it('downloads the exported JSON and frees the object URL', () => {
      // Arrange
      const { persistence, exported } = setup();

      // Act
      persistence.download();
      const revokedBeforeTick = [...revoked];
      jest.runAllTimers();

      // Assert
      expect(created).toHaveLength(1);
      expect(created[0]?.type).toBe('application/json');
      expect(clicked).toEqual([{ href: 'blob:test', download: DEFAULT_JSON_FILE_NAME }]);
      expect(exported).toHaveLength(1);
      expect(revokedBeforeTick).toEqual([]);
      expect(revoked).toEqual(['blob:test']);
      expect(document.querySelector('a[download]')).toBeNull();
    });

    it('uses the given file name, then the fileName option', () => {
      // Arrange
      const { persistence } = setup({ fileName: 'scene.json' });

      // Act
      persistence.download();
      persistence.download('autre.json');

      // Assert
      expect(clicked.map((entry) => entry.download)).toEqual(['scene.json', 'autre.json']);
    });
  });

  it('removes its service on destroy and refuses calls afterwards', () => {
    // Arrange
    const { editor, persistence } = setup();

    // Act
    editor.destroy();

    // Assert
    expect(() => persistence.exportJson()).toThrow(/persistence\.json/);
    expect(() => persistence.importDocument('{}')).toThrow(/persistence\.json/);
  });

  it('ignores a second destroy', () => {
    // Arrange
    const plugin = createPersistenceJsonPlugin();

    // Act / Assert
    expect(() => plugin.destroy()).not.toThrow();
  });
});
