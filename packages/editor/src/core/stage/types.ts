// packages/editor/src/core/stage/types.ts
/**
 * Types publics de la scène dans l'éditeur : l'option `stage` de
 * `createEditor()` et la façade `IEditorStage` (`ctx.stage`, `editor.stage`).
 *
 * L'éditeur n'a pas de zone de scène à lui : il anime une ou plusieurs scènes
 * `IStage` du runtime (HTML par défaut, ou celles du développeur : canvas,
 * audio, three.js...). Il n'en détruit jamais les objets : à la fin, chaque
 * calque est relâché (`release`) puis chaque scène détachée (`detach`).
 */

import type { IStage, IStageReport, ITargetInfo, LayerTarget } from '@werddomain/timeline-runtime';

/**
 * Option `stage` de `createEditor()` :
 * - absente : scène HTML en mode `frame` sur `root` (ou le document du
 *   conteneur), qui exclut toujours l'élément de l'éditeur ;
 * - `false` : timeline seule (mode tiré : `editor.sample()`, `onFrame()`) ;
 * - une scène, ou un tableau de scènes combinées (routage par `accepts` et par
 *   `target.stage`, ids uniques). La scène HTML n'y est pas ajoutée d'office :
 *   la mettre dans le tableau avec `createEditorHtmlStage(conteneur)` (mode
 *   `frame`, conteneur et éditeur exclus) ; un `createHtmlStage()` du runtime
 *   n'exclut pas l'éditeur et anime en mode `waapi` par défaut.
 */
export type EditorStageOption = IStage | readonly IStage[] | false;

/** Scènes de l'éditeur vues par un plugin (`ctx.stage`) et par l'hôte (`editor.stage`). */
export interface IEditorStage {
  /**
   * Scènes branchées, dans l'ordre de routage (vide avec `stage: false`). En
   * lecture seule : leurs méthodes de cycle de vie appartiennent à l'éditeur.
   */
  readonly stages: readonly IStage[];
  /**
   * Ids des calques sans objet animé (pas de cible, scène inconnue, aucune
   * scène ne l'accepte, ou `resolve` a échoué), dans l'ordre du document.
   * L'événement `stage:targetsChanged` annonce chaque changement de cette
   * liste (document, `refreshTargets`, `targets.subscribe` d'une scène).
   */
  readonly missingTargets: readonly string[];
  /**
   * Avertissements des scènes pour le document courant. Chacun est aussi émis
   * par `stage:report` (ceux du document initial, juste avant `editor:ready`).
   */
  readonly warnings: readonly IStageReport[];
  /** Cibles proposées par toutes les scènes (`targets.list()`), dans l'ordre des scènes. */
  listTargets(): readonly ITargetInfo[];
  /** Affichage d'une cible par la scène qui l'anime, ou `undefined`. */
  describe(target: LayerTarget): ITargetInfo | undefined;
  /**
   * Réessaie les résolutions qui ont échoué (du calque `layerId` seulement
   * s'il est donné), par exemple après le chargement d'un modèle. Lève si
   * elle est appelée pendant le chargement d'un document (depuis une scène).
   */
  refreshTargets(layerId?: string): void;
  /**
   * Retient le rendu des scènes, hors lecture, jusqu'à `release()` : par
   * exemple pendant le glisser de la tête de lecture sur une scène lente
   * (`playback.livePreview`). Pendant une retenue :
   * - les scènes ne reçoivent ni `sync` ni `render` ; la position, elle,
   *   suit (`playhead:changed`, `frame:render` et `onFrame` continuent) ;
   * - un document est chargé comme d'habitude (acceptation ou retour
   *   arrière, avertissements, `stage:targetsChanged`) : seul son rendu est
   *   retenu ;
   * - la lecture passe outre (une retenue oubliée ne fige jamais la
   *   lecture), et l'arrêt de la lecture rend l'image d'arrêt.
   *
   * `flush()` rattrape tout de suite l'image courante (une seule fois s'il
   * n'y a rien de nouveau) ; le dernier `release()` fait de même. Plusieurs
   * retenues se cumulent. Sans scène (`stage: false`) ou après la destruction
   * de l'éditeur, la retenue rendue est inerte.
   */
  hold(): IStageHold;
}

/** Retenue du rendu des scènes (voir `IEditorStage.hold`). */
export interface IStageHold {
  /** Vrai jusqu'à `release()` (ou la destruction de l'éditeur). */
  readonly active: boolean;
  /** Rend tout de suite l'image courante si un rendu a été retenu ; sans effet après `release()`. */
  flush(): void;
  /** Termine la retenue (idempotent) ; la dernière rattrape l'image courante. */
  release(): void;
}

/** Reçoit les erreurs levées par les scènes (la première par scène et par calque, jusqu'au document suivant). */
export type StageErrorHandler = (error: unknown) => void;
