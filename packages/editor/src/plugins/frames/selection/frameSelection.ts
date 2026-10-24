// packages/editor/src/plugins/frames/selection/frameSelection.ts
/**
 * Modèle sans DOM de `frames.selection`, repris de
 * `legacy/core/SelectionManager.ts` : un ensemble de cellules (une image
 * d'une ligne) et une ancre pour Maj+clic. Toutes les fonctions sont pures
 * et retournent un nouvel état.
 *
 * Différence avec le legacy : la plage de Maj+clic est un rectangle (de la
 * ligne de l'ancre à la ligne cliquée, de l'image de l'ancre à l'image
 * cliquée), comme dans Flash, et non limitée à une seule ligne. Les lignes
 * de dossier n'ont pas d'images et ne sont jamais sélectionnées.
 */

import type { IVisibleRow } from '../../../model/rows';

/** Une cellule sélectionnable : une image d'un calque. */
export interface IFrameCell {
  /** Id du calque. */
  readonly rowId: string;
  /** Image, de 1 à `totalFrames`. */
  readonly frame: number;
}

/** État de la sélection des images. */
export interface IFrameSelectionState {
  /** Cellules sélectionnées, dans l'ordre d'affichage (ligne, puis image). */
  readonly cells: readonly IFrameCell[];
  /** Ancre de Maj+clic ; absente si aucune. */
  readonly anchor?: IFrameCell;
}

/** Sélection vide. */
export const EMPTY_FRAME_SELECTION: IFrameSelectionState = Object.freeze({ cells: Object.freeze([]) });

/** Clé unique d'une cellule (l'image est après le dernier `:`, l'id peut en contenir). */
export function cellKey(cell: IFrameCell): string {
  return `${cell.rowId}:${cell.frame}`;
}

/** Vrai si `a` et `b` désignent la même cellule. */
export function sameCell(a: IFrameCell | undefined, b: IFrameCell | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.rowId === b.rowId && a.frame === b.frame);
}

/** Index d'affichage des lignes de calque visibles, par id (les dossiers en sont exclus). */
function layerRowIndex(rows: readonly IVisibleRow[]): Map<string, number> {
  const index = new Map<string, number>();
  rows.forEach((row) => {
    if (row.kind === 'layer') index.set(row.id, row.index);
  });
  return index;
}

function validCell(cell: IFrameCell, index: ReadonlyMap<string, number>, totalFrames: number): boolean {
  return index.has(cell.rowId) && Number.isInteger(cell.frame) && cell.frame >= 1 && cell.frame <= totalFrames;
}

/** Cellules valides de `cells`, sans doublon, triées dans l'ordre d'affichage. */
function normalize(cells: readonly IFrameCell[], rows: readonly IVisibleRow[], totalFrames: number): IFrameCell[] {
  const index = layerRowIndex(rows);
  const seen = new Set<string>();
  const kept: IFrameCell[] = [];
  cells.forEach((cell) => {
    const key = cellKey(cell);
    if (!validCell(cell, index, totalFrames) || seen.has(key)) return;
    seen.add(key);
    kept.push({ rowId: cell.rowId, frame: cell.frame });
  });
  return kept.sort((a, b) => (index.get(a.rowId) ?? 0) - (index.get(b.rowId) ?? 0) || a.frame - b.frame);
}

/** Vrai si `cell` est une image d'une ligne de calque visible, dans la durée. */
export function isSelectableCell(cell: IFrameCell, rows: readonly IVisibleRow[], totalFrames: number): boolean {
  return validCell(cell, layerRowIndex(rows), totalFrames);
}

/** Sélectionne seulement `cell` (clic seul) ; l'ancre va sur elle. Une cellule invalide vide la sélection. */
export function selectOnly(
  cell: IFrameCell,
  rows: readonly IVisibleRow[],
  totalFrames: number
): IFrameSelectionState {
  const cells = normalize([cell], rows, totalFrames);
  return cells[0] === undefined ? EMPTY_FRAME_SELECTION : { cells, anchor: cells[0] };
}

/** Inverse l'état de `cell` (Ctrl+clic) ; l'ancre va sur elle si elle est ajoutée. */
export function toggleCell(
  state: IFrameSelectionState,
  cell: IFrameCell,
  rows: readonly IVisibleRow[],
  totalFrames: number
): IFrameSelectionState {
  if (!isSelectableCell(cell, rows, totalFrames)) return state;
  const key = cellKey(cell);
  if (state.cells.some((candidate) => cellKey(candidate) === key)) {
    const cells = state.cells.filter((candidate) => cellKey(candidate) !== key);
    const anchor = sameCell(state.anchor, cell) ? undefined : state.anchor;
    return anchor === undefined ? { cells } : { cells, anchor };
  }
  const anchor: IFrameCell = { rowId: cell.rowId, frame: cell.frame };
  return { cells: normalize([...state.cells, cell], rows, totalFrames), anchor };
}

