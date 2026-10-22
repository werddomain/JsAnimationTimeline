// packages/editor/src/core/plugin/index.ts
/**
 * Point d'entrée du système de plugins de l'éditeur (contrat, hôte,
 * emplacements de rendu, tri des dépendances et erreurs).
 */

export type { IPlugin } from './IPlugin';
export { PluginError } from './PluginError';
export type { PluginErrorCode } from './PluginError';
export { PLUGIN_ID_PATTERN, assertValidPluginId, isValidPluginId } from './pluginId';
export { ROOT_SLOT, SlotRegistry } from './SlotRegistry';
export { topologicalSort } from './topologicalSort';
export type { ISortNode } from './topologicalSort';
export { PluginHost } from './PluginHost';
export type { PluginHostOptions } from './PluginHost';
