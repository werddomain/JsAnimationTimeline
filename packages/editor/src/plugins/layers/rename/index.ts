// packages/editor/src/plugins/layers/rename/index.ts
/** Plugin `layers.rename` : renommage sur place des calques, sa commande et son service. */

export { LAYERS_RENAME_PLUGIN_ID, RenamePlugin } from './RenamePlugin';
export type { ILayerRenameService } from './RenamePlugin';
export { RENAME_INPUT_CLASS, RENAME_INPUT_LABEL, startInlineEdit } from './inlineEdit';
export type { IInlineEdit } from './inlineEdit';
export { RENAME_LABEL, createRenameCommand, normalizeLayerName } from './renameCommands';
