// packages/editor/src/plugins/layers/list/layerTree.ts
/**
 * Accès immuable à l'arbre des calques, partagé par les plugins `layers.*` :
 * remplacement d'un nœud par id (calque ou dossier, à toute profondeur) et
 * commande annulable qui replie ou déplie un dossier.
 *
 * Les fonctions sont pures : elles retournent un nouveau document et ne
 * recopient que le chemin du nœud modifié.
 */

import { findNodeById, isFolder, resolveCollapsed } from '@kazo-ca/timeline-runtime';
import type { IFolder, ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { createCommand } from '../../../core/commands/createCommand';
import type { ICommand } from '../../../core/commands/ICommand';

/** Transformation d'un nœud ; retourner le même nœud signifie « aucun changement ». */
export type LayerNodeUpdater = (node: LayerNode) => LayerNode;

function updateIn(nodes: readonly LayerNode[], id: string, updater: LayerNodeUpdater): readonly LayerNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === id) {
      const updated = updater(node);
      changed = changed || updated !== node;
      return updated;
    }
    if (!isFolder(node)) return node;
    const children = updateIn(node.children, id, updater);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : nodes;
}

/**
 * Document où le nœud `id` est remplacé par `updater(node)`. Retourne `doc`
 * lui-même si l'id est inconnu ou si `updater` rend le même nœud.
 */
export function updateLayerNode(doc: ITimelineDocument, id: string, updater: LayerNodeUpdater): ITimelineDocument {
  const layers = updateIn(doc.layers, id, updater);
  return layers === doc.layers ? doc : { ...doc, layers };
}

/** Dossier `id` du document, ou `undefined` (id inconnu ou calque). */
export function findFolder(doc: ITimelineDocument, id: string): IFolder | undefined {
  const node = findNodeById(doc.layers, id);
  return node !== undefined && isFolder(node) ? node : undefined;
}

/** Libellés (visibles dans l'historique) des commandes de `layers.list`. */
export const LayerListCommandLabels = Object.freeze({
  collapse: 'Replier le dossier',
  expand: 'Déplier le dossier'
});

/** Dossier avec `collapsed` donné ; le champ est retiré quand il vaut sa valeur par défaut d'origine. */
function withCollapsed(folder: IFolder, collapsed: boolean | undefined): IFolder {
  if (folder.collapsed === collapsed) return folder;
  if (collapsed !== undefined) {
    // Même état affiché (champ absent = déplié) : aucun changement, donc aucune entrée d'historique.
    return resolveCollapsed(folder) === collapsed ? folder : { ...folder, collapsed };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retire le champ pour rendre le dossier d'origine
  const { collapsed: _removed, ...rest } = folder;
  return rest;
}

/**
 * Commande qui replie (`collapsed = true`) ou déplie le dossier `folderId`.
 * L'annulation rend au dossier son champ `collapsed` d'origine (y compris
 * son absence). Un dossier verrouillé peut être replié : le verrou protège
 * les images, pas l'affichage.
 *
 * @throws Error si `folderId` ne désigne pas un dossier du document.
 */
export function createSetCollapsedCommand(doc: ITimelineDocument, folderId: string, collapsed: boolean): ICommand {
  const folder = findFolder(doc, folderId);
  if (folder === undefined) throw new Error(`layers.list : le dossier « ${folderId} » est introuvable.`);
  const original = folder.collapsed;
  const label = collapsed ? LayerListCommandLabels.collapse : LayerListCommandLabels.expand;
  const set = (value: boolean | undefined) => (current: ITimelineDocument): ITimelineDocument =>
    updateLayerNode(current, folderId, (node) => (isFolder(node) ? withCollapsed(node, value) : node));
  return createCommand(label, set(collapsed), set(original));
}

/** Commande qui inverse l'état replié du dossier `folderId` (voir `createSetCollapsedCommand`). */
export function createToggleCollapsedCommand(doc: ITimelineDocument, folderId: string): ICommand {
  const folder = findFolder(doc, folderId);
  if (folder === undefined) throw new Error(`layers.list : le dossier « ${folderId} » est introuvable.`);
  return createSetCollapsedCommand(doc, folderId, !resolveCollapsed(folder));
}
