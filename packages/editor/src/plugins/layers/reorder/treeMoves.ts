// packages/editor/src/plugins/layers/reorder/treeMoves.ts
/**
 * Opérations génériques et pures de déplacement dans l'arbre des calques :
 * retrouver la place d'un nœud, ne garder que les nœuds « de tête », détacher
 * des nœuds par id, en insérer sous un parent à un index.
 *
 * Réutilisées par le déplacement (Y6), les groupes (Y7) et la barre d'outils
 * (Y8). Aucune ne modifie son entrée : elles recopient le chemin touché et
 * rendent la même référence quand rien ne change.
 */

import { findNodeById, isFolder } from '@werddomain/timeline-runtime';
import type { LayerNode } from '@werddomain/timeline-runtime';

/** Place d'un nœud dans l'arbre : son dossier parent (absent au premier niveau) et son index parmi ses frères. */
export interface NodeLocation {
  readonly parentId?: string;
  readonly index: number;
}

/** Résultat de `detachNodes` : l'arbre sans les nœuds, et les nœuds retirés dans l'ordre d'affichage. */
export interface DetachResult {
  readonly nodes: readonly LayerNode[];
  readonly detached: readonly LayerNode[];
}

function locate(nodes: readonly LayerNode[], id: string, parentId: string | undefined): NodeLocation | undefined {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node === undefined) continue;
    if (node.id === id) return parentId === undefined ? { index } : { parentId, index };
    if (!isFolder(node)) continue;
    const found = locate(node.children, id, node.id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Dossier parent et index du nœud `id`, ou `undefined` si l'id est inconnu. */
export function findNodeLocation(nodes: readonly LayerNode[], id: string): NodeLocation | undefined {
  return locate(nodes, id, undefined);
}

/**
 * Enfants du dossier `parentId`, ou `nodes` lui-même si `parentId` est absent.
 * `undefined` si `parentId` est inconnu ou désigne un calque.
 */
export function childrenOf(nodes: readonly LayerNode[], parentId: string | undefined): readonly LayerNode[] | undefined {
  if (parentId === undefined) return nodes;
  const parent = findNodeById(nodes, parentId);
  return parent !== undefined && isFolder(parent) ? parent.children : undefined;
}

/** Vrai si `descendantId` est le nœud `rootId` lui-même ou l'un de ses descendants. */
export function isSameOrDescendant(nodes: readonly LayerNode[], rootId: string, descendantId: string): boolean {
  const root = findNodeById(nodes, rootId);
  return root !== undefined && findNodeById([root], descendantId) !== undefined;
}

/**
 * Ids de tête de `ids` : ceux dont aucun ancêtre n'est aussi dans `ids`
 * (déplacer un dossier emporte déjà ses enfants), dans l'ordre d'affichage
 * de l'arbre. Les ids inconnus et les doublons disparaissent.
 */
export function topMostIds(nodes: readonly LayerNode[], ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  const result: string[] = [];
  const visit = (level: readonly LayerNode[]): void => {
    level.forEach((node) => {
      if (wanted.has(node.id)) result.push(node.id);
      else if (isFolder(node)) visit(node.children);
    });
  };
  visit(nodes);
  return result;
}

function detachIn(level: readonly LayerNode[], ids: ReadonlySet<string>, detached: LayerNode[]): readonly LayerNode[] {
  let changed = false;
  const kept: LayerNode[] = [];
  level.forEach((node) => {
    if (ids.has(node.id)) {
      detached.push(node);
      changed = true;
      return;
    }
    if (!isFolder(node)) {
      kept.push(node);
      return;
    }
    const children = detachIn(node.children, ids, detached);
    changed = changed || children !== node.children;
    kept.push(children === node.children ? node : { ...node, children });
  });
  return changed ? kept : level;
}

/**
 * Arbre sans les nœuds `ids`, et ces nœuds dans l'ordre d'affichage. On ne
 * descend pas dans un nœud retiré : un id imbriqué dans un autre id reste
 * dans son nœud (passer plutôt les ids de `topMostIds`). Retourne `nodes`
 * lui-même si aucun id n'est trouvé.
 */
export function detachNodes(nodes: readonly LayerNode[], ids: readonly string[]): DetachResult {
  const detached: LayerNode[] = [];
  const next = detachIn(nodes, new Set(ids), detached);
  return { nodes: next, detached };
}

function clampIndex(index: number, length: number): number {
  return Math.min(length, Math.max(0, Math.trunc(index)));
}

function spliceIn(level: readonly LayerNode[], index: number, inserted: readonly LayerNode[]): readonly LayerNode[] {
  const at = clampIndex(index, level.length);
  return [...level.slice(0, at), ...inserted, ...level.slice(at)];
}

function insertIn(
  level: readonly LayerNode[],
  parentId: string,
  index: number,
  inserted: readonly LayerNode[]
): readonly LayerNode[] {
  let changed = false;
  const next = level.map((node) => {
    if (!isFolder(node)) return node;
    const children =
      node.id === parentId ? spliceIn(node.children, index, inserted) : insertIn(node.children, parentId, index, inserted);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : level;
}

/**
 * Arbre où `inserted` est placé sous `parentId` (premier niveau si absent) à
 * `index` (borné à la longueur de la liste). Retourne `nodes` lui-même si
 * `inserted` est vide ou si le dossier parent est inconnu.
 */
export function insertNodes(
  nodes: readonly LayerNode[],
  parentId: string | undefined,
  index: number,
  inserted: readonly LayerNode[]
): readonly LayerNode[] {
  if (inserted.length === 0) return nodes;
  return parentId === undefined ? spliceIn(nodes, index, inserted) : insertIn(nodes, parentId, index, inserted);
}

/** Vrai si les deux arbres ont les mêmes ids, dans le même ordre et sous les mêmes dossiers. */
export function sameArrangement(a: readonly LayerNode[], b: readonly LayerNode[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((node, position) => {
    const other = b[position];
    if (other === undefined || node.id !== other.id) return false;
    if (!isFolder(node) || !isFolder(other)) return isFolder(node) === isFolder(other);
    return sameArrangement(node.children, other.children);
  });
}
