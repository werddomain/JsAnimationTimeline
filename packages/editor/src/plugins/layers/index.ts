// packages/editor/src/plugins/layers/index.ts
/** Epic `layers` : les calques de la timeline et leurs plugins. */

export { LayersPlugin } from './LayersPlugin';
export {
  LAYERS_LIST_PLUGIN_ID,
  LAYER_LIST_CLASSES,
  LAYER_ROW_CLASSES,
  LayerListPlugin,
  NAME_EDITING_ATTRIBUTE,
  createSetCollapsedCommand,
  createToggleCollapsedCommand,
  updateLayerNode
} from './list';
export type { LayerNodeUpdater } from './list';
export type { ILayerListService, ILayerRow, ILayerRowControl, LayerRowsChangedEvent } from './list';
export { LAYERS_COLOR_PLUGIN_ID, LayerColorPlugin, createSetColorCommand, normalizeLayerColor } from './color';
export type { ILayerColorService } from './color';
export { LAYERS_ICON_PLUGIN_ID, LayerIconPlugin, createSetIconCommand, validateLayerIcon } from './icon';
export type { ILayerIconService } from './icon';
