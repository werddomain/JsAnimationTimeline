// packages/editor/src/__tests__/index.test.ts
/**
 * Vérifie le point d'entrée public du package editor : les noms du contrôle
 * legacy utilisés par la démo restent exportés, et l'API v2 (createEditor,
 * jeu par défaut, erreurs et commandes du noyau) est ajoutée sans collision.
 * Les collisions de noms (valeurs et types) sont refusées par le compilateur
 * car l'index nomme tous ses exports ; ce test vérifie la liste exacte des
 * valeurs et que la liste legacy de l'index couvre tout le module legacy.
 * Le Store, la pile, le bus et l'hôte de plugins ne sont pas exportés.
 */

import * as api from '..';
import type {
  CoreEventName,
  EditorPlugin,
  IEditor,
  IEditorContext,
  IPlugin,
  PluginEventName,
  TimelineEventMap
} from '..';
import * as legacy from '../legacy/JsTimeLine';

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
  'DEFAULT_SCENE_NAME',
  'DEFAULT_TOTAL_FRAMES',
  'DEFAULT_TOOLBAR_GROUP',
  'EDITOR_ROOT_CLASS',
  'HistoryPlugin',
  'LAYOUT_SLOTS',
  'MAX_FPS',
  'MIN_FPS',
  'MIN_TOTAL_FRAMES',
  'TIME_SETTINGS_PLUGIN_ID',
  'TimeSettingsLabels',
  'TimeSettingsPlugin',
  'LAYOUT_ZONES',
  'LAYERS_LIST_PLUGIN_ID',
  'LAYERS_SELECTION_PLUGIN_ID',
  'LayerListPlugin',
  'LayerSelectionPlugin',
  'LayersPlugin',
  'LAYER_LIST_CLASSES',
  'LAYER_ROW_CLASSES',
  'SELECTED_ROW_CLASS',
  'NAME_EDITING_ATTRIBUTE',
  'createSetCollapsedCommand',
  'createToggleCollapsedCommand',
  'updateLayerNode',
  'LayoutPlugin',
  'LayoutShellPlugin',
  'PERSISTENCE_JSON_PLUGIN_ID',
  'PersistenceError',
  'PlayheadPlugin',
  'PLAYBACK_CONTROLS_PLUGIN_ID',
  'PLAYBACK_SPEEDS',
  'PLAYBACK_TOGGLE_KEYS',
  'PlaybackControlsPlugin',
  'PlaybackPlugin',
  'PluginError',
  'ROOT_SLOT',
  'RulerPlugin',
  'ScrollSyncPlugin',
  'SHORTCUTS_PLUGIN_ID',
  'ShortcutError',
  'StoreError',
  'TOOLBAR_MAIN_PLUGIN_ID',
  'UNDO_REDO_PLUGIN_ID',
  'UndoRedoIds',
  'UndoRedoKeys',
  'UndoRedoPlugin',
  'ToolbarError',
  'ToolbarGroupOrders',
  'ToolbarMainPlugin',
  'ToolbarPlugin',
  'UNKNOWN_PROPERTY',
  'createCommand',
  'createEditor',
  'createEmptyDocument',
  'createSetFpsCommand',
  'createSetTotalFramesCommand',
  'createPersistenceJsonPlugin',
  'createPlaybackControlsPlugin',
  'createShortcutsPlugin',
  'createTimeSettingsPlugin',
  'createToolbarMainPlugin',
  'createUndoRedoPlugin',
  'defaultPlugins'
];

describe('editor package entry point', () => {
  it('keeps exporting the legacy names used by the demo', () => {
    // Assert
    LEGACY_NAMES.forEach((name) => expect(name in api).toBe(true));
    expect(typeof api.JsTimeLine).toBe('function');
    expect(typeof api.attachEventLogger).toBe('function');
  });

  it('re-exports every value of the legacy module (explicit list kept complete)', () => {
    // Assert
    expect(Object.keys(legacy).sort()).toEqual([...LEGACY_NAMES].sort());
    LEGACY_NAMES.forEach((name) =>
      expect(api[name as keyof typeof api]).toBe(legacy[name as keyof typeof legacy])
    );
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
    assertType<Equals<Extract<PluginEventName, CoreEventName>, never>>(true);
    expect(true).toBe(true);
  });
});
