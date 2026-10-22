// packages/editor/src/core/editor/types.ts
/**
 * Types publics de l'éditeur v2 : les options de `createEditor()` et l'API
 * `IEditor` qu'il retourne à l'application hôte.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { ICommand } from '../commands/ICommand';
import type {
  EditorEventName,
  EditorPlugin,
  EditorServiceId,
  EditorServiceMap
} from '../context/IEditorContext';
import type { EventHandler } from '../events/EventBus';
import type { TimelineEventMap } from '../events/TimelineEventMap';

/** Options de `createEditor()`. */
export interface EditorOptions {
  /**
   * Document v2 initial, validé par le Store (`StoreError` s'il est
   * invalide). Par défaut : un document vide (`createEmptyDocument()`).
   * Les fichiers v1 sont convertis par le plugin `persistence.json` (S2)
   * ou par `migrateToV2` du runtime avant d'être donnés ici.
   */
  readonly data?: ITimelineDocument;
  /** Racine où les plugins cherchent les cibles des calques. Par défaut : le document du conteneur. */
  readonly root?: ParentNode;
  /** Plugins ajoutés après le jeu par défaut (l'ordre d'init suit les dépendances). */
  readonly plugins?: readonly EditorPlugin[];
  /**
   * Jeu de plugins par défaut : `true` (par défaut) utilise `defaultPlugins()`,
   * `false` n'en charge aucun, un tableau le remplace.
   */
  readonly defaultPlugins?: boolean | readonly EditorPlugin[];
  /** Nombre maximal d'entrées annulables (entier >= 1, 100 par défaut). */
  readonly historyLimit?: number;
}

/**
 * API publique d'un éditeur créé par `createEditor()`.
 *
 * Après `destroy()`, tout autre membre que `destroy` et `isDestroyed` lève
 * une erreur. (Les fonctions de désabonnement rendues par `on` / `once`
 * restent sans danger.)
 */
export interface IEditor {
  /** Élément racine de l'éditeur (classe `JsTimeLine`), ajouté au conteneur hôte. */
  readonly container: HTMLElement;
  /** Document courant (immuable). */
  readonly document: ITimelineDocument;
  /** Vrai si `undo()` est possible. */
  readonly canUndo: boolean;
  /** Vrai si `redo()` est possible. */
  readonly canRedo: boolean;
  /** Vrai une fois `destroy()` terminé. */
  readonly isDestroyed: boolean;

  /** S'abonne à un événement de l'éditeur ; retourne la fonction de désabonnement. */
  on<K extends EditorEventName>(name: K, handler: EventHandler<TimelineEventMap[K]>): () => void;
  /** S'abonne à la prochaine émission d'un événement seulement. */
  once<K extends EditorEventName>(name: K, handler: EventHandler<TimelineEventMap[K]>): () => void;
  /** Retire une inscription de `handler`. */
  off<K extends EditorEventName>(name: K, handler: EventHandler<TimelineEventMap[K]>): void;

  /** Exécute une commande (voie de modification du document) ; `true` si le document a changé. */
  execute(command: ICommand): boolean;
  /** Annule la dernière entrée de l'historique ; `false` s'il n'y en a pas. */
  undo(): boolean;
  /** Rétablit la dernière entrée annulée ; `false` s'il n'y en a pas. */
  redo(): boolean;

  /** Document courant, sérialisable avec `JSON.stringify` (même référence que `document`). */
  toJSON(): ITimelineDocument;
  /** Remplace le document (validé, `StoreError` sinon) et vide l'historique. */
  load(doc: ITimelineDocument): void;
  /** API d'un service fourni par un plugin, ou `undefined`. */
  getService<K extends EditorServiceId>(id: K): EditorServiceMap[K] | undefined;

  /**
   * Détruit l'éditeur : émet `editor:destroying`, détruit les plugins en
   * ordre inverse, vide les abonnements et les services, puis retire
   * l'élément racine. Idempotent.
   *
   * @param reason Raison facultative, transmise dans `editor:destroying`.
   */
  destroy(reason?: string): void;
}
