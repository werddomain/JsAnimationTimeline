// packages/editor/src/plugins/layers/target/index.ts
/** Plugin `layers.target` : cible des calques, sa commande, son alerte et son service. */

export { LAYERS_TARGET_PLUGIN_ID, NO_TARGET_TEXT, TARGET_CONTROL_ORDER, TargetPlugin } from './TargetPlugin';
export type { ILayerTargetService } from './TargetPlugin';
export { TARGET_LABEL, createSetTargetCommand } from './targetCommands';
export { TargetAlertLabels, computeTargetAlert } from './targetAlert';
export type { ITargetAlert, ITargetAlertSource, TargetAlertReason } from './targetAlert';
export { checkTargetShape, targetFromInput, toSavableTarget } from './targetValidation';
export type { ITargetInput } from './targetValidation';
export { TARGET_BUTTON_CLASSES } from './targetControl';
export { TARGET_POPUP_CLASS, TargetPopupLabels } from './TargetPopup';
