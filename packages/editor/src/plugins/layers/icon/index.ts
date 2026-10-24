// packages/editor/src/plugins/layers/icon/index.ts
/** Plugin `layers.icon` : choix de l'icône des calques. */

export { LAYERS_ICON_PLUGIN_ID, LayerIconPlugin } from './LayerIconPlugin';
export { ICON_MENU_CLASSES, IconMenu } from './IconMenu';
export type { IconMenuHandlers } from './IconMenu';
export { LAYER_ICON_TEXTS, iconChoices } from './iconChoices';
export type { IconChoice } from './iconChoices';
export {
  LAYER_ICON_COMMAND_LABEL,
  LAYER_ICON_ERRORS,
  createSetIconCommand,
  validateLayerIcon
} from './iconCommand';
export type { LayerIconValidation } from './iconCommand';
export type { ILayerIconService } from './types';
