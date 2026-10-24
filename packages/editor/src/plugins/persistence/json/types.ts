// packages/editor/src/plugins/persistence/json/types.ts
/**
 * Types publics du plugin `persistence.json` : options, API du service
 * `persistence.json`, événements, et les augmentations de
 * `EditorServiceMap` et de `TimelineEventMap`.
 */

import type { IMigrationWarning, ITimelineDocument } from '@werddomain/timeline-runtime';
import type { IReadResult } from './readDocument';
import type { IWriteOptions } from './writeDocument';

/** Options du plugin `persistence.json`. */
export interface IPersistenceJsonOptions {
  /** Indentation du JSON exporté par défaut (voir `IWriteOptions.space`). Par défaut : 2. */
  readonly space?: number | string;
  /** Nom de fichier proposé par `download()` sans argument. Par défaut : `timeline.json`. */
  readonly fileName?: string;
  /** Libellé de la commande d'import dans l'historique. Par défaut : « Importer le document ». */
  readonly importLabel?: string;
}

/** Résultat d'un import. */
export interface IImportResult extends IReadResult {
  /**
   * Vrai si le document de l'éditeur a été remplacé ; faux si la commande a
   * été refusée (veto sur `command:before`).
   */
  readonly applied: boolean;
}

/** API du service `persistence.json`. */
export interface IPersistenceJsonService {
  /**
   * Lit un document (texte JSON ou valeur analysée) sans le charger :
   * migration v1 → v2 puis validation. Lève `PersistenceError`.
   */
  read(source: unknown): IReadResult;
  /**
   * Lit puis charge un document par une commande annulable (« Importer le
   * document »). Lève `PersistenceError` sans toucher au document courant.
   */
  importDocument(source: unknown): IImportResult;
  /** Lit le texte d'un fichier (`<input type="file">`, glisser-déposer) puis l'importe. */
  importFile(file: Blob): Promise<IImportResult>;
  /** Document courant en texte JSON. Lève `PersistenceError` s'il n'est pas sérialisable. */
  exportJson(options?: IWriteOptions): string;
  /** Télécharge le document courant dans un fichier `.json` (par défaut `options.fileName`). */
  download(fileName?: string, options?: IWriteOptions): void;
}

/** Charge utile de `persistence:imported`. */
export interface PersistenceImportedEvent {
  /** Document importé (c'est désormais le document de l'éditeur). */
  readonly document: ITimelineDocument;
  /** Vrai si l'entrée était un document v1 converti. */
  readonly migrated: boolean;
  /** Corrections faites par le migrateur. */
  readonly warnings: readonly IMigrationWarning[];
}

/** Charge utile de `persistence:exported`. */
export interface PersistenceExportedEvent {
  /** Document exporté. */
  readonly document: ITimelineDocument;
  /** Texte JSON produit. */
  readonly json: string;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'persistence.json': IPersistenceJsonService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'persistence:imported': PersistenceImportedEvent;
    'persistence:exported': PersistenceExportedEvent;
  }
}
