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
 * Propriété (contrat pour C4) : le Store n'est PAS destiné aux plugins.
 * `createCommandStack` ne sert qu'une fois (le premier appelant choisit
 * `limit`) et `load` contourne les commandes et vide l'historique. Le noyau
 * (`createEditor()`) crée donc la pile lui-même, juste après le Store, et ne
 * donne aux plugins qu'une façade : `document` en lecture, `execute` /
 * `undo` / `redo` / état de l'historique et abonnements aux événements, sans
 * `load` ni le Store brut.
 *
 * Validation : le document initial et chaque document chargé passent par
 * `validateDocument` du runtime avec `allowLiveTargets: false` ; un document
 * invalide lève une `StoreError`. Les cibles vivantes `{ element }` sont donc
 * refusées : le document est gelé en profondeur, ce qui gèlerait un nœud DOM
 * ou un objet three.js. Les pistes dont le nom est inconnu du registre sont
 * signalées à `onWarning` (par défaut `console.warn`), ou refusées avec
 * `strictProperties`. Les documents produits par les commandes ne sont pas
 * revalidés.
 *
 * Événements : `document:changed` à chaque écriture d'une commande ;
 * `load` vide l'historique (`history:changed`) puis émet `document:loaded`.
 */

import { defaultPropertyRegistry, validateDocument } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
import { CommandStack } from '../commands/CommandStack';
import type { CommandStackOptions } from '../commands/CommandStack';
import type { IDocumentChange, IDocumentWriter } from '../commands/documentChange';
import type { EventBus } from '../events/EventBus';
// Import pour effet : garde l'augmentation de TimelineEventMap dans Store.d.ts.
import './storeEvents';
import type { DocumentChangedEvent } from './storeEvents';
import { StoreError } from './StoreError';
import { findUnknownTracks } from './unknownTracks';
import type { IUnknownPropertyIssue } from './unknownTracks';

/** Reçoit les pistes inconnues d'un document accepté. */
export type StoreWarningHandler = (issues: readonly IUnknownPropertyIssue[]) => void;

/** Options du Store. */
export interface StoreOptions {
  /** Registre où chercher les noms de pistes. Par défaut : `defaultPropertyRegistry`. */
  readonly registry?: PropertyRegistry;
  /** Refuse (`StoreError`) un document qui a une piste inconnue du registre, au lieu d'avertir. */
  readonly strictProperties?: boolean;
  /** Reçoit les pistes inconnues d'un document accepté. Par défaut : `console.warn`. */
  readonly onWarning?: StoreWarningHandler;
}

const warnInConsole: StoreWarningHandler = (issues) => {
  const lines = issues.map((issue) => `- ${issue.path} : ${issue.message}`);
  console.warn(`Pistes inconnues du registre de l'éditeur (ignorées au rendu) :\n${lines.join('\n')}`);
};

/** Conteneur du document v2 courant. */
export class Store {
  private current: ITimelineDocument;
  private stack: CommandStack | undefined;
  private readonly registry: PropertyRegistry;
  private readonly strictProperties: boolean;
  private readonly onWarning: StoreWarningHandler;

  constructor(
    private readonly bus: EventBus,
    initial: ITimelineDocument,
    options: StoreOptions = {}
  ) {
    this.registry = options.registry ?? defaultPropertyRegistry;
    this.strictProperties = options.strictProperties ?? false;
    this.onWarning = options.onWarning ?? warnInConsole;
    this.accept(initial);
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
    this.accept(doc);
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

  /** Valide `doc` (lève `StoreError`), puis signale ou refuse ses pistes inconnues. */
  private accept(doc: ITimelineDocument): void {
    const issues = validateDocument(doc, { allowLiveTargets: false });
    if (issues.length > 0) throw new StoreError(issues);
    const unknown = findUnknownTracks(doc, this.registry);
    if (unknown.length === 0) return;
    if (this.strictProperties) throw new StoreError(unknown);
    this.onWarning(Object.freeze(unknown));
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
