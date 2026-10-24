// packages/editor/src/plugins/layers/lock/index.ts
/** Plugin `layers.lock` : cadenas des calques, ses commandes et son service. */

export { LAYERS_LOCK_PLUGIN_ID, LOCK_BUTTON_CLASS, LOCK_CONTROL_ORDER, LockPlugin } from './LockPlugin';
export type { ILayerLockService } from './LockPlugin';
export { LockLabels, createSetAllLockedCommand, createSetLockedCommand } from './lockCommands';
