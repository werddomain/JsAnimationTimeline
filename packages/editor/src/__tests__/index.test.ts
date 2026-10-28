// packages/editor/src/__tests__/index.test.ts
/** Vérifie les exports publics de l'éditeur v2. */

import * as api from '..';
import type {
  CoreEventName,
  EditorPlugin,
  IEditor,
  IEditorContext,
  IPlugin,
  PluginEventName,
  SetPropertyOptions,
  TimelineEventMap
} from '..';

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
  'FRAME_CLIP_FORMAT',
  'FRAME_CLIP_VERSION',
  'FRAMES_CLIPBOARD_PLUGIN_ID',
  'FramesClipboardIds',
  'FramesClipboardKeys',
  'FRAMES_GRID_CLASSES',
  'FRAMES_GRID_PLUGIN_ID',
  'FRAMES_KEYFRAMES_CLASSES',
  'FRAMES_KEYFRAMES_PLUGIN_ID',
  'FRAMES_SELECTION_CLASSES',
  'FRAMES_SELECTION_PLUGIN_ID',
  'FramesClipboardPlugin',
  'FramesKeyframesPlugin',
  'FramesSelectionPlugin',
  'FramesGridPlugin',
  'FramesPlugin',
  'LAYOUT_SLOTS',
  'MAX_FPS',
  'MIN_FPS',
  'MAX_TOTAL_FRAMES',
  'MIN_TOTAL_FRAMES',
  'TIME_SETTINGS_PLUGIN_ID',
  'TimeSettingsLabels',
  'TimeSettingsPlugin',
  'LAYOUT_ZONES',
  'LAYERS_GROUPS_PLUGIN_ID',
  'LAYERS_COLOR_PLUGIN_ID',
  'LAYERS_ICON_PLUGIN_ID',
  'LAYERS_LIST_PLUGIN_ID',
  'LayerColorPlugin',
  'LayerIconPlugin',
  'LAYERS_SELECTION_PLUGIN_ID',
  'LAYERS_TOOLBAR_PLUGIN_ID',
  'LayerGroupsPlugin',
  'LayerListPlugin',
  'LayerSelectionPlugin',
  'LayerToolbarPlugin',
  'LayersPlugin',
  'LAYERS_REORDER_PLUGIN_ID',
  'LayerReorderPlugin',
  'LAYER_LIST_CLASSES',
  'LAYER_ROW_CLASSES',
  'SELECTED_ROW_CLASS',
  'NAME_EDITING_ATTRIBUTE',
  'createSetCollapsedCommand',
  'createToggleCollapsedCommand',
  'createMoveLayersCommand',
  'detachNodes',
  'findNodeLocation',
  'insertNodes',
  'moveNodes',
  'topMostIds',
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
  'ZoomPlugin',
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
  'createEditorHtmlStage',
  'createEmptyDocument',
  'createSetFpsCommand',
  'createSetTotalFramesCommand',
  'createPersistenceJsonPlugin',
  'createPlaybackControlsPlugin',
  'createShortcutsPlugin',
  'createTimeSettingsPlugin',
  'createToolbarMainPlugin',
  'createUndoRedoPlugin',
  'defaultPlugins',
  'FIT_OPTION_VALUE',
  'ZOOM_CONTROL_PLUGIN_ID',
  'ZoomControlPlugin',
  'createZoomControlPlugin',
  'KEYFRAME_ACTIONS_PLUGIN_ID',
  'KeyframeActionsPlugin',
  'createKeyframeActionsPlugin',
  'MOTION_TWEEN_PLUGIN_ID',
  'MotionTweenCodes',
  'MotionTweenCommandLabels',
  'MotionTweenError',
  'MotionTweenMessages',
  'MotionTweenPlugin',
  'TweensPlugin',
  'createMotionTween',
  'createMotionTweenBetween',
  'createMotionTweenCommands',
  'createMotionTweenFromSpan',
  'removeMotionTween',
  'removeMotionTweens',
  'resolveCreateTarget',
  'resolveRemoveTargets',
  'DEFAULT_PREVIEW_MAX_FPS',
  'LIVE_PREVIEW_MODES',
  'LIVE_PREVIEW_PLUGIN_ID',
  'LivePreviewPlugin',
  'createLivePreviewPlugin',
  'CONTEXT_MENU_PLUGIN_ID',
  'ContextMenuPlugin',
  'EASING_PLUGIN_ID',
  'EasingPlugin',
  'createEasingPlugin',
  'createSetEasingCommand',
  'setSpanEasing',
  'SetPropertyCommand',
  'applyPropertyValue',
  'PropertyOperationError',
  'getTargetPropertyNames',
  'PROPERTY_KEYFRAMES_PLUGIN_ID',
  'PropertyKeyframesPlugin',
  'PROPERTIES_PANEL_PLUGIN_ID',
  'PropertiesPanelPlugin',
  'createPropertiesPanelPlugin'
];

describe('editor package entry point', () => {
  it('exports only v2 values and removes the legacy API', () => {
    expect(Object.keys(api).sort()).toEqual([...V2_NAMES].sort());
    LEGACY_NAMES.forEach((name) => expect(name in api).toBe(false));
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
    assertType<Equals<Parameters<IEditor['setProperty']>[3], SetPropertyOptions | undefined>>(true);
    expect(true).toBe(true);
  });
});
