// packages/editor/src/plugins/frames/grid/types.ts
/**
 * Contrat de `frames.grid` pour les autres plugins : la cellule sous un
 * point, la fenêtre dessinée, le service `frames.grid` et l'événement
 * `frames:gridRendered`. La sélection (G2), le déplacement des images clés
 * (K2) ou le presse-papiers (K3) s'y branchent sans toucher à la grille.
 */

import type { IVisibleRow } from '../../../model/rows';
import type { IFrameRange, IRowRange } from './gridCells';

/** Une cellule de la grille : une image d'une ligne. */
export interface IGridCell {
  /** Id du calque ou du dossier de la ligne. */
  readonly rowId: string;
  /** Index de la ligne dans les lignes visibles (0 en haut). */
  readonly rowIndex: number;
  /** Image, de 1 à `totalFrames`. */
  readonly frame: number;
}

/** Partie de la grille dessinée dans le DOM (partie visible et sa marge). */
export interface IGridWindow {
  readonly frames: IFrameRange;
  readonly rows: IRowRange;
}

/**
 * Charge utile de `frames:gridRendered` : la grille vient de redessiner sa
 * fenêtre (document, lignes, défilement ou zoom). Les plugins qui ajoutent
 * des décorations sur les cellules (sélection...) les remettent à jour.
 */
export interface FramesGridRenderedEvent {
  readonly window: IGridWindow;
  readonly frameWidth: number;
  readonly rowHeight: number;
}

/** API publiée sous le service `frames.grid`. */
export interface IFramesGridService {
  /** Largeur courante d'une image, en pixels. */
  frameWidth(): number;
  /** Hauteur d'une ligne, en pixels. */
  rowHeight(): number;
  /** Lignes affichées (document courant), en ordre d'affichage. */
  rows(): readonly IVisibleRow[];
  /** Partie dessinée de la grille. */
  window(): IGridWindow;
  /**
   * Cellule sous le point `clientX` / `clientY` (coordonnées de la fenêtre,
   * défilement compris), ou `undefined` hors de la grille, sans ligne, ou
   * avant le rendu. Toute ligne visible compte (dossiers compris), même si
   * l'image est hors de la fenêtre dessinée.
   */
  cellAt(clientX: number, clientY: number): IGridCell | undefined;
  /**
   * Élément de la grille (contenu qui défile, à la taille de toute la
   * timeline), ou `undefined` avant le rendu. Un plugin peut y ajouter ses
   * propres calques de décoration, positionnés en absolu.
   */
  element(): HTMLElement | undefined;
  /** Redessine la fenêtre tout de suite (après un changement que la grille n'écoute pas). */
  refresh(): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'frames.grid': IFramesGridService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'frames:gridRendered': FramesGridRenderedEvent;
  }
}
