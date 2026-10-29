// packages/editor/src/plugins/properties/panel/types.ts
/** Optional persistent property inspector. */
export interface IPropertiesPanelService {
  /** Select a real layer, seek an integer frame and focus its inspector. */
  focusAt(layerId: string, frame: number): boolean;
}
declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'properties.panel': IPropertiesPanelService;
  }
}

