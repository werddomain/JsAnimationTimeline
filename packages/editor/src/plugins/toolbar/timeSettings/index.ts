// packages/editor/src/plugins/toolbar/timeSettings/index.ts
/** Plugin `toolbar.timeSettings` : cadence et durée du document, et leurs commandes. */

export {
  CANCELLED_MESSAGE,
  TIME_SETTINGS_CLASS,
  TIME_SETTINGS_PLUGIN_ID,
  TimeSettingsPlugin,
  createTimeSettingsPlugin
} from './TimeSettingsPlugin';
export {
  MAX_FPS,
  MAX_TOTAL_FRAMES,
  MIN_FPS,
  MIN_TOTAL_FRAMES,
  TimeSettingsLabels,
  createSetFpsCommand,
  createSetTotalFramesCommand,
  fpsError,
  lastUsedFrame,
  totalFramesError
} from './timeSettingsCommands';
export type { ILastUsedFrame } from './timeSettingsCommands';
