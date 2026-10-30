// packages/editor/src/plugins/layers/list/layerRows.ts
/**
 * Lignes de la liste des calques : les lignes visibles du modèle partagé
 * (`visibleRows`, Y0), complétées par leur nœud, le verrou et le masquage hérités.
 * Fonctions pures.
 */

import { isFolder, resolveLocked, resolveVisible } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { visibleRows } from '../../../model/rows';
import type { IVisibleRow, INodeVisibleRow } from '../../../model/rows';
import type { ILayerRow } from './types';

interface INodeInfo {
  readonly node: LayerNode;
  readonly lockedByAncestor: boolean;
  readonly hiddenByAncestor: boolean;
}

function indexNodes(
  nodes: readonly LayerNode[],
  above: { readonly locked: boolean; readonly hidden: boolean },
  into: Map<string, INodeInfo>
): void {
  for (const node of nodes) {
    const locked = above.locked || resolveLocked(node);
    const hidden = above.hidden || !resolveVisible(node);
    into.set(node.id, { node, lockedByAncestor: locked, hiddenByAncestor: hidden });
    if (isFolder(node)) indexNodes(node.children, { locked, hidden }, into);
  }
}

function sameRow(row: ILayerRow, visible: INodeVisibleRow, info: INodeInfo): boolean {
  return (
    row.node === info.node &&
    row.lockedByAncestor === info.lockedByAncestor &&
    row.hiddenByAncestor === info.hiddenByAncestor &&
    row.kind === visible.kind &&
    row.depth === visible.depth &&
    row.parentId === visible.parentId &&
    row.propertiesExpanded === visible.propertiesExpanded &&
    row.index === visible.index
  );
}

/**
 * Lignes affichées de `doc`, en ordre d'affichage, avec leur nœud. Une ligne
 * de `previous` identique (même nœud, même place, même verrou) est reprise
 * telle quelle : `===` suffit pour savoir qu'une ligne n'a pas changé.
 */
export function layerRows(doc: ITimelineDocument, previous: readonly ILayerRow[] = [], projected: readonly IVisibleRow[] = visibleRows(doc)): readonly ILayerRow[] {
  const infos = new Map<string, INodeInfo>();
  indexNodes(doc.layers, { locked: false, hidden: false }, infos);
  const before = new Map(previous.map((row) => [row.id, row]));
  return projected.filter((row): row is INodeVisibleRow => row.kind !== 'property').map((visible) => {
    const info = infos.get(visible.id);
    if (info === undefined) throw new Error(`layers.list : nœud « ${visible.id} » absent du document.`);
    const old = before.get(visible.id);
    if (old !== undefined && sameRow(old, visible, info)) return old;
    return {
      ...visible,
      node: info.node,
      lockedByAncestor: info.lockedByAncestor,
      hiddenByAncestor: info.hiddenByAncestor
    };
  });
}

/** Vrai si les deux listes ont les mêmes lignes au même endroit (id, type, profondeur, parent, index). */
export function sameRowLayout(a: readonly IVisibleRow[], b: readonly IVisibleRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      row.id === other.id &&
      row.kind === other.kind &&
      row.depth === other.depth &&
      row.parentId === other.parentId &&
      (row.kind === 'property' || other.kind === 'property' || row.propertiesExpanded === other.propertiesExpanded) &&
      row.index === other.index
    );
  });
}
