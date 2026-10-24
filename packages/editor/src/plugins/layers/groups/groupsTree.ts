// packages/editor/src/plugins/layers/groups/groupsTree.ts
/**
 * Opérations pures sur l'arbre des calques pour `layers.groups` : noms et
 * ids des nouveaux dossiers, insertion, retrait, regroupement et
 * dissociation. Les fonctions ne modifient jamais leur entrée (le document
 * est figé) et ne recopient que les chemins touchés.
 */

import { findNodeById, flattenLayers, isFolder } from '@werddomain/timeline-runtime';
import type { IFolder, LayerNode } from '@werddomain/timeline-runtime';

/** Préfixe des noms de dossier créés par l'éditeur (« Dossier 1 »). */
export const FOLDER_NAME_PREFIX = 'Dossier';

/** Préfixe des ids de dossier créés par l'éditeur (`folder-1`). */
export const FOLDER_ID_PREFIX = 'folder-';

/** Emplacement d'un nœud : dossier parent (`undefined` = racine) et rang parmi ses frères. */
export interface INodeLocation {
  readonly parentId: string | undefined;
  readonly index: number;
}

/** Plus petit entier ≥ 1 qui n'est pas dans `used`. */
export function smallestFree(used: ReadonlySet<number>): number {
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

/** Entiers N des textes de la forme `<prefix>N` (N sans zéro initial). */
export function numbersWithPrefix(texts: readonly string[], prefix: string): Set<number> {
  const found = new Set<number>();
  texts.forEach((text) => {
    if (!text.startsWith(prefix)) return;
    const rest = text.slice(prefix.length);
    if (/^[1-9][0-9]*$/.test(rest)) found.add(Number(rest));
  });
  return found;
}

/** Nom « Dossier N », N étant le plus petit numéro non utilisé par un nom de l'arbre. */
export function nextFolderName(nodes: readonly LayerNode[]): string {
  const names = flattenLayers(nodes).map((visit) => visit.node.name);
  return `${FOLDER_NAME_PREFIX} ${smallestFree(numbersWithPrefix(names, `${FOLDER_NAME_PREFIX} `))}`;
}

/** Ids de l'arbre : ceux des nœuds et ceux des plages (les ids sont uniques sur les deux). */
function allIds(nodes: readonly LayerNode[]): string[] {
  return flattenLayers(nodes).flatMap(({ node }) =>
    isFolder(node) ? [node.id] : [node.id, ...node.spans.map((span) => span.id)]
  );
}

/** Id `folder-N`, N étant le plus petit numéro non utilisé par un id de l'arbre, plages comprises (déterministe). */
export function nextFolderId(nodes: readonly LayerNode[]): string {
  const ids = allIds(nodes);
  return `${FOLDER_ID_PREFIX}${smallestFree(numbersWithPrefix(ids, FOLDER_ID_PREFIX))}`;
}

/** Nouveau dossier vide, déplié (sans `collapsed`), nommé et identifié sans collision dans `nodes`. */
export function newFolder(nodes: readonly LayerNode[]): IFolder {
  return { id: nextFolderId(nodes), type: 'folder', name: nextFolderName(nodes), children: [] };
}

/** Emplacement du nœud `id`, ou `undefined` s'il est absent. */
export function locateNode(nodes: readonly LayerNode[], id: string): INodeLocation | undefined {
  const visit = flattenLayers(nodes).find((item) => item.node.id === id);
  if (visit === undefined) return undefined;
  return { parentId: visit.parentIds[visit.parentIds.length - 1], index: visit.index };
}

/** Applique `change` à la liste d'enfants du dossier `parentId` (la racine si `undefined`). */
function withChildren(
  nodes: readonly LayerNode[],
  parentId: string | undefined,
  change: (children: readonly LayerNode[]) => readonly LayerNode[]
): readonly LayerNode[] {
  if (parentId === undefined) return change(nodes);
  let changed = false;
  const next = nodes.map((node) => {
    if (!isFolder(node)) return node;
    const children =
      node.id === parentId ? change(node.children) : withChildren(node.children, parentId, change);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : nodes;
}

/** Arbre où `node` est inséré au rang `index` des enfants de `parentId` (la racine si `undefined`). */
export function insertNode(
  nodes: readonly LayerNode[],
  parentId: string | undefined,
  index: number,
  node: LayerNode
): readonly LayerNode[] {
  return withChildren(nodes, parentId, (children) => [
    ...children.slice(0, index),
    node,
    ...children.slice(index)
  ]);
}

/** Arbre sans les nœuds dont l'id est dans `ids` (à toute profondeur). */
export function removeNodes(nodes: readonly LayerNode[], ids: ReadonlySet<string>): readonly LayerNode[] {
  let changed = false;
  const next: LayerNode[] = [];
  nodes.forEach((node) => {
    if (ids.has(node.id)) {
      changed = true;
      return;
    }
    const children = isFolder(node) ? removeNodes(node.children, ids) : undefined;
    if (isFolder(node) && children !== node.children) {
      changed = true;
      next.push({ ...node, children: children ?? node.children });
    } else {
      next.push(node);
    }
  });
  return changed ? next : nodes;
}

/**
 * Ids de plus haut niveau de `selected`, dans l'ordre d'affichage de
 * l'arbre : ceux dont un dossier parent est aussi sélectionné sont écartés,
 * ainsi que les ids inconnus.
 */
export function topMostIds(nodes: readonly LayerNode[], selected: readonly string[]): string[] {
  const chosen = new Set(selected);
  return flattenLayers(nodes)
    .filter((visit) => chosen.has(visit.node.id) && !visit.parentIds.some((id) => chosen.has(id)))
    .map((visit) => visit.node.id);
}

/** Arbre avec `folder` ajouté au rang et dans le parent de `anchorId` (haut de l'arbre si absent). */
export function addFolder(
  nodes: readonly LayerNode[],
  folder: IFolder,
  anchorId: string | undefined
): readonly LayerNode[] {
  const location = anchorId === undefined ? undefined : locateNode(nodes, anchorId);
  return insertNode(nodes, location?.parentId, location?.index ?? 0, folder);
}

/**
 * Arbre où les nœuds de plus haut niveau de `ids` sont rangés dans `folder`
 * (leurs enfants dans l'ordre d'affichage), le dossier prenant la place du
 * premier. Sans nœud à grouper, retourne `nodes`.
 */
export function groupNodes(
  nodes: readonly LayerNode[],
  ids: readonly string[],
  folder: IFolder
): readonly LayerNode[] {
  const top = topMostIds(nodes, ids);
  const first = top[0];
  const location = first === undefined ? undefined : locateNode(nodes, first);
  if (location === undefined) return nodes;
  const moved = top.map((id) => findNodeById(nodes, id)).filter((node): node is LayerNode => node !== undefined);
  const remaining = removeNodes(nodes, new Set(top));
  return insertNode(remaining, location.parentId, location.index, { ...folder, children: moved });
}

/** Arbre où le dossier `folderId` est remplacé, à sa place, par ses enfants. Sans dossier, retourne `nodes`. */
export function ungroupNode(nodes: readonly LayerNode[], folderId: string): readonly LayerNode[] {
  const target = findNodeById(nodes, folderId);
  const location = locateNode(nodes, folderId);
  if (target === undefined || !isFolder(target) || location === undefined) return nodes;
  return withChildren(nodes, location.parentId, (siblings) => [
    ...siblings.slice(0, location.index),
    ...target.children,
    ...siblings.slice(location.index + 1)
  ]);
}
