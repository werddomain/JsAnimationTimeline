// packages/editor/src/index.ts
/**
 * Point d'entrée public du package editor.
 *
 * Pendant la migration v2, il expose deux API côte à côte :
 * - le contrôle v1 (legacy), réexporté tel quel (`JsTimeLine`,
 *   `attachEventLogger`...) : la page de démo actuelle s'en sert ;
 * - l'éditeur v2 en plugins : `createEditor()`, le jeu de plugins par
 *   défaut, le contrat des plugins (`IEditorContext`, `EditorPlugin`,
 *   `EditorServiceMap`...) et les valeurs du noyau utiles aux plugins
 *   (erreurs, commandes, `ROOT_SLOT`).
 *
 * Les exports v2 sont nommés un par un (pas de `export *`) : une collision
 * de noms avec le legacy serait ainsi signalée par le compilateur au lieu
 * d'être ignorée en silence. Le Store, la `CommandStack`, l'`EventBus` et le
 * `PluginHost` ne sont pas exportés comme valeurs : seul `createEditor()`
 * les crée.
 */
export * from './legacy/JsTimeLine';

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
  EditorEventName,
  EditorPlugin,
  EditorServiceId,
  EditorServiceMap,
  IEditorCommands,
  IEditorContext,
  IEditorEvents,
  IEditorServices
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
export { StoreError } from './core/store';
export type { DocumentChangeCause, DocumentChangedEvent, DocumentLoadedEvent } from './core/store';
