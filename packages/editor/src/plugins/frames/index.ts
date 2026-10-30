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
export { FRAMES_KEYFRAMES_CLASSES, FRAMES_KEYFRAMES_PLUGIN_ID, FramesKeyframesPlugin } from './keyframes';
export type { IFramesKeyframesService } from './keyframes';
export { FRAMES_SELECTION_CLASSES, FRAMES_SELECTION_PLUGIN_ID, FramesSelectionPlugin } from './selection';
export type {
  FramesSelectionChangedEvent,
  IFrameCell,
  IPropertyFrameCell,
  IFramesSelectionService,
  ISelectedKeyframe,
  ISelectedPropertyKeyframe,
  SelectedKeyframeKind
} from './selection';
export {
  FRAME_CLIP_FORMAT,
  FRAME_CLIP_VERSION,
  FRAMES_CLIPBOARD_PLUGIN_ID,
  FramesClipboardIds,
  FramesClipboardKeys,
  FramesClipboardPlugin
} from './clipboard';
export type {
  FramesClipboardChangedEvent,
  IClipRow,
  IClipRun,
  IClipSpan,
  IFrameClip,
  IFramesClipboardService
} from './clipboard';
