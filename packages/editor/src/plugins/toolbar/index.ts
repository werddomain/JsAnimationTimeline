// packages/editor/src/plugins/toolbar/index.ts
/** Epic `toolbar` : la barre d'outils au-dessus de la timeline et ses plugins. */

export { ToolbarPlugin } from './ToolbarPlugin';
export type { ToolbarOptions } from './ToolbarPlugin';
export {
  DEFAULT_SCENE_NAME,
  DEFAULT_TOOLBAR_GROUP,
  TOOLBAR_CLASS,
  TOOLBAR_MAIN_PLUGIN_ID,
  ToolbarError,
  ToolbarGroupOrders,
  ToolbarMainPlugin,
  createToolbarMainPlugin
} from './main';
export type {
  IToolbarButtonDefinition,
  IToolbarControlDefinition,
  IToolbarItemDefinition,
  IToolbarItemInfo,
  IToolbarMainOptions,
  IToolbarMainService,
  ToolbarErrorCode
} from './main';
export {
  MAX_FPS,
  MIN_FPS,
  MAX_TOTAL_FRAMES,
  MIN_TOTAL_FRAMES,
  TIME_SETTINGS_PLUGIN_ID,
  TimeSettingsLabels,
  TimeSettingsPlugin,
  createSetFpsCommand,
  createSetTotalFramesCommand,
  createTimeSettingsPlugin
} from './timeSettings';
export {
  FIT_OPTION_VALUE,
  ZOOM_CONTROL_PLUGIN_ID,
  ZoomControlPlugin,
  createZoomControlPlugin
} from './zoomControl';
