// packages/editor/src/model/rows/visibleRows.ts
/**
 * Modèle des lignes visibles : la liste des calques et la grille des images
 * affichent les mêmes lignes, dans le même ordre. `visibleRows(doc)` est une
 * fonction pure : parcours en profondeur de l'arbre (un dossier, puis ses
 * enfants), sans les descendants d'un dossier replié.
 */

import { isFolder, resolveCollapsed, walkLayers } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, LayerNodeType } from '@werddomain/timeline-runtime';

/** Une ligne affichée (calque ou dossier). */
export interface IVisibleRow {
  /** Id du calque ou du dossier. */
  readonly id: string;
  readonly kind: LayerNodeType;
  /** Profondeur d'imbrication, 0 au premier niveau. */
  readonly depth: number;
  /** Id du dossier parent ; absent au premier niveau. */
  readonly parentId?: string;
  /** Position de la ligne dans la liste visible (0 en haut) : `top = index * ROW_HEIGHT`. */
  readonly index: number;
}

/** Lignes visibles de `doc`, en ordre d'affichage. */
export function visibleRows(doc: ITimelineDocument): IVisibleRow[] {
  const rows: IVisibleRow[] = [];
  walkLayers(doc.layers, ({ node, parentIds, depth }) => {
    const parentId = parentIds[parentIds.length - 1];
    rows.push({
      id: node.id,
      kind: node.type,
      depth,
      ...(parentId === undefined ? {} : { parentId }),
      index: rows.length
    });
    return isFolder(node) && resolveCollapsed(node) ? false : undefined;
  });
  return rows;
}
