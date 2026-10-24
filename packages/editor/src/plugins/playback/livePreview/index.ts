// packages/editor/src/plugins/playback/livePreview/index.ts
/** Plugin `playback.livePreview` : aperçu de la scène pendant le glisser de la tête de lecture. */

export { LIVE_PREVIEW_PLUGIN_ID, LivePreviewPlugin, createLivePreviewPlugin } from './LivePreviewPlugin';
export { LIVE_PREVIEW_CLASS } from './livePreviewControl';
export {
  DEFAULT_PREVIEW_MAX_FPS,
  LIVE_PREVIEW_MODES,
  MAX_PREVIEW_MAX_FPS,
  MIN_PREVIEW_MAX_FPS
} from './previewSettings';
export type { ILivePreviewApi, ILivePreviewOptions, LivePreviewMode, PreviewChangedEvent } from './types';
