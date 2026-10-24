// packages/editor/src/plugins/layers/index.ts
/** Epic `layers` : les calques de la timeline et leurs plugins. */

export { LayersPlugin } from './LayersPlugin';
export { LAYERS_LIST_PLUGIN_ID, LayerListPlugin } from './list';
export type { ILayerListService, ILayerRow, ILayerRowControl, LayerRowsChangedEvent } from './list';
