// packages/editor/src/index.ts
/**
 * Point d'entrée public du package editor.
 *
 * Pendant la migration v2, il expose deux API côte à côte :
 * - le contrôle v1 (legacy), réexporté tel quel (`JsTimeLine`,
 *   `attachEventLogger`...) : la page de démo actuelle s'en sert ;
 * - l'éditeur v2 en plugins : `createEditor()`, le jeu de plugins par
 *   défaut, le contrat des plugins (`IEditorContext`, `EditorPlugin`,
 *   `EditorServiceMap`...), la lecture (`IEditorPlayback`, échantillons) et
 *   les valeurs du noyau utiles aux plugins (erreurs, commandes, `ROOT_SLOT`).
 *
 * Tous les exports, legacy compris, sont nommés un par un (aucun
 * `export *`). Avec un `export *`, un nom local du même nom masquerait en
 * silence celui du legacy, sans erreur du compilateur ; avec deux listes
 * explicites, un doublon (valeur ou type) est une vraie erreur TypeScript
 * (identificateur en double). Le test `__tests__/index.test.ts` vérifie en
 * plus la liste exacte des valeurs exportées et que la liste legacy
 * ci-dessous couvre toutes les valeurs du module legacy.
 *
 * Le Store, la `CommandStack`, l'`EventBus` et le `PluginHost` ne sont pas
 * exportés comme valeurs : seul `createEditor()` les crée.
 */

// Contrôle v1 (legacy) : exactement les exports de `legacy/JsTimeLine.ts`.
export {
  EventLogger,
  JsTimeLine,
  PerformanceMonitor,
  attachEventLogger,
  calculateVisibleRange,
  debounce,
  memoize,
  rafLoop,
  throttle
} from './legacy/JsTimeLine';

// Éditeur v2 : création et API publique.
export {
  DEFAULT_FPS,
  DEFAULT_TOTAL_FRAMES,
  EDITOR_ROOT_CLASS,
  createEditor,
  createEmptyDocument,
  defaultPlugins
} from './core/editor';
export type { EditorOptions, IEditor } from './core/editor';

// Contrat des plugins.
export type {
  CoreEventName,
  EditorEventName,
  EditorPlugin,
  EditorServiceId,
  EditorServiceMap,
  IEditorCommands,
  IEditorContext,
  IEditorEvents,
  IEditorServices,
  PluginEventName
} from './core/context';
export { PluginError, ROOT_SLOT } from './core/plugin';
export type { IPlugin, PluginErrorCode, SlotRegistry } from './core/plugin';

// Événements.
export type {
  CancellableHandler,
  EditorDestroyingEvent,
  EditorReadyEvent,
  EventHandler,
  EventName,
  ICancellableEvent,
  TimelineEventMap
} from './core/events';

// Commandes et document.
export {
  CANCELLED_REASON,
  CommandRefusedError,
  CompositeCommand,
  DEFAULT_HISTORY_LIMIT,
  createCommand
} from './core/commands';
export type {
  CommandBeforeEvent,
  CommandRefusedEvent,
  DocumentTransform,
  HistoryChangedEvent,
  ICommand
} from './core/commands';
export { StoreError, UNKNOWN_PROPERTY } from './core/store';
export type {
  DocumentChangeCause,
  DocumentChangedEvent,
  DocumentLoadedEvent,
  IUnknownPropertyIssue,
  StoreIssue,
  StoreWarningHandler
} from './core/store';

// Lecture : tête de lecture sur le Transport du runtime, échantillons et rendu.
export type {
  FrameListener,
  FrameRenderEvent,
  IEditorPlayback,
  IFrameSample,
  ILayerSample,
  PlaybackStateEvent,
  PlayheadChangedEvent
} from './core/playback';

// Plugins de mise en page (epic `layout`) : coquille, emplacements, défilement, règle et tête de lecture.
export {
  LAYOUT_SLOTS,
  LAYOUT_ZONES,
  LayoutPlugin,
  LayoutShellPlugin,
  PlayheadPlugin,
  RulerPlugin,
  ScrollSyncPlugin
} from './plugins/layout';
export type {
  IFrameScheduler,
  ILayoutShellApi,
  IScrollPosition,
  IScrollState,
  IRulerApi,
  IScrollSyncApi,
  LayoutOptions,
  LayoutZone,
  RulerOptions,
  ScrollSyncOptions
} from './plugins/layout';

