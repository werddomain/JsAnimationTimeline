// packages/editor/src/plugins/layers/reorder/dropTarget.ts
/**
 * Calcul pur de la destination d'un dépôt : d'une ligne visée et de la
 * position verticale du pointeur sur elle (0 en haut, 1 en bas), on tire
 * `{ parentId?, index }` pour `moveNodes`, plus de quoi dessiner le repère.
 *
 * Comportement (comme Flash CS4) :
 * - partie haute d'une ligne : insérer avant elle ;
 * - partie basse : insérer après elle ; sous un dossier déplié qui a des
 *   enfants, « après » veut dire en premier enfant (c'est là que tombe le trait) ;
 * - milieu d'un dossier : le ranger dedans, en PREMIER enfant (index 0, juste
 *   sous la ligne du dossier) ;
 * - sous la dernière ligne de la liste : à la fin du premier niveau (moyen de
 *   sortir d'un dossier dont on survole le dernier enfant).
 */

import { findNodeById, isFolder, resolveCollapsed } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, LayerNodeType } from '@werddomain/timeline-runtime';
import type { ILayerDropTarget } from './moveNodes';
import { findNodeLocation } from './treeMoves';

/** En dessous de ce rapport, le pointeur est sur la partie haute d'une ligne. */
export const DROP_BEFORE_RATIO = 0.25;
/** Au-dessus de ce rapport, le pointeur est sur la partie basse d'une ligne. */
export const DROP_AFTER_RATIO = 0.75;

/** Où tombe le dépôt par rapport à la ligne visée. */
export type DropPosition = 'before' | 'after' | 'into' | 'end';

/** Destination calculée, avec la ligne visée et la position pour le repère visuel. */
export interface IDropPlacement extends ILayerDropTarget {
  readonly position: DropPosition;
  /** Ligne visée ; absente pour `end` (sous la dernière ligne). */
  readonly rowId?: string;
}

/** Ligne visée : son id et son genre. */
export interface IDropRow {
  readonly id: string;
  readonly kind: LayerNodeType;
}

/** Zone de la ligne : dossier = haut / milieu / bas, calque = haut / bas. */
export function dropZone(kind: LayerNodeType, ratio: number): 'before' | 'after' | 'into' {
  if (kind === 'folder') {
    if (ratio < DROP_BEFORE_RATIO) return 'before';
    return ratio > DROP_AFTER_RATIO ? 'after' : 'into';
  }
  return ratio < 0.5 ? 'before' : 'after';
}

function withParent(parentId: string | undefined, index: number): ILayerDropTarget {
  return parentId === undefined ? { index } : { parentId, index };
}

/**
 * Destination d'un dépôt sur `row` à la position `ratio` (0 à 1). `undefined`
 * si la ligne n'est pas dans le document. Ne vérifie pas que le déplacement
 * est permis : c'est `moveNodes` qui refuse (dossier dans lui-même...).
 */
export function computeDropTarget(doc: ITimelineDocument, row: IDropRow, ratio: number): IDropPlacement | undefined {
  const location = findNodeLocation(doc.layers, row.id);
  const node = findNodeById(doc.layers, row.id);
  if (location === undefined || node === undefined) return undefined;
  const zone = dropZone(row.kind, ratio);
  if (zone === 'into') return { parentId: row.id, index: 0, position: 'into', rowId: row.id };
  if (zone === 'before') return { ...withParent(location.parentId, location.index), position: 'before', rowId: row.id };
  if (isFolder(node) && !resolveCollapsed(node) && node.children.length > 0) {
    return { parentId: row.id, index: 0, position: 'after', rowId: row.id };
  }
  return { ...withParent(location.parentId, location.index + 1), position: 'after', rowId: row.id };
}

/** Destination seule d'un placement (sans la ligne visée ni la position). */
export function toDropTarget(placement: ILayerDropTarget): ILayerDropTarget {
  return withParent(placement.parentId, placement.index);
}

/** Rectangle vertical d'une ligne affichée, en pixels de la fenêtre. */
export interface IRowBox extends IDropRow {
  readonly top: number;
  readonly height: number;
}

/** Ligne sous le pointeur et position verticale sur elle ; `below` : sous la dernière ligne. */
export type DropHit = { readonly row: IRowBox; readonly ratio: number } | 'below';

/**
 * Ligne qui contient l'ordonnée `clientY` parmi `boxes` (en ordre
 * d'affichage). Au-dessus de la première ligne, c'est le haut de la
 * première ; sous la dernière, `below`. `undefined` s'il n'y a aucune ligne.
 */
export function locateDrop(boxes: readonly IRowBox[], clientY: number): DropHit | undefined {
  const first = boxes[0];
  if (first === undefined) return undefined;
  if (clientY < first.top) return { row: first, ratio: 0 };
  const hit = boxes.find((box) => clientY >= box.top && clientY < box.top + box.height);
  if (hit === undefined) return 'below';
  return { row: hit, ratio: (clientY - hit.top) / hit.height };
}

/** Destination d'un dépôt à `hit` : sous la dernière ligne, fin du premier niveau. */
export function placementAt(doc: ITimelineDocument, hit: DropHit): IDropPlacement | undefined {
  if (hit === 'below') return { index: doc.layers.length, position: 'end' };
  return computeDropTarget(doc, hit.row, hit.ratio);
}
