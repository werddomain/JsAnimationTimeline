// packages/editor/src/core/commands/documentChange.ts
/**
 * Lien interne entre la `CommandStack` et le `Store` : la pile lit le
 * document courant et y écrit le résultat des commandes par un
 * `IDocumentWriter` que seul `Store.createCommandStack()` lui fournit.
 *
 * `IDocumentWriter` n'est pas réexporté par l'index du module : écrire le
 * document ne fait pas partie de l'API des plugins, qui passent toujours par
 * `CommandStack.execute`.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';

/** Origine d'une modification du document (charge utile de `document:changed`). */
export type DocumentChangeCause = 'execute' | 'undo' | 'redo' | 'group-cancel';

/** Description d'une modification écrite par la pile. */
export interface IDocumentChange {
  readonly cause: DocumentChangeCause;
  /** Libellé de la commande (ou du regroupement annulé) à l'origine du changement. */
  readonly label: string;
}

/** Accès en lecture/écriture au document, réservé à la `CommandStack`. */
export interface IDocumentWriter {
  /** Document courant. */
  readonly document: ITimelineDocument;
  /** Remplace le document et émet `document:changed`. */
  commit(next: ITimelineDocument, change: IDocumentChange): void;
}
