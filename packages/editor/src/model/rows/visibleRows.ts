// packages/editor/src/model/rows/visibleRows.ts
/**
 * Modèle des lignes visibles : la liste des calques et la grille des images
 * affichent les mêmes lignes, dans le même ordre. `visibleRows(doc)` est une
 * fonction pure : parcours en profondeur de l'arbre (un dossier, puis ses
 * enfants), sans les descendants d'un dossier replié.
 */

import { isFolder, resolveCollapsed, walkLayers } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument, LayerNodeType } from '@kazo-ca/timeline-runtime';

/** Une ligne affichée (calque ou dossier). */
export interface INodeVisibleRow {
  /** Id du calque ou du dossier. */
  readonly id: string;
  readonly kind: LayerNodeType;
  /** Profondeur d'imbrication, 0 au premier niveau. */
  readonly depth: number;
  /** Id du dossier parent ; absent au premier niveau. */
  readonly parentId?: string;
  /** Position de la ligne dans la liste visible (0 en haut) : `top = index * ROW_HEIGHT`. */
  readonly index: number;
  /** Presentation state, present only for layers with nonempty property tracks. */
  readonly propertiesExpanded?: boolean;
}

/** A property row has its own opaque identity; never pass its id to a layer command. */
export interface IPropertyVisibleRow {
  readonly id: string;
  readonly kind: 'property';
  readonly layerId: string;
  readonly property: string;
  readonly parentId: string;
  readonly depth: number;
  readonly index: number;
}

export type IVisibleRow = INodeVisibleRow | IPropertyVisibleRow;

/** Lignes visibles de `doc`, en ordre d'affichage. */
export function visibleRows(doc: ITimelineDocument, expanded: ReadonlySet<string> = new Set()): readonly IVisibleRow[] {
  const rows: IVisibleRow[] = [];
  const usedIds = new Set<string>();
  walkLayers(doc.layers, ({ node }) => void usedIds.add(node.id));
  walkLayers(doc.layers, ({ node, parentIds, depth }) => {
    const parentId = parentIds[parentIds.length - 1];
    const properties = node.type === 'layer'
      ? Object.entries(node.propertyTimelines ?? {}).filter(([, track]) => track.keys.length > 0).map(([name]) => name)
      : [];
    rows.push({
      id: node.id,
      kind: node.type,
      depth,
      ...(parentId === undefined ? {} : { parentId }),
      index: rows.length,
      ...(properties.length > 0 ? { propertiesExpanded: expanded.has(node.id) } : {})
    });
    if (expanded.has(node.id)) {
      for (const property of properties) {
        // JSON tuple encoding is unambiguous for arbitrary punctuation/Unicode. Reserve
        // every node id as well, including hidden nodes; callers resolve rows, never parse ids.
        let id = `@property:${JSON.stringify([node.id, property])}`;
        while (usedIds.has(id)) id = `@${id}`;
        usedIds.add(id);
        rows.push({ id, kind: 'property', layerId: node.id, property, parentId: node.id, depth: depth + 1, index: rows.length });
      }
    }
    return isFolder(node) && resolveCollapsed(node) ? false : undefined;
  });
  return rows;
}
