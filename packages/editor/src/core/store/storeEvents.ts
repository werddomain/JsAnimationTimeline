// packages/editor/src/core/store/storeEvents.ts
/**
 * Événements du `Store`, ajoutés à `TimelineEventMap` par fusion de
 * déclarations :
 * - `document:loaded` : `Store.load` a remplacé le document (l'historique
 *   vient d'être vidé) ;
 * - `document:changed` : une commande a modifié le document (exécution,
 *   annulation, rétablissement ou annulation d'un regroupement).
 *
 * Ce module est importé (types) par `Store.ts` et réexporté par l'index :
 * l'augmentation est donc visible partout où le Store est importé.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { DocumentChangeCause } from '../commands/documentChange';

/** Charge utile de `document:loaded`. */
export interface DocumentLoadedEvent {
  readonly document: ITimelineDocument;
  readonly previous: ITimelineDocument;
}

/** Charge utile de `document:changed`. */
export interface DocumentChangedEvent {
  readonly document: ITimelineDocument;
  readonly previous: ITimelineDocument;
  readonly cause: DocumentChangeCause;
  /** Libellé de la commande (ou du regroupement annulé). */
  readonly label: string;
}

declare module '../events/TimelineEventMap' {
  interface TimelineEventMap {
    'document:loaded': DocumentLoadedEvent;
    'document:changed': DocumentChangedEvent;
  }
}
