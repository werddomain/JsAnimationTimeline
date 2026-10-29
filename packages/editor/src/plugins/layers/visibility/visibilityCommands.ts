// packages/editor/src/plugins/layers/visibility/visibilityCommands.ts
/**
 * Commandes annulables de `layers.visibility` : afficher ou masquer un nœud,
 * ou tous les nœuds de premier niveau d'un coup. Le drapeau `visible` est une
 * simple donnée de l'éditeur : aucune scène ni cible n'est touchée.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ICommand } from '../../../core/commands/ICommand';
import { VISIBLE_FLAG, createSetAllFlagCommand, createSetFlagCommand } from '../layerFlags';

/** Libellés (visibles dans l'historique et sur les boutons) de `layers.visibility`. */
export const VisibilityLabels = Object.freeze({
  hide: 'Masquer le calque',
  show: 'Afficher le calque',
  hideAll: 'Masquer tous les calques',
  showAll: 'Afficher tous les calques'
});

/**
 * Commande qui affiche (`true`) ou masque le nœud `id`.
 *
 * @throws Error si `id` ne désigne aucun nœud du document.
 */
export function createSetVisibleCommand(doc: ITimelineDocument, id: string, visible: boolean): ICommand {
  return createSetFlagCommand(doc, VISIBLE_FLAG, id, visible, visible ? VisibilityLabels.show : VisibilityLabels.hide);
}

/** Commande qui affiche ou masque tous les nœuds de premier niveau (une seule entrée d'historique). */
export function createSetAllVisibleCommand(doc: ITimelineDocument, visible: boolean): ICommand {
  return createSetAllFlagCommand(
    doc,
    VISIBLE_FLAG,
    visible,
    visible ? VisibilityLabels.showAll : VisibilityLabels.hideAll
  );
}
