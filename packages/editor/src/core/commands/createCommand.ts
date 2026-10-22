// packages/editor/src/core/commands/createCommand.ts
/**
 * Fabrique de commandes simples à partir d'un libellé et de deux
 * transformations pures (voir le contrat de `ICommand`).
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { ICommand } from './ICommand';

/** Transformation pure d'un document (ne modifie jamais son entrée). */
export type DocumentTransform = (doc: ITimelineDocument) => ITimelineDocument;

/** Crée une commande figée `{ label, do, undo }`. */
export function createCommand(
  label: string,
  doFn: DocumentTransform,
  undoFn: DocumentTransform
): ICommand {
  return Object.freeze({ label, do: doFn, undo: undoFn });
}
