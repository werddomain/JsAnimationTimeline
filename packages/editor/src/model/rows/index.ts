// packages/editor/src/model/rows/index.ts
/**
 * Point d'entrée du modèle des lignes visibles, partagé par la liste des
 * calques (`layers.list`) et la grille des images (`frames.grid`).
 */

export { DEFAULT_FRAME_WIDTH, ROW_HEIGHT } from './rowMetrics';
export { visibleRows } from './visibleRows';
export type { IVisibleRow } from './visibleRows';
