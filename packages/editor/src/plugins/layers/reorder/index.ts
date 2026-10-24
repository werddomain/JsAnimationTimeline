// packages/editor/src/plugins/layers/reorder/index.ts
/** Plugin `layers.reorder` : glisser-déposer des calques et opérations de déplacement dans l'arbre. */

export { LAYERS_REORDER_PLUGIN_ID, LayerReorderPlugin } from './LayerReorderPlugin';
export { DRAG_THRESHOLD } from './dragController';
export { REORDER_CLASSES } from './dropIndicator';
export {
  DROP_AFTER_RATIO,
  DROP_BEFORE_RATIO,
  computeDropTarget,
  dropZone,
  locateDrop,
  placementAt,
  toDropTarget
} from './dropTarget';
export type { DropHit, DropPosition, IDropPlacement, IDropRow, IRowBox } from './dropTarget';
export { keyboardMoveTarget } from './keyboardMove';
export type { MoveDirection } from './keyboardMove';
export { moveNodes } from './moveNodes';
export type { ILayerDropTarget } from './moveNodes';
export { LAYER_MOVE_LABEL, createMoveLayersCommand } from './reorderCommand';
export {
  childrenOf,
  detachNodes,
  findNodeLocation,
  insertNodes,
  isSameOrDescendant,
  sameArrangement,
  topMostIds
} from './treeMoves';
export type { DetachResult, NodeLocation } from './treeMoves';
export type { ILayerReorderService } from './types';
