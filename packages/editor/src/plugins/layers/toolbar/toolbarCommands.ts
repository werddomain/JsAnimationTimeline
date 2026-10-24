// packages/editor/src/plugins/layers/toolbar/toolbarCommands.ts
/**
 * Commandes annulables de `layers.toolbar` : nouveau calque et suppression.
 * La sélection n'entre jamais dans une commande (état d'interface).
 *
 * Chaque commande retient, à chaque `do`, l'arbre reçu : l'annulation le
 * restitue à l'identique. Le calque est fixé à la création de la commande,
 * donc « rétablir » redonne exactement le même résultat.
 */

import type { ILayer, ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { removeNodes, topMostIds } from '../groups/groupsTree';
import { addLayer, newLayer } from './toolbarTree';

/** Libellés (visibles dans l'historique) des commandes de `layers.toolbar`. */
export const LayerToolbarCommandLabels = Object.freeze({
  newLayer: 'Nouveau calque',
  deleteLayers: 'Supprimer les calques'
});

/** Commande qui crée un calque, et l'id de ce calque. */
export interface ILayerCommand {
  readonly command: ICommand;
  readonly layerId: string;
}

/** Commande de remplacement de l'arbre, annulée en rendant l'arbre vu par `do`. */
function treeCommand(
  label: string,
  transform: (layers: readonly LayerNode[]) => readonly LayerNode[]
): ICommand {
  let before: readonly LayerNode[] | undefined;
  return createCommand(
    label,
    (current) => {
      before = current.layers;
      const layers = transform(current.layers);
      return layers === current.layers ? current : { ...current, layers };
    },
    (current) => (before === undefined ? current : { ...current, layers: before })
  );
}

/** Commande « Nouveau calque » : un calque vide au-dessus de `anchorId` (haut de l'arbre sans ancre). */
export function newLayerCommand(doc: ITimelineDocument, anchorId: string | undefined): ILayerCommand {
  const layer: ILayer = newLayer(doc.layers);
  const command = treeCommand(LayerToolbarCommandLabels.newLayer, (layers) => addLayer(layers, layer, anchorId));
  return { command, layerId: layer.id };
}

/**
 * Commande « Supprimer les calques » : retire les nœuds de plus haut niveau de
 * `ids` (un dossier emporte son sous-arbre ; un verrou n'empêche pas la
 * suppression, comme dans Flash).
 *
 * @returns `undefined` si aucun id ne désigne un nœud du document.
 */
export function deleteLayersCommand(doc: ITimelineDocument, ids: readonly string[]): ICommand | undefined {
  const top = topMostIds(doc.layers, ids);
  if (top.length === 0) return undefined;
  const removed = new Set(top);
  return treeCommand(LayerToolbarCommandLabels.deleteLayers, (layers) => removeNodes(layers, removed));
}
