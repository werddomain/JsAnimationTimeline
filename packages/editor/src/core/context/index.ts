// packages/editor/src/core/context/index.ts
/**
 * Point d'entrée du contexte de l'éditeur : le contrat `IEditorContext` reçu
 * par les plugins, ses façades et le registre des services entre plugins.
 */

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
} from './IEditorContext';
export { CORE_EVENT_NAMES, assertPluginEvent, isCoreEventName } from './coreEvents';
export { createEditorContext } from './createEditorContext';
export type { AssertActive, IEditorContextSources } from './createEditorContext';
export { ServiceRegistry } from './ServiceRegistry';
