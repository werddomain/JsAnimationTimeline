// packages/editor/src/__tests__/index.test.ts
/**
 * Vérifie le point d'entrée public du package editor : les noms du contrôle
 * legacy utilisés par la démo restent exportés, et l'API v2 (createEditor,
 * jeu par défaut, erreurs et commandes du noyau) est ajoutée sans collision.
 * Le Store, la pile, le bus et l'hôte de plugins ne sont pas exportés.
 */

import * as api from '..';
import type { EditorPlugin, IEditor, IEditorContext, IPlugin, TimelineEventMap } from '..';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

function assertType<T extends true>(value: T): T {
  return value;
}

const LEGACY_NAMES = [
  'JsTimeLine',
  'EventLogger',
  'attachEventLogger',
  'debounce',
  'throttle',
  'rafLoop',
  'calculateVisibleRange',
  'memoize',
  'PerformanceMonitor'
];

const V2_NAMES = [
  'CANCELLED_REASON',
  'CommandRefusedError',
  'CompositeCommand',
  'DEFAULT_FPS',
  'DEFAULT_HISTORY_LIMIT',
  'DEFAULT_TOTAL_FRAMES',
  'EDITOR_ROOT_CLASS',
  'PluginError',
  'ROOT_SLOT',
  'StoreError',
  'createCommand',
  'createEditor',
  'createEmptyDocument',
  'defaultPlugins'
];

describe('editor package entry point', () => {
  it('keeps exporting the legacy names used by the demo', () => {
    // Assert
    LEGACY_NAMES.forEach((name) => expect(name in api).toBe(true));
    expect(typeof api.JsTimeLine).toBe('function');
    expect(typeof api.attachEventLogger).toBe('function');
  });

  it('exports exactly the legacy names plus the v2 values', () => {
    // Assert
    expect(Object.keys(api).sort()).toEqual([...LEGACY_NAMES, ...V2_NAMES].sort());
  });

  it('does not export the raw core objects', () => {
    // Assert
    ['Store', 'CommandStack', 'EventBus', 'PluginHost', 'ServiceRegistry', 'Editor'].forEach((name) =>
      expect(name in api).toBe(false)
    );
  });

  it('creates a working editor from the public entry point', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    const editor: IEditor = api.createEditor(container);
    const root = editor.container;
    editor.destroy();

    // Assert
    expect(root.className).toBe(api.EDITOR_ROOT_CLASS);
    expect(api.ROOT_SLOT).toBe('root');
    expect(container.childNodes).toHaveLength(0);
  });

  it('exports the plugin contract types', () => {
    // Assert
    assertType<Equals<EditorPlugin, IPlugin<IEditorContext>>>(true);
    assertType<Equals<keyof TimelineEventMap & 'document:changed', 'document:changed'>>(true);
    expect(true).toBe(true);
  });
});