/**
 * Cellules du rectangle de `from` à `to` (dans un sens ou l'autre) : les
 * lignes de calque visibles entre les deux, les images entre les deux.
 * Vide si l'une des deux n'est pas sur une ligne de calque visible.
 */
export function rectangleCells(
  from: IFrameCell,
  to: IFrameCell,
  rows: readonly IVisibleRow[],
  totalFrames: number
): IFrameCell[] {
  const index = layerRowIndex(rows);
  const fromRow = index.get(from.rowId);
  const toRow = index.get(to.rowId);
  if (fromRow === undefined || toRow === undefined) return [];
  const top = Math.min(fromRow, toRow);
  const bottom = Math.max(fromRow, toRow);
  const first = Math.max(1, Math.min(from.frame, to.frame));
  const last = Math.min(totalFrames, Math.max(from.frame, to.frame));
  const cells: IFrameCell[] = [];
  rows.forEach((row) => {
    if (row.kind !== 'layer' || row.index < top || row.index > bottom) return;
    for (let frame = first; frame <= last; frame += 1) cells.push({ rowId: row.id, frame });
  });
  return cells;
}

/**
 * Maj+clic : rectangle de l'ancre à `to`, en remplaçant la sélection ou, si
 * `additive` (Ctrl+Maj), en la complétant. L'ancre ne bouge pas. Sans ancre
 * valide : comme un clic seul (une cellule invalide vide la sélection), ou,
 * si `additive`, `to` est ajoutée et devient l'ancre. Avec une ancre, une
 * cellule `to` invalide ne change rien.
 */
export function selectRectangle(
  state: IFrameSelectionState,
  to: IFrameCell,
  additive: boolean,
  rows: readonly IVisibleRow[],
  totalFrames: number
): IFrameSelectionState {
  const anchor = state.anchor;
  if (anchor === undefined || !isSelectableCell(anchor, rows, totalFrames)) {
    // Comme un clic seul : une cellule invalide (dossier...) vide la sélection.
    if (!additive) return selectOnly(to, rows, totalFrames);
    if (!isSelectableCell(to, rows, totalFrames)) return state;
    return { cells: normalize([...state.cells, to], rows, totalFrames), anchor: { rowId: to.rowId, frame: to.frame } };
  }
  if (!isSelectableCell(to, rows, totalFrames)) return state;
  const rectangle = rectangleCells(anchor, to, rows, totalFrames);
  return { cells: normalize(additive ? [...state.cells, ...rectangle] : rectangle, rows, totalFrames), anchor };
}

/** Vrai si les deux listes contiennent les mêmes cellules dans le même ordre. */
export function sameCells(a: readonly IFrameCell[], b: readonly IFrameCell[]): boolean {
  return a.length === b.length && a.every((cell, index) => sameCell(cell, b[index]));
}

/**
 * Retire les cellules qui ne sont plus sur une ligne de calque visible ou
 * qui dépassent `totalFrames` (calque supprimé, dossier replié, durée
 * réduite), et l'ancre si elle n'est plus valide. Retourne `state` lui-même
 * si rien ne change.
 */
export function pruneSelection(
  state: IFrameSelectionState,
  rows: readonly IVisibleRow[],
  totalFrames: number
): IFrameSelectionState {
  const cells = normalize(state.cells, rows, totalFrames);
  const anchor = state.anchor !== undefined && isSelectableCell(state.anchor, rows, totalFrames) ? state.anchor : undefined;
  if (anchor === state.anchor && sameCells(cells, state.cells)) return state;
  return anchor === undefined ? { cells } : { cells, anchor };
}

/** Suite d'images contiguës sélectionnées sur une ligne (dessinée en un seul rectangle). */
export interface ICellRun {
  readonly rowId: string;
  readonly first: number;
  readonly last: number;
}

/** Regroupe des cellules triées (ordre d'affichage) en suites contiguës par ligne. */
export function cellRuns(cells: readonly IFrameCell[]): ICellRun[] {
  const runs: ICellRun[] = [];
  cells.forEach((cell) => {
    const previous = runs[runs.length - 1];
    if (previous !== undefined && previous.rowId === cell.rowId && cell.frame === previous.last + 1) {
      runs[runs.length - 1] = { ...previous, last: cell.frame };
    } else {
      runs.push({ rowId: cell.rowId, first: cell.frame, last: cell.frame });
    }
  });
  return runs;
}

/** Remplace la sélection par `cells` (cellules invalides ignorées) ; l'ancre va sur la dernière cellule donnée valide. */
export function selectCells(
  cells: readonly IFrameCell[],
  rows: readonly IVisibleRow[],
  totalFrames: number
): IFrameSelectionState {
  const kept = normalize(cells, rows, totalFrames);
  const index = layerRowIndex(rows);
  const last = [...cells].reverse().find((cell) => validCell(cell, index, totalFrames));
  return last === undefined ? EMPTY_FRAME_SELECTION : { cells: kept, anchor: { rowId: last.rowId, frame: last.frame } };
}
