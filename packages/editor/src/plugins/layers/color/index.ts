// packages/editor/src/plugins/layers/color/index.ts
/** Plugin `layers.color` : couleur des calques et des dossiers. */

export { LAYERS_COLOR_PLUGIN_ID, LayerColorPlugin } from './LayerColorPlugin';
export {
  LAYER_COLOR_CLASSES,
  LAYER_COLOR_CONTROL_ORDER,
  LAYER_COLOR_TEXTS,
  createLayerColorControl
} from './layerColorControl';
export { LAYER_COLOR_COMMAND_LABEL, createSetColorCommand, normalizeLayerColor } from './layerColor';
export type { ILayerColorService } from './types';
