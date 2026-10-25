// packages/editor/src/plugins/frames/clipboard/index.ts
/** Plugin `frames.clipboard` : copier / coller des images (Ctrl+C / Ctrl+V). */

export {
  FRAMES_CLIPBOARD_PLUGIN_ID,
  FramesClipboardIds,
  FramesClipboardKeys,
  FramesClipboardPlugin
} from './FramesClipboardPlugin';
export { FRAME_CLIP_FORMAT, FRAME_CLIP_VERSION } from './types';
export type {
  FramesClipboardChangedEvent,
  IClipRow,
  IClipRun,
  IClipSpan,
  IFrameClip,
  IFramesClipboardService
} from './types';
