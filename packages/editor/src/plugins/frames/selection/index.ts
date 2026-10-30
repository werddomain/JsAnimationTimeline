// packages/editor/src/plugins/frames/selection/index.ts
/** Plugin `frames.selection` : la sélection des images et des images clés. */

export { FRAMES_SELECTION_CLASSES, FRAMES_SELECTION_PLUGIN_ID, FramesSelectionPlugin } from './FramesSelectionPlugin';
export type { IFrameCell, IPropertyFrameCell } from './frameSelection';
export type {
  FramesSelectionChangedEvent,
  IFramesSelectionService,
  ISelectedKeyframe,
  ISelectedPropertyKeyframe,
  SelectedKeyframeKind
} from './types';
