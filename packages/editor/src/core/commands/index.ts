// packages/editor/src/core/commands/index.ts
/**
 * Point d'entrée du module de commandes du noyau : contrat `ICommand`,
 * refus (`CommandRefusedError`), commandes composées, fabrique de commandes
 * simples, pile annuler / rétablir et ses événements.
 *
 * `IDocumentWriter` (écriture du document) reste interne : voir
 * `Store.createCommandStack()`. `CommandStack` n'est exporté que comme type :
 * la seule façon d'obtenir une pile est `Store.createCommandStack()`.
 */

export { CANCELLED_REASON } from './commandEvents';
export type { CommandBeforeEvent, CommandRefusedEvent, HistoryChangedEvent } from './commandEvents';
export { CommandRefusedError } from './CommandRefusedError';
export { DEFAULT_HISTORY_LIMIT } from './CommandStack';
export type { CommandStack, CommandStackOptions } from './CommandStack';
export { CompositeCommand } from './CompositeCommand';
export { createCommand } from './createCommand';
export type { DocumentTransform } from './createCommand';
export type { DocumentChangeCause, IDocumentChange } from './documentChange';
export type { ICommand } from './ICommand';
