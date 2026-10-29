// packages/runtime/src/model/traverse.ts
/**
 * Parcours en profondeur de l'arbre des calques (ordre d'affichage :
 * un dossier, puis ses enfants), avec les ids des dossiers parents.
 */

import { isFolder } from './guards';
import type { LayerNode } from './layer';

/** One node reached by a traversal. */
export interface ILayerNodeVisit {
  readonly node: LayerNode;
  /** Ids of the ancestor folders, outermost first (empty at top level). */
  readonly parentIds: readonly string[];
  /** Nesting depth, 0 at top level (= parentIds.length). */
  readonly depth: number;
  /** Index of the node in its parent's list. */
  readonly index: number;
  /** JSON-pointer-like path from the document root, e.g. `/layers/0/children/2`. */
  readonly pointer: string;
}

/** Return `false` to skip the children of the visited folder. */
export type LayerVisitor = (visit: ILayerNodeVisit) => void | false;

function walkLevel(
  nodes: readonly LayerNode[],
  parentIds: readonly string[],
  basePointer: string,
  visitor: LayerVisitor
): void {
  nodes.forEach((node, index) => {
    const pointer = `${basePointer}/${index}`;
    const skipChildren = visitor({ node, parentIds, depth: parentIds.length, index, pointer }) === false;
    if (isFolder(node) && !skipChildren) {
      walkLevel(node.children, [...parentIds, node.id], `${pointer}/children`, visitor);
    }
  });
}

/** Visits every node depth-first; `nodes` is the document's `layers`. */
export function walkLayers(nodes: readonly LayerNode[], visitor: LayerVisitor): void {
  walkLevel(nodes, [], '/layers', visitor);
}

/** All nodes depth-first, in display order. */
export function flattenLayers(nodes: readonly LayerNode[]): ILayerNodeVisit[] {
  const visits: ILayerNodeVisit[] = [];
  walkLayers(nodes, (visit) => {
    visits.push(visit);
  });
  return visits;
}

/** Finds a layer or folder by id anywhere in the tree. */
export function findNodeById(nodes: readonly LayerNode[], id: string): LayerNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (isFolder(node)) {
      const found = findNodeById(node.children, id);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}