// Plugins des calques (epic `layers`) : liste des calques et contrôles de ligne.
export {
  LAYERS_LIST_PLUGIN_ID,
  LAYER_LIST_CLASSES,
  LAYER_ROW_CLASSES,
  LayerListPlugin,
  LayersPlugin,
  NAME_EDITING_ATTRIBUTE,
  createSetCollapsedCommand,
  createToggleCollapsedCommand,
  updateLayerNode
} from './plugins/layers';
export type {
  ILayerListService,
  ILayerRow,
  ILayerRowControl,
  LayerNodeUpdater,
  LayerRowsChangedEvent
} from './plugins/layers';

// Plugins des images (epic `frames`) : grille des plages et des images clés.
export { FRAMES_GRID_CLASSES, FRAMES_GRID_PLUGIN_ID, FramesGridPlugin, FramesPlugin } from './plugins/frames';
export type {
  FramesGridRenderedEvent,
  IFramesGridService,
  IGridCell,
  IGridWindow
} from './plugins/frames';
export type { ZoomChangedEvent } from './plugins/layout/zoom/zoomEvents';

// Plugin interaction.shortcuts (raccourcis clavier déclarés par les plugins).
export { SHORTCUTS_PLUGIN_ID, ShortcutError, createShortcutsPlugin } from './plugins/interaction/shortcuts';
export type {
  IShortcutDefinition,
  IShortcutInfo,
  IShortcutsOptions,
  IShortcutsService,
  ShortcutErrorCode,
  ShortcutTriggeredEvent,
  ShortcutsPlugin
} from './plugins/interaction/shortcuts';

// Epic toolbar : barre d'outils principale (zone « Scène 1 », boutons et contrôles des plugins).
export {
  DEFAULT_SCENE_NAME,
  DEFAULT_TOOLBAR_GROUP,
  TOOLBAR_MAIN_PLUGIN_ID,
  ToolbarError,
  ToolbarGroupOrders,
  ToolbarMainPlugin,
  ToolbarPlugin,
  createToolbarMainPlugin
} from './plugins/toolbar';

// Plugin toolbar.timeSettings : cadence et durée, en commandes annulables.
export {
  MAX_FPS,
  MIN_FPS,
  MAX_TOTAL_FRAMES,
  MIN_TOTAL_FRAMES,
  TIME_SETTINGS_PLUGIN_ID,
  TimeSettingsLabels,
  TimeSettingsPlugin,
  createSetFpsCommand,
  createSetTotalFramesCommand,
  createTimeSettingsPlugin
} from './plugins/toolbar';
export type {
  IToolbarButtonDefinition,
  IToolbarControlDefinition,
  IToolbarItemDefinition,
  IToolbarItemInfo,
  IToolbarMainOptions,
  IToolbarMainService,
  ToolbarErrorCode,
  ToolbarOptions
} from './plugins/toolbar';

// Plugin persistence.json (import / export JSON, fichiers v1 migrés).
export { PERSISTENCE_JSON_PLUGIN_ID, PersistenceError, createPersistenceJsonPlugin } from './plugins/persistence/json';
export type {
  IImportResult,
  IPersistenceJsonOptions,
  IPersistenceJsonService,
  IReadResult,
  IWriteOptions,
  PersistenceErrorCode,
  PersistenceExportedEvent,
  PersistenceImportedEvent,
  PersistenceJsonPlugin
} from './plugins/persistence/json';

// Epic history : annuler / rétablir (boutons et raccourcis).
export {
  HistoryPlugin,
  UNDO_REDO_PLUGIN_ID,
  UndoRedoIds,
  UndoRedoKeys,
  UndoRedoPlugin,
  createUndoRedoPlugin
} from './plugins/history';

// Epic playback : lire, pause, boucle et vitesse dans la barre d'outils.
export {
  PLAYBACK_CONTROLS_PLUGIN_ID,
  PLAYBACK_SPEEDS,
  PLAYBACK_TOGGLE_KEYS,
  PlaybackControlsPlugin,
  PlaybackPlugin,
  createPlaybackControlsPlugin
} from './plugins/playback';
