// packages/editor/src/plugins/layers/lock/lockCommands.ts
/**
 * Commandes annulables de `layers.lock` : verrouiller ou déverrouiller un
 * nœud, ou tous les nœuds de premier niveau d'un coup. Le verrou n'est
 * qu'une donnée : ce sont les commandes qui modifient des images clés qui le
 * respectent (elles refusent un calque verrouillé ou dans un dossier verrouillé).
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ICommand } from '../../../core/commands/ICommand';
import { LOCKED_FLAG, createSetAllFlagCommand, createSetFlagCommand } from '../layerFlags';

/** Libellés (visibles dans l'historique et sur les boutons) de `layers.lock`. */
export const LockLabels = Object.freeze({
  lock: 'Verrouiller le calque',
  unlock: 'Déverrouiller le calque',
  lockAll: 'Verrouiller tous les calques',
  unlockAll: 'Déverrouiller tous les calques'
});

/**
 * Commande qui verrouille (`true`) ou déverrouille le nœud `id`.
 *
 * @throws Error si `id` ne désigne aucun nœud du document.
 */
export function createSetLockedCommand(doc: ITimelineDocument, id: string, locked: boolean): ICommand {
  return createSetFlagCommand(doc, LOCKED_FLAG, id, locked, locked ? LockLabels.lock : LockLabels.unlock);
}

/** Commande qui verrouille ou déverrouille tous les nœuds de premier niveau (une seule entrée d'historique). */
export function createSetAllLockedCommand(doc: ITimelineDocument, locked: boolean): ICommand {
  return createSetAllFlagCommand(doc, LOCKED_FLAG, locked, locked ? LockLabels.lockAll : LockLabels.unlockAll);
}
