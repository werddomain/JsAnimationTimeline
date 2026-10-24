// packages/editor/src/plugins/layers/reorder/moveNodes.ts
/**
 * Déplacement d'un ensemble de nœuds vers `(parentId, index)` : fonction
 * pure sur le document, utilisée par la commande `Déplacer les calques`.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { childrenOf, detachNodes, insertNodes, isSameOrDescendant, sameArrangement, topMostIds } from './treeMoves';

/** Destination d'un déplacement : un dossier (premier niveau si absent) et un index parmi ses enfants. */
export interface ILayerDropTarget {
  /** Dossier d'accueil ; absent pour le premier niveau. */
  readonly parentId?: string;
  /**
   * Index dans la liste d'enfants de la destination telle qu'elle est AVANT
   * le déplacement (celle que voit l'utilisateur) ; borné à la longueur.
   */
  readonly index: number;
}

/**
 * Document où les nœuds `ids` sont déplacés vers `target`. On ne déplace que
 * les nœuds de tête (un dossier emporte ses enfants) ; ils gardent leur ordre
 * d'affichage. Le document est rendu tel quel (même référence) si rien ne
 * doit changer : aucun id connu, destination inconnue ou calque, dossier
 * déplacé dans lui-même ou dans un de ses descendants, index invalide, ou
 * déplacement qui laisse l'arbre identique.
 *
 * Les calques verrouillés peuvent être déplacés : le verrou protège les
 * images, pas la place dans la liste.
 */
export function moveNodes(doc: ITimelineDocument, ids: readonly string[], target: ILayerDropTarget): ITimelineDocument {
  const top = topMostIds(doc.layers, ids);
  const siblings = childrenOf(doc.layers, target.parentId);
  if (top.length === 0 || siblings === undefined || !Number.isFinite(target.index)) return doc;
  const { parentId } = target;
  if (parentId !== undefined && top.some((id) => isSameOrDescendant(doc.layers, id, parentId))) return doc;
  const at = Math.min(siblings.length, Math.max(0, Math.trunc(target.index)));
  // Les frères retirés avant `at` décalent la place d'insertion.
  const removedBefore = siblings.slice(0, at).filter((node) => top.includes(node.id)).length;
  const { nodes: rest, detached } = detachNodes(doc.layers, top);
  const layers = insertNodes(rest, parentId, at - removedBefore, detached);
  return sameArrangement(layers, doc.layers) ? doc : { ...doc, layers };
}
