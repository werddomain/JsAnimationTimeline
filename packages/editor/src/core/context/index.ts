// packages/editor/src/core/context/index.ts
/**
 * Point d'entrée du contexte de l'éditeur : le contrat `IEditorContext` reçu
 * par les plugins, ses façades et le registre des services entre plugins.
 */

export type {
  EditorEventName,
  EditorPlugin,
  EditorServiceId,
  EditorServiceMap,
  IEditorCommands,
  IEditorContext,
  IEditorEvents,
  IEditorServices
} from './IEditorContext';
export { createEditorContext } from './createEditorContext';
export type { AssertActive, IEditorContextSources } from './createEditorContext';
export { ServiceRegistry } from './ServiceRegistry';
