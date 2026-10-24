// packages/editor/src/plugins/frames/clipboard/index.ts
/** Plugin `frames.clipboard` : copier / coller des images (Ctrl+C / Ctrl+V). */

export { FRAMES_CLIPBOARD_PLUGIN_ID, FramesClipboardPlugin } from './FramesClipboardPlugin';
export type {
  FramesClipboardChangedEvent,
  IClipRow,
  IClipRun,
  IClipSpan,
  IFrameClip,
  IFramesClipboardService
} from './types';
