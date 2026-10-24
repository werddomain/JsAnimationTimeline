// packages/editor/src/plugins/layers/list/layerRows.ts
/**
 * Lignes de la liste des calques : les lignes visibles du modèle partagé
 * (`visibleRows`, Y0), complétées par leur nœud et le verrou hérité.
 * Fonctions pures.
 */

import { isFolder, resolveLocked } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { visibleRows } from '../../../model/rows';
import type { IVisibleRow } from '../../../model/rows';
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

function sameRow(row: ILayerRow, visible: IVisibleRow, info: INodeInfo): boolean {
  return (
    row.node === info.node &&
    row.lockedByAncestor === info.lockedByAncestor &&
    row.kind === visible.kind &&
    row.depth === visible.depth &&
    row.parentId === visible.parentId &&
    row.index === visible.index
  );
}

/**
 * Lignes affichées de `doc`, en ordre d'affichage, avec leur nœud. Une ligne
 * de `previous` identique (même nœud, même place, même verrou) est reprise
 * telle quelle : `===` suffit pour savoir qu'une ligne n'a pas changé.
 */
export function layerRows(doc: ITimelineDocument, previous: readonly ILayerRow[] = []): readonly ILayerRow[] {
  const infos = new Map<string, INodeInfo>();
  indexNodes(doc.layers, false, infos);
  const before = new Map(previous.map((row) => [row.id, row]));
  return visibleRows(doc).map((visible) => {
    const info = infos.get(visible.id);
    if (info === undefined) throw new Error(`layers.list : nœud « ${visible.id} » absent du document.`);
    const old = before.get(visible.id);
    if (old !== undefined && sameRow(old, visible, info)) return old;
    return { ...visible, node: info.node, lockedByAncestor: info.lockedByAncestor };
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
