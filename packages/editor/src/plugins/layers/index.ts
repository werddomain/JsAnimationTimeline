// packages/editor/src/plugins/layers/index.ts
/** Epic `layers` : les calques de la timeline et leurs plugins. */

export { LayersPlugin } from './LayersPlugin';
export { LAYERS_GROUPS_PLUGIN_ID, LayerGroupsPlugin } from './groups';
export type { ILayerGroupsService } from './groups';
export { LAYERS_TOOLBAR_PLUGIN_ID, LayerToolbarPlugin } from './toolbar';
export type { ILayerToolbarService } from './toolbar';
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
export {
  LAYERS_SELECTION_PLUGIN_ID,
  LayerSelectionPlugin,
  SELECTED_ROW_CLASS
} from './selection';
export type {
  ILayerSelectionService,
  LayerSelectionChangedEvent,
  SelectionMode
} from './selection';
