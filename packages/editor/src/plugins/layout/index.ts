// packages/editor/src/plugins/layout/index.ts
/** Epic `layout` : la mise en page de la timeline et ses plugins. */

export { LayoutPlugin } from './LayoutPlugin';
export type { LayoutOptions } from './LayoutPlugin';
export { LAYOUT_SLOTS, LAYOUT_ZONES, LayoutShellPlugin } from './shell';
export type { ILayoutShellApi, LayoutZone } from './shell';
export { ScrollSyncPlugin } from './scrollSync';
export type { IFrameScheduler, IScrollPosition, IScrollState, IScrollSyncApi, ScrollSyncOptions } from './scrollSync';
