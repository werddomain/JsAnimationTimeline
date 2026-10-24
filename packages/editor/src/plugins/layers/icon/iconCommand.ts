// packages/editor/src/plugins/layers/icon/iconCommand.ts
/**
 * Icône d'un calque : validation d'une saisie et commande annulable. Les
 * dossiers n'ont pas de champ `icon` : la commande les laisse intacts.
 * Fonctions pures, sans DOM. L'annulation rend au calque son champ `icon`
 * d'origine, y compris son absence.
 */

import { findNodeById, isFolder } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { classifyLayerIcon } from '../list/layerIcon';
import { updateLayerNode } from '../list/layerTree';

/** Libellé (visible dans l'historique) de la commande d'icône. */
export const LAYER_ICON_COMMAND_LABEL = "Changer l'icône du calque";

/** Messages d'erreur de la saisie d'une icône personnalisée (en français). */
export const LAYER_ICON_ERRORS = Object.freeze({
  empty: 'Saisissez une URL ou des classes CSS.',
  invalid:
    'Valeur refusée : saisissez une URL (http, https, data:image, blob: ou chemin relatif) ou des classes CSS (sans préfixe jt-).'
});

/** Résultat de la validation d'une saisie. */
export type LayerIconValidation =
  | { readonly ok: true; readonly icon: string }
  | { readonly ok: false; readonly message: string };

/** Valide une icône saisie (nom intégré, URL ou classes CSS) ; la valeur gardée est rognée. */
export function validateLayerIcon(input: string): LayerIconValidation {
  const icon = input.trim();
  if (icon === '') return { ok: false, message: LAYER_ICON_ERRORS.empty };
  if (classifyLayerIcon(icon) === 'invalid') return { ok: false, message: LAYER_ICON_ERRORS.invalid };
  return { ok: true, icon };
}

/** Calque avec `icon` donné ; le champ est retiré quand `icon` est `undefined`. Un dossier est rendu tel quel. */
function withIcon(node: LayerNode, icon: string | undefined): LayerNode {
  if (isFolder(node) || node.icon === icon) return node;
  if (icon !== undefined) return { ...node, icon };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retire le champ pour rendre le calque d'origine
  const { icon: _removed, ...rest } = node;
  return rest;
}

/**
 * Commande qui donne l'icône `icon` au calque `id`, ou la retire avec
 * `undefined` (icône par défaut). Sans changement (dossier, même valeur),
 * `do` rend le même document.
 *
 * @throws Error si le nœud est introuvable ou si `icon` est refusée.
 */
export function createSetIconCommand(doc: ITimelineDocument, id: string, icon: string | undefined): ICommand {
  const node = findNodeById(doc.layers, id);
  if (node === undefined) throw new Error(`layers.icon : le nœud « ${id} » est introuvable.`);
  let next: string | undefined;
  if (icon !== undefined) {
    const checked = validateLayerIcon(icon);
    if (!checked.ok) throw new Error(`layers.icon : ${checked.message}`);
    next = checked.icon;
  }
  const original = isFolder(node) ? undefined : node.icon;
  const set = (value: string | undefined) => (current: ITimelineDocument): ITimelineDocument =>
    updateLayerNode(current, id, (target) => withIcon(target, value));
  return createCommand(LAYER_ICON_COMMAND_LABEL, set(next), set(original));
}
