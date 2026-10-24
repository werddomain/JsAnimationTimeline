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
export {
  LAYERS_RENAME_PLUGIN_ID,
  RENAME_LABEL,
  RenamePlugin,
  createRenameCommand,
  normalizeLayerName
} from './rename';
export type { ILayerRenameService } from './rename';
export {
  LAYERS_VISIBILITY_PLUGIN_ID,
  VISIBILITY_CONTROL_ORDER,
  VisibilityLabels,
  VisibilityPlugin,
  createSetAllVisibleCommand,
  createSetVisibleCommand
} from './visibility';
export type { ILayerVisibilityService } from './visibility';
export {
  LAYERS_LOCK_PLUGIN_ID,
  LOCK_CONTROL_ORDER,
  LockLabels,
  LockPlugin,
  createSetAllLockedCommand,
  createSetLockedCommand
} from './lock';
export type { ILayerLockService } from './lock';
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
