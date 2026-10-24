// packages/editor/src/plugins/layers/visibility/index.ts
/** Plugin `layers.visibility` : œil de visibilité des calques, ses commandes et son service. */

export {
  LAYERS_VISIBILITY_PLUGIN_ID,
  VISIBILITY_BUTTON_CLASS,
  VISIBILITY_CONTROL_ORDER,
  VisibilityPlugin
} from './VisibilityPlugin';
export type { ILayerVisibilityService } from './VisibilityPlugin';
export { VisibilityLabels, createSetAllVisibleCommand, createSetVisibleCommand } from './visibilityCommands';
