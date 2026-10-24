// packages/editor/src/plugins/layout/zoom/index.ts
/** Plugin `layout.zoom` : largeur d'image variable et événement `zoom:changed`. */

export { ZoomPlugin } from './ZoomPlugin';
export type { IZoomApi, ZoomAnchor, ZoomOptions } from './ZoomPlugin';
export type { ZoomChangedEvent } from './zoomEvents';
export { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, DEFAULT_ZOOM_LEVELS } from './zoomLevels';
export type { IZoomRange } from './zoomLevels';
