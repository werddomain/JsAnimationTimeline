// packages/editor/src/plugins/frames/selection/types.ts
/**
 * Contrat de `frames.selection` pour les autres plugins : le service
 * `frames.selection` et l'événement `frames:selectionChanged`. Les images
 * clés (K2), le presse-papiers (K3) et les interpolations (W1) s'en servent.
 *
 * La sélection est de l'état d'interface de l'éditeur : elle n'est ni dans le
 * document ni annulable.
 */

import type { GridMarkKind } from '../grid/gridCells';
import type { IFrameCell } from './frameSelection';

/** Nature d'une image clé sélectionnée (les marques de fin de plage n'en sont pas). */
export type SelectedKeyframeKind = Exclude<GridMarkKind, 'spanEnd'>;

/** Une cellule sélectionnée qui porte une image clé. */
export interface ISelectedKeyframe extends IFrameCell {
  readonly kind: SelectedKeyframeKind;
  /** Id de la plage de l'image clé. */
  readonly spanId: string;
}

/** Charge utile de `frames:selectionChanged`. */
export interface FramesSelectionChangedEvent {
  /** Cellules sélectionnées, dans l'ordre d'affichage (ligne, puis image). */
  readonly cells: readonly IFrameCell[];
  /** Cellules sélectionnées avant le changement. */
  readonly previous: readonly IFrameCell[];
  /** Ancre de Maj+clic (absente si aucune). */
  readonly anchor?: IFrameCell;
}

/** API publiée sous le service `frames.selection`. */
export interface IFramesSelectionService {
  /** Cellules sélectionnées, dans l'ordre d'affichage. */
  cells(): readonly IFrameCell[];
  /** Cellules sélectionnées qui portent une image clé (document courant), dans l'ordre d'affichage. */
  keyframes(): readonly ISelectedKeyframe[];
  /** Vrai si l'image `frame` du calque `rowId` est sélectionnée. */
  isSelected(rowId: string, frame: number): boolean;
  /** Ancre de Maj+clic. */
  anchor(): IFrameCell | undefined;
  /**
   * Sélectionne seulement `cell` (clic seul). Une cellule invalide (dossier,
   * ligne non affichée, image hors durée) vide la sélection.
   */
  select(cell: IFrameCell): void;
  /** Inverse l'état de `cell` (Ctrl+clic) ; sans effet sur une cellule invalide. */
  toggle(cell: IFrameCell): void;
  /**
   * Sélectionne le rectangle de l'ancre à `to` (Maj+clic), en remplaçant la
   * sélection ou, si `additive`, en la complétant. Sans ancre : comme `select`.
   */
  selectRange(to: IFrameCell, additive?: boolean): void;
  /** Remplace la sélection par `cells` (cellules invalides ignorées) ; l'ancre va sur la dernière. */
  set(cells: readonly IFrameCell[]): void;
  /** Vide la sélection et l'ancre. */
  clear(): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'frames.selection': IFramesSelectionService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'frames:selectionChanged': FramesSelectionChangedEvent;
  }
}
