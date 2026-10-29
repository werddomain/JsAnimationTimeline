// packages/editor/src/model/spans/index.ts
/**
 * Point d'entrée des opérations de plage (cœur CS4) : fonctions pures sur le
 * document et commandes annulables liées à un registre de propriétés.
 */

export { createSpanCommands, SpanCommandLabels } from './spanCommands';
export type { ISpanCommands } from './spanCommands';
export { insertBlankKeyframe, insertKeyframe } from './insertKeyframe';
export { deleteKeyframe } from './deleteKeyframe';
export { insertFrame, removeFrame } from './frames';
export { moveKeyframe } from './moveKeyframe';
export { SpanOperationCodes, SpanOperationError } from './SpanOperationError';
export type { SpanOperationCode } from './SpanOperationError';
