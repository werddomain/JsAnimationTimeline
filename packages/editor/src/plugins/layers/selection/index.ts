// packages/editor/src/plugins/layers/selection/index.ts
/** Plugin `layers.selection` : sélection multiple des calques et navigation au clavier. */

export { LAYERS_SELECTION_PLUGIN_ID, LayerSelectionPlugin } from './LayerSelectionPlugin';
export { resolveClick } from './clickIntent';
export type { ClickInput, ClickIntent } from './clickIntent';
export { resolveKey } from './keyboardNav';
export type { KeyInput, MoveMode, NavAction, NavContext, NavRow } from './keyboardNav';
export {
  EMPTY_SELECTION,
  clearSelection,
  focusRow,
  nearestRemaining,
  orderedIds,
  pruneSelection,
  sameSelection,
  selectAllIds,
  selectIds,
  selectRangeIds
} from './selectionModel';
export type { SelectionRowRef, SelectionState } from './selectionModel';
export { SELECTED_ROW_CLASS } from './selectionView';
export type { ILayerSelectionService, SelectionChangedEvent, SelectionMode } from './types';
