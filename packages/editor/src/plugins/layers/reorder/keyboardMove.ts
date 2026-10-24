// packages/editor/src/plugins/layers/reorder/keyboardMove.ts
/**
 * Déplacement d'une case au clavier (Ctrl+Alt+Haut / Bas) : calcule la
 * destination de la sélection à partir des lignes visibles, sans souris.
 *
 * Une « case » est une ligne visible, avec ces règles :
 * - Haut : avant la ligne qui précède la première ligne de tête ; si c'est
 *   le dossier parent, on sort au-dessus de lui ; si c'est le dernier
 *   descendant d'un dossier déplié, on y entre en dernier ;
 * - Bas : après la ligne qui suit la dernière ligne de tête (et ses
 *   descendants) ; sur un dossier déplié, on y entre en premier ; en fin de
 *   dossier, on sort juste après lui ;
 * - au bord de la liste, au premier niveau : aucun déplacement.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { IVisibleRow } from '../../../model/rows';
import { computeDropTarget, toDropTarget } from './dropTarget';
import type { ILayerDropTarget } from './moveNodes';
import { findNodeLocation, topMostIds } from './treeMoves';

/** Sens d'un déplacement au clavier. */
export type MoveDirection = 'up' | 'down';

function withParent(parentId: string | undefined, index: number): ILayerDropTarget {
  return parentId === undefined ? { index } : { parentId, index };
}

function placeOrUndefined(placement: ILayerDropTarget | undefined): ILayerDropTarget | undefined {
  return placement === undefined ? undefined : toDropTarget(placement);
}

/** Juste avant (`offset` 0) ou juste après (`offset` 1) le dossier `folderId`. */
function aroundFolder(doc: ITimelineDocument, folderId: string, offset: 0 | 1): ILayerDropTarget | undefined {
  const location = findNodeLocation(doc.layers, folderId);
  return location === undefined ? undefined : withParent(location.parentId, location.index + offset);
}

function upTarget(doc: ITimelineDocument, rows: readonly IVisibleRow[], firstId: string): ILayerDropTarget | undefined {
  const index = rows.findIndex((row) => row.id === firstId);
  const own = rows[index];
  const previous = rows[index - 1];
  if (own === undefined || previous === undefined) return undefined;
  if (previous.id === own.parentId) return aroundFolder(doc, previous.id, 0);
  if (previous.parentId === own.parentId) return placeOrUndefined(computeDropTarget(doc, previous, 0));
  // Dernier descendant d'un dossier déplié : on y entre, à la fin.
  const location = findNodeLocation(doc.layers, previous.id);
  return location === undefined ? undefined : withParent(location.parentId, location.index + 1);
}

function downTarget(doc: ITimelineDocument, rows: readonly IVisibleRow[], lastId: string): ILayerDropTarget | undefined {
  const index = rows.findIndex((row) => row.id === lastId);
  const own = rows[index];
  if (own === undefined) return undefined;
  let next = index + 1;
  while ((rows[next]?.depth ?? 0) > own.depth) next += 1;
  const following = rows[next];
  if (own.parentId !== undefined && following?.parentId !== own.parentId) {
    return aroundFolder(doc, own.parentId, 1);
  }
  return following === undefined ? undefined : placeOrUndefined(computeDropTarget(doc, following, 1));
}

/**
 * Destination de `ids` déplacés d'une case dans le sens `direction`, ou
 * `undefined` si aucun déplacement n'est possible. `rows` : lignes visibles
 * en ordre d'affichage.
 */
export function keyboardMoveTarget(
  doc: ITimelineDocument,
  rows: readonly IVisibleRow[],
  ids: readonly string[],
  direction: MoveDirection
): ILayerDropTarget | undefined {
  const top = topMostIds(doc.layers, ids);
  const edge = direction === 'up' ? top[0] : top[top.length - 1];
  if (edge === undefined) return undefined;
  return direction === 'up' ? upTarget(doc, rows, edge) : downTarget(doc, rows, edge);
}
