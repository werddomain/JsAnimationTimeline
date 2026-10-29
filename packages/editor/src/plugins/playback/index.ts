// packages/editor/src/plugins/playback/index.ts
/** Epic `playback` : la lecture et ses plugins. */

export { PlaybackPlugin } from './PlaybackPlugin';
export {
  PLAYBACK_CONTROLS_PLUGIN_ID,
  PLAYBACK_SPEEDS,
  PLAYBACK_TOGGLE_KEYS,
  PlaybackControlsPlugin,
  createPlaybackControlsPlugin
} from './controls';
export {
  DEFAULT_PREVIEW_MAX_FPS,
  LIVE_PREVIEW_MODES,
  LIVE_PREVIEW_PLUGIN_ID,
  LivePreviewPlugin,
  createLivePreviewPlugin
} from './livePreview';
export type { ILivePreviewApi, ILivePreviewOptions, LivePreviewMode, PreviewChangedEvent } from './livePreview';
