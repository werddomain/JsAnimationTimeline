// packages/editor/src/plugins/layers/list/layerRows.ts
/**
 * Lignes de la liste des calques : les lignes visibles du modèle partagé
 * (`visibleRows`, Y0), complétées par leur nœud et le verrou hérité.
 * Fonctions pures.
 */

import { isFolder, resolveLocked } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { visibleRows } from '../../../model/rows';
import type { ILayerRow } from './types';

interface INodeInfo {
  readonly node: LayerNode;
  readonly lockedByAncestor: boolean;
}

function indexNodes(nodes: readonly LayerNode[], lockedAbove: boolean, into: Map<string, INodeInfo>): void {
  for (const node of nodes) {
    const locked = lockedAbove || resolveLocked(node);
    into.set(node.id, { node, lockedByAncestor: locked });
    if (isFolder(node)) indexNodes(node.children, locked, into);
  }
}

/** Lignes affichées de `doc`, en ordre d'affichage, avec leur nœud. */
export function layerRows(doc: ITimelineDocument): readonly ILayerRow[] {
  const infos = new Map<string, INodeInfo>();
  indexNodes(doc.layers, false, infos);
  return visibleRows(doc).map((row) => {
    const info = infos.get(row.id);
    if (info === undefined) throw new Error(`layers.list : nœud « ${row.id} » absent du document.`);
    return { ...row, node: info.node, lockedByAncestor: info.lockedByAncestor };
  });
}

/** Vrai si les deux listes ont les mêmes lignes au même endroit (id, type, profondeur, parent, index). */
export function sameRowLayout(a: readonly ILayerRow[], b: readonly ILayerRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      row.id === other.id &&
      row.kind === other.kind &&
      row.depth === other.depth &&
      row.parentId === other.parentId &&
      row.index === other.index
    );
  });
}
