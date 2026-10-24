// packages/editor/src/plugins/layers/groups/groupCommands.ts
/**
 * Commandes annulables de `layers.groups` : nouveau dossier, grouper la
 * sélection, dissocier un dossier. La sélection est de l'état d'interface :
 * elle n'entre jamais dans une commande, les ids lui sont passés.
 *
 * Chaque commande retient, à chaque `do`, l'arbre qu'elle a reçu : l'annulation
 * le restitue à l'identique (la pile garantit qu'elle s'applique au document
 * produit par `do`). `do` recalcule depuis le document reçu avec un dossier fixé à la
 * création, donc « rétablir » redonne exactement le même résultat.
 */

import type { IFolder, ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { findFolder } from '../list/layerTree';
import { addFolder, groupNodes, newFolder, topMostIds, ungroupNode } from './groupsTree';

/** Libellés (visibles dans l'historique) des commandes de `layers.groups`. */
export const LayerGroupsCommandLabels = Object.freeze({
  createFolder: 'Nouveau dossier',
  group: 'Grouper la sélection',
  ungroup: 'Dissocier le dossier'
});

/** Commande qui crée un dossier, et l'id de ce dossier. */
export interface IFolderCommand {
  readonly command: ICommand;
  /** Id du dossier créé (unique dans le document au moment de la création). */
  readonly folderId: string;
}

/**
 * Commande de remplacement de l'arbre, annulée en rendant l'arbre vu par `do`
 * (le document réellement reçu, retenu à chaque exécution, y compris au rétablissement).
 */
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

/**
 * Commande « Nouveau dossier » : insère un dossier vide « Dossier N » au-dessus
 * de `anchorId` (dans son parent) ou, sans ancre connue, tout en haut de l'arbre.
 */
export function createFolderCommand(doc: ITimelineDocument, anchorId: string | undefined): IFolderCommand {
  const folder: IFolder = newFolder(doc.layers);
  const command = treeCommand(LayerGroupsCommandLabels.createFolder, (layers) =>
    addFolder(layers, folder, anchorId)
  );
  return { command, folderId: folder.id };
}

/**
 * Commande « Grouper la sélection » : range les nœuds de plus haut niveau de
 * `ids` dans un nouveau dossier, à la place du premier.
 *
 * @returns `undefined` si aucun id ne désigne un nœud du document (sélection vide).
 */
export function groupSelectionCommand(doc: ITimelineDocument, ids: readonly string[]): IFolderCommand | undefined {
  const top = topMostIds(doc.layers, ids);
  if (top.length === 0) return undefined;
  const folder: IFolder = newFolder(doc.layers);
  const command = treeCommand(LayerGroupsCommandLabels.group, (layers) => groupNodes(layers, top, folder));
  return { command, folderId: folder.id };
}

/**
 * Commande « Dissocier le dossier » : remplace le dossier par ses enfants.
 *
 * @throws Error si `folderId` ne désigne pas un dossier du document.
 */
export function ungroupCommand(doc: ITimelineDocument, folderId: string): ICommand {
  if (findFolder(doc, folderId) === undefined) {
    throw new Error(`layers.groups : le dossier « ${folderId} » est introuvable.`);
  }
  return treeCommand(LayerGroupsCommandLabels.ungroup, (layers) => ungroupNode(layers, folderId));
}
