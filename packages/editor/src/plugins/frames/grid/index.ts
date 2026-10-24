// packages/editor/src/plugins/frames/grid/index.ts
/** Plugin `frames.grid` : la grille des plages et des images clés. */

export { FRAMES_GRID_CLASSES, FRAMES_GRID_PLUGIN_ID, FramesGridPlugin } from './FramesGridPlugin';
export {
  FRAME_OVERSCAN,
  ROW_OVERSCAN,
  rowMarks,
  rowSegments,
  visibleFrameRange,
  visibleRowRange
} from './gridCells';
export type { GridMarkKind, GridSegmentKind, IFrameRange, IGridMark, IGridSegment, IRowRange } from './gridCells';
export type { FramesGridRenderedEvent, IFramesGridService, IGridCell, IGridWindow } from './types';
