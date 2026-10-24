// packages/editor/src/plugins/layers/color/layerColor.ts
/**
 * Couleur d'un calque ou d'un dossier : validation (`#rrggbb`) et commande
 * annulable. Fonctions pures, sans DOM. L'annulation rend au nœud son champ
 * `color` d'origine, y compris son absence.
 */

import type { ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { findNodeById } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { updateLayerNode } from '../list/layerTree';

/** Libellé (visible dans l'historique) de la commande de couleur. */
export const LAYER_COLOR_COMMAND_LABEL = 'Changer la couleur du calque';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Couleur `#rrggbb` en minuscules, ou `undefined` si `value` n'a pas cette forme. */
export function normalizeLayerColor(value: string): string | undefined {
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

/** Nœud avec `color` donnée ; le champ est retiré quand `color` est `undefined`. */
function withColor(node: LayerNode, color: string | undefined): LayerNode {
  if (node.color === color) return node;
  if (color !== undefined) return { ...node, color };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retire le champ pour rendre le nœud d'origine
  const { color: _removed, ...rest } = node;
  return rest as LayerNode;
}

/**
 * Commande qui donne la couleur `color` au nœud `id` (calque ou dossier), ou
 * la retire avec `undefined`. Sans changement, `do` rend le même document.
 *
 * @throws Error si le nœud est introuvable ou si `color` n'est pas `#rrggbb`.
 */
export function createSetColorCommand(doc: ITimelineDocument, id: string, color: string | undefined): ICommand {
  const node = findNodeById(doc.layers, id);
  if (node === undefined) throw new Error(`layers.color : le nœud « ${id} » est introuvable.`);
  const next = color === undefined ? undefined : normalizeLayerColor(color);
  if (color !== undefined && next === undefined) {
    throw new Error(`layers.color : couleur invalide ${JSON.stringify(color)} (attendu #rrggbb).`);
  }
  const original = node.color;
  const set = (value: string | undefined) => (current: ITimelineDocument): ITimelineDocument =>
    updateLayerNode(current, id, (target) => withColor(target, value));
  return createCommand(LAYER_COLOR_COMMAND_LABEL, set(next), set(original));
}
