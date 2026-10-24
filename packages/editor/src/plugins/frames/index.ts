// packages/editor/src/plugins/frames/index.ts
/** Epic `frames` : les images de la timeline et leurs plugins. */

export { FramesPlugin } from './FramesPlugin';
export {
  FRAMES_GRID_CLASSES,
  FRAMES_GRID_PLUGIN_ID,
  FramesGridPlugin,
  rowMarks,
  rowSegments,
  visibleFrameRange,
  visibleRowRange
} from './grid';
export type {
  FramesGridRenderedEvent,
  GridMarkKind,
  GridSegmentKind,
  IFrameRange,
  IFramesGridService,
  IGridCell,
  IGridMark,
  IGridSegment,
  IGridWindow,
  IRowRange
} from './grid';
