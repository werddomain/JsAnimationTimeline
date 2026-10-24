// packages/editor/src/plugins/interaction/shortcuts/index.ts
/**
 * Point d'entrée du plugin `interaction.shortcuts` : le plugin, sa fabrique,
 * son erreur et ses types publics. L'import de `types` rend visibles
 * l'augmentation de `EditorServiceMap` et celle de `TimelineEventMap`.
 */

export { SHORTCUTS_PLUGIN_ID, ShortcutsPlugin, createShortcutsPlugin } from './ShortcutsPlugin';
export { ShortcutError } from './ShortcutError';
export type { ShortcutErrorCode } from './ShortcutError';
export type {
  IShortcutDefinition,
  IShortcutInfo,
  IShortcutsOptions,
  IShortcutsService,
  ShortcutTriggeredEvent
} from './types';
