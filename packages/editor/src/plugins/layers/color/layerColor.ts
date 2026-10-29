// packages/editor/src/plugins/layers/color/layerColor.ts
/**
 * Couleur d'un calque ou d'un dossier : validation (`#rrggbb`) et commande
 * annulable. Fonctions pures, sans DOM. L'annulation rend au nœud son champ
 * `color` d'origine, y compris son absence.
 */

import type { ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { findNodeById, isFolder } from '@kazo-ca/timeline-runtime';
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
  // Une branche par type de nœud : le reste d'une union ne serait pas un `LayerNode` sans conversion.
  if (isFolder(node)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retire le champ pour rendre le dossier d'origine
    const { color: _removedFromFolder, ...rest } = node;
    return rest;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retire le champ pour rendre le calque d'origine
  const { color: _removed, ...rest } = node;
  return rest;
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
  // `do` compare les couleurs normalisées (« #FF0000 » = « #ff0000 » : pas d'entrée d'historique) ;
  // `undo` rend la valeur d'origine telle quelle.
  const sameAsNext = (current: string | undefined): boolean =>
    (current === undefined ? undefined : normalizeLayerColor(current)) === next;
  const apply = (value: string | undefined, skipSame: boolean) => (current: ITimelineDocument): ITimelineDocument =>
    updateLayerNode(current, id, (target) => (skipSame && sameAsNext(target.color) ? target : withColor(target, value)));
  return createCommand(LAYER_COLOR_COMMAND_LABEL, apply(next, true), apply(original, false));
}
