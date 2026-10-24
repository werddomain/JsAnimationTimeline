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
export {
  LAYERS_SELECTION_PLUGIN_ID,
  LayerSelectionPlugin,
  SELECTED_ROW_CLASS
} from './selection';
export type {
  ILayerSelectionService,
  SelectionChangedEvent,
  SelectionMode
} from './selection';
export {
  LAYERS_REORDER_PLUGIN_ID,
  LAYER_MOVE_LABEL,
  LayerReorderPlugin,
  childrenOf,
  computeDropTarget,
  createMoveLayersCommand,
  detachNodes,
  findNodeLocation,
  insertNodes,
  isSameOrDescendant,
  keyboardMoveTarget,
  moveNodes,
  sameArrangement,
  topMostIds
} from './reorder';
export type { DetachResult, ILayerDropTarget, ILayerReorderService, IDropPlacement, NodeLocation } from './reorder';
