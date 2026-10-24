// packages/editor/src/plugins/toolbar/zoomControl/index.ts
/** Plugin `toolbar.zoomControl` : liste et curseur du zoom de la règle. */

export {
  FIT_OPTION_VALUE,
  ZOOM_CONTROL_CLASS,
  ZOOM_CONTROL_PLUGIN_ID,
  ZoomControlPlugin,
  createZoomControlPlugin
} from './ZoomControlPlugin';
export {
  SLIDER_STEP,
  SLIDER_UNITS_PER_OCTAVE,
  fitZoom,
  formatCustomZoom,
  formatZoom,
  sliderBounds,
  sliderToZoom,
  stepSlider,
  zoomToSlider
} from './zoomControlMath';
