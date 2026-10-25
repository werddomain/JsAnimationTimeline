// packages/editor/src/plugins/frames/clipboard/pastePlan.ts
/**
 * Plan d'un collage : où chaque suite du presse-papiers atterrit. La ligne
 * est la ligne de la cible plus `rowOffset`, comptée parmi les lignes de
 * CALQUE visibles (les dossiers sont sautés) ; les lignes au-delà de la
 * dernière sont abandonnées. L'image est celle de la cible plus
 * `frameOffset`. Sans DOM ni document : seulement les lignes visibles.
 */

import type { IVisibleRow } from '../../../model/rows';
import type { IFrameCell } from '../selection/frameSelection';
import type { IPastePlacement } from './pasteCommand';
import type { IFrameClip } from './types';

/** Où coller, et les cellules qui seront occupées après le collage. */
export interface IPastePlan {
  readonly placements: readonly IPastePlacement[];
  readonly cells: readonly IFrameCell[];
}

/** Plan du collage de `clip` à `target`, ou `undefined` s'il ne reste aucune ligne où coller. */
export function planPaste(
  clip: IFrameClip,
  rows: readonly IVisibleRow[],
  target: IFrameCell
): IPastePlan | undefined {
  const layerRows = rows.filter((row) => row.kind === 'layer');
  const targetIndex = layerRows.findIndex((row) => row.id === target.rowId);
  if (targetIndex < 0) return undefined;
  const placements: IPastePlacement[] = [];
  const cells: IFrameCell[] = [];
  clip.rows.forEach((clipRow) => {
    const row = layerRows[targetIndex + clipRow.rowOffset];
    if (row === undefined) return;
    const runs = clipRow.runs.map((run) => ({ at: target.frame + run.frameOffset, run }));
    placements.push({ layerId: row.id, runs });
    runs.forEach(({ at, run }) => {
      for (let frame = at; frame < at + run.length; frame += 1) cells.push({ rowId: row.id, frame });
    });
  });
  return placements.length === 0 ? undefined : { placements, cells };
}
