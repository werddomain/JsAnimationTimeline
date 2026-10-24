// packages/editor/src/plugins/layers/list/index.ts
/** Plugin `layers.list` : la liste des calques, ses lignes et l'API des contrôles de ligne. */

export { LAYERS_LIST_PLUGIN_ID, LAYER_LIST_CLASSES, LAYER_LIST_TEXTS, LayerListPlugin } from './LayerListPlugin';
export { DEPTH_INDENT, LAYER_ROW_CLASSES, TOGGLE_LABELS } from './LayerRowView';
export {
  BUILTIN_LAYER_ICONS,
  LAYER_ICON_CLASS,
  classifyLayerIcon,
  defaultLayerIcon,
  effectiveLayerIcon,
  renderLayerIcon
} from './layerIcon';
export type { LayerIconKind } from './layerIcon';
export { layerRows, sameRowLayout } from './layerRows';
export {
  LayerListCommandLabels,
  createSetCollapsedCommand,
  createToggleCollapsedCommand,
  findFolder,
  updateLayerNode
} from './layerTree';
export type { LayerNodeUpdater } from './layerTree';
export type { ILayerListService, ILayerRow, ILayerRowControl, LayerRowsChangedEvent } from './types';
