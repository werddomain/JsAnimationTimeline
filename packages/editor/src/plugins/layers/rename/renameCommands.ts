// packages/editor/src/plugins/layers/rename/renameCommands.ts
/**
 * Commande annulable de `layers.rename` et règle de normalisation des noms :
 * un nom est rogné, et un nom vide ou blanc est refusé (le nœud garde son
 * ancien nom). Le renommage vaut pour un calque comme pour un dossier, même
 * verrouillé : le verrou protège les images clés, pas le nom.
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { updateLayerNode } from '../list/layerTree';

/** Libellé (visible dans l'historique) de la commande de renommage. */
export const RENAME_LABEL = 'Renommer le calque';

/** Nom rogné, ou `undefined` s'il est vide ou ne contient que des espaces. */
export function normalizeLayerName(name: string): string | undefined {
  const trimmed = name.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Commande qui renomme le nœud `id` en `name` (rogné). Sans effet (même
 * document) si le nom est déjà celui du nœud ; l'annulation rend l'ancien nom.
 * La comparaison se fait sur les noms rognés des deux côtés ; un nom stocké non rogné
 * (" Hero ") n'est donc pas normalisé par un renommage sans effet ("Hero" sur " Hero ").
 *
 * @throws Error si `id` ne désigne aucun nœud du document, ou si `name` est blanc.
 */
export function createRenameCommand(doc: ITimelineDocument, id: string, name: string): ICommand {
  const node = findNodeById(doc.layers, id);
  if (node === undefined) throw new Error(`layers.rename : le nœud « ${id} » est introuvable.`);
  const next = normalizeLayerName(name);
  if (next === undefined) throw new Error('layers.rename : le nom ne peut pas être vide.');
  const original = node.name;
  // Comparaison sur les noms rognés des deux côtés : valider « Hero » sur « Hero » ne laisse aucune trace.
  const unchanged = (target: { readonly name: string }, value: string): boolean => normalizeLayerName(target.name) === value;
  const rename = (value: string, skipUnchanged: boolean) => (current: ITimelineDocument): ITimelineDocument =>
    updateLayerNode(current, id, (target) => (skipUnchanged && unchanged(target, value) ? target : { ...target, name: value }));
  return createCommand(RENAME_LABEL, rename(next, true), rename(original, false));
}
