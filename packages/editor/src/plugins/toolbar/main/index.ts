// packages/editor/src/plugins/toolbar/main/index.ts
/**
 * Point d'entrée du plugin `toolbar.main` : le plugin, sa fabrique, son
 * erreur et ses types publics. L'import de `types` rend visible
 * l'augmentation de `EditorServiceMap`.
 */

export {
  DEFAULT_SCENE_NAME,
  TOOLBAR_CLASS,
  TOOLBAR_MAIN_PLUGIN_ID,
  ToolbarMainPlugin,
  createToolbarMainPlugin
} from './ToolbarMainPlugin';
export { DEFAULT_TOOLBAR_GROUP } from './ToolbarItems';
export { ToolbarError } from './ToolbarError';
export type { ToolbarErrorCode } from './ToolbarError';
export type {
  IToolbarButtonDefinition,
  IToolbarControlDefinition,
  IToolbarItemDefinition,
  IToolbarItemInfo,
  IToolbarMainOptions,
  IToolbarMainService
} from './types';
