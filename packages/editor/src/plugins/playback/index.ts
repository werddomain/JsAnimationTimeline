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
