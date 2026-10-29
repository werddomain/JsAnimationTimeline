// packages/editor/src/plugins/layers/target/targetCommands.ts
/**
 * Commande annulable de `layers.target` : « Changer la cible du calque ».
 * Elle ne vaut que pour un calque (un dossier n'a pas de cible) et enregistre
 * une copie de la cible après le contrôle de forme. Sans changement (même
 * cible), le document est rendu tel quel : aucune entrée d'historique.
 * L'annulation remet la cible d'origine, ou retire le champ s'il n'y en
 * avait pas.
 */

import { findNodeById, isLayer, sameTarget } from '@kazo-ca/timeline-runtime';
import type { ILayer, ITimelineDocument, LayerTarget, SerializableLayerTarget } from '@kazo-ca/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { updateLayerNode } from '../list/layerTree';
import { toSavableTarget } from './targetValidation';

/** Libellé de la commande (historique). */
export const TARGET_LABEL = 'Changer la cible du calque';

/** `layer` avec `target`, ou sans champ `target` si `target` vaut `undefined`. */
function withTarget(layer: ILayer, target: LayerTarget | undefined): ILayer {
  if (target === undefined) {
    // Retire le champ, sans le laisser à `undefined` (le document reste sérialisable à l'identique).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { target: _removed, ...rest } = layer;
    return rest;
  }
  return sameTarget(layer.target, target) ? layer : { ...layer, target };
}

/**
 * Commande qui donne la cible `target` au calque `layerId`.
 *
 * @throws Error si `layerId` n'est pas un calque du document, ou si `target`
 *   n'est pas une cible enregistrable (forme de F06, jamais `{ element }`).
 */
export function createSetTargetCommand(doc: ITimelineDocument, layerId: string, target: unknown): ICommand {
  const node = findNodeById(doc.layers, layerId);
  if (node === undefined) throw new Error(`Changer la cible : « ${layerId} » n'existe pas dans le document.`);
  if (!isLayer(node)) throw new Error(`Changer la cible : « ${layerId} » est un dossier, pas un calque.`);
  const next: SerializableLayerTarget | undefined = toSavableTarget(target);
  if (next === undefined) throw new Error('Changer la cible : cible invalide (un sélecteur CSS ou une ref, sans élément vivant).');
  const original = node.target;
  const apply = (value: LayerTarget | undefined) => (current: ITimelineDocument): ITimelineDocument =>
    updateLayerNode(current, layerId, (found) => (isLayer(found) ? withTarget(found, value) : found));
  return createCommand(TARGET_LABEL, apply(next), apply(original));
}
