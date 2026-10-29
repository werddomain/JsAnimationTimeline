// packages/editor/src/plugins/layers/reorder/reorderCommand.ts
/**
 * Commande annulable `Déplacer les calques`. Les calques verrouillés
 * peuvent être déplacés : le verrou protège les images, pas leur place dans
 * la liste.
 */

import type { ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { moveNodes } from './moveNodes';
import type { ILayerDropTarget } from './moveNodes';

/** Libellé (visible dans l'historique) de la commande de déplacement. */
export const LAYER_MOVE_LABEL = 'Déplacer les calques';

/**
 * Commande qui déplace `ids` vers `target` (voir `moveNodes`) ; sans effet
 * (même document, rien d'enregistré) si le déplacement est refusé ou ne
 * change rien. L'annulation rend l'arbre exact d'avant : l'historique est
 * linéaire, donc le document à annuler est toujours celui produit par `do`.
 */
export function createMoveLayersCommand(ids: readonly string[], target: ILayerDropTarget): ICommand {
  const movedIds = [...ids];
  const destination: ILayerDropTarget =
    target.parentId === undefined ? { index: target.index } : { parentId: target.parentId, index: target.index };
  // Arbre d'avant le dernier `do`, relu par `undo` (chaque `do` le renouvelle).
  let before: readonly LayerNode[] | undefined;
  const doFn = (doc: ITimelineDocument): ITimelineDocument => {
    const next = moveNodes(doc, movedIds, destination);
    if (next !== doc) before = doc.layers;
    return next;
  };
  const undoFn = (doc: ITimelineDocument): ITimelineDocument =>
    before === undefined ? doc : { ...doc, layers: before };
  return createCommand(LAYER_MOVE_LABEL, doFn, undoFn);
}
