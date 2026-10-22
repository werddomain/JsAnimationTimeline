// packages/editor/src/core/store/Store.ts
/**
 * Store de l'éditeur : contient le document JSON v2 (immuable). Seules les
 * commandes le modifient, et chaque modification émet un événement.
 *
 * Accès en écriture : le Store n'expose aucun setter public. Il crée lui-même
 * son unique `CommandStack` (`createCommandStack`) et lui confie un
 * `IDocumentWriter` privé ; un plugin ne peut donc modifier le document
 * qu'en exécutant une commande sur cette pile. `load` est la seule autre
 * voie : elle remplace le document entier (import, migration).
 *
 * Validation : le document initial et chaque document chargé passent par
 * `validateDocument` du runtime ; un document invalide lève une `StoreError`.
 * Les documents produits par les commandes ne sont pas revalidés.
 *
 * Événements : `document:changed` à chaque écriture d'une commande ;
 * `load` vide l'historique (`history:changed`) puis émet `document:loaded`.
 */

import { validateDocument } from '@werddomain/timeline-runtime';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { CommandStack } from '../commands/CommandStack';
import type { CommandStackOptions } from '../commands/CommandStack';
import type { IDocumentChange, IDocumentWriter } from '../commands/documentChange';
import type { EventBus } from '../events/EventBus';
// Import pour effet : garde l'augmentation de TimelineEventMap dans Store.d.ts.
import './storeEvents';
import type { DocumentChangedEvent } from './storeEvents';
import { StoreError } from './StoreError';

function assertValid(doc: ITimelineDocument): void {
  const issues = validateDocument(doc);
  if (issues.length > 0) throw new StoreError(issues);
}

/** Conteneur du document v2 courant. */
export class Store {
  private current: ITimelineDocument;
  private stack: CommandStack | undefined;

  constructor(
    private readonly bus: EventBus,
    initial: ITimelineDocument
  ) {
    assertValid(initial);
    this.current = initial;
  }

  /** Document courant (immuable : ne jamais le modifier). */
  get document(): ITimelineDocument {
    return this.current;
  }

  /**
   * Remplace le document après validation (lève `StoreError` s'il est
   * invalide, sans rien changer). Vide l'historique et le regroupement en
   * cours (`history:changed`), puis émet `document:loaded`.
   */
  load(doc: ITimelineDocument): void {
    assertValid(doc);
    const previous = this.current;
    this.current = doc;
    this.stack?.clear();
    this.bus.emit('document:loaded', { document: doc, previous });
  }

  /**
   * Crée la pile de commandes de ce Store, seule à pouvoir écrire le
   * document. Ne peut être appelée qu'une fois (un seul historique par
   * document) ; lève ensuite une erreur.
   */
  createCommandStack(options: CommandStackOptions = {}): CommandStack {
    if (this.stack !== undefined) {
      throw new Error('Store : la pile de commandes a déjà été créée ; réutilisez-la.');
    }
    this.stack = new CommandStack(this.bus, this.createWriter(), options);
    return this.stack;
  }

  private createWriter(): IDocumentWriter {
    const read = (): ITimelineDocument => this.current;
    const commit = (next: ITimelineDocument, change: IDocumentChange): void => this.commit(next, change);
    return Object.freeze({
      get document(): ITimelineDocument {
        return read();
      },
      commit
    });
  }

  private commit(next: ITimelineDocument, change: IDocumentChange): void {
    const payload: DocumentChangedEvent = { document: next, previous: this.current, ...change };
    this.current = next;
    this.bus.emit('document:changed', payload);
  }
}
