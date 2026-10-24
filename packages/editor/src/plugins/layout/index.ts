// packages/editor/src/plugins/layout/index.ts
/** Epic `layout` : la mise en page de la timeline et ses plugins. */

export { LayoutPlugin } from './LayoutPlugin';
export type { LayoutOptions } from './LayoutPlugin';
export { LAYOUT_SLOTS, LAYOUT_ZONES, LayoutShellPlugin } from './shell';
export type { ILayoutShellApi, LayoutZone } from './shell';
export { ScrollSyncPlugin } from './scrollSync';
export type { IFrameScheduler, IScrollPosition, IScrollState, IScrollSyncApi, ScrollSyncOptions } from './scrollSync';
export { RulerPlugin } from './ruler';
export type { IRulerApi, RulerOptions } from './ruler';
export { PlayheadPlugin } from './playhead';
export type { IPlayheadApi, PlayheadScrubEvent } from './playhead';
export { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, DEFAULT_ZOOM_LEVELS, ZoomPlugin } from './zoom';
export type { IZoomApi, IZoomRange, ZoomAnchor, ZoomChangedEvent, ZoomOptions } from './zoom';
