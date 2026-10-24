// packages/editor/src/plugins/layers/groups/index.ts
/** Plugin `layers.groups` : dossiers de calques et « grouper la sélection ». */

export { LAYERS_GROUPS_PLUGIN_ID, LAYER_GROUPS_SHORTCUTS, LayerGroupsPlugin } from './LayerGroupsPlugin';
export {
  LayerGroupsCommandLabels,
  createFolderCommand,
  groupSelectionCommand,
  ungroupCommand
} from './groupCommands';
export type { IFolderCommand } from './groupCommands';
export {
  addFolder,
  groupNodes,
  insertNode,
  locateNode,
  newFolder,
  nextFolderId,
  nextFolderName,
  removeNodes,
  topMostIds,
  ungroupNode
} from './groupsTree';
export type { INodeLocation } from './groupsTree';
export type { ILayerGroupsService } from './types';
