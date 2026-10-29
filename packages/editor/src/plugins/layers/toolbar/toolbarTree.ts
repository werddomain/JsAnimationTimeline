// packages/editor/src/plugins/layers/toolbar/toolbarTree.ts
/**
 * Opérations pures de `layers.toolbar` sur l'arbre des calques : nom et id
 * d'un nouveau calque, insertion, et choix de la ligne à sélectionner après
 * une suppression. Elles s'appuient sur les aides de `layers.groups`
 * (numérotation, emplacement, insertion) et ne modifient jamais leur entrée
 * (le document est figé).
 */

import { flattenLayers } from '@kazo-ca/timeline-runtime';
import type { ILayer, LayerNode } from '@kazo-ca/timeline-runtime';
import { allIds, insertNode, locateNode, numbersWithPrefix, smallestFree } from '../groups/groupsTree';

/** Préfixe des noms de calque créés par l'éditeur (« Calque 1 »). */
export const LAYER_NAME_PREFIX = 'Calque';

/** Préfixe des ids de calque créés par l'éditeur (`layer-1`). */
export const LAYER_ID_PREFIX = 'layer-';

/** Nom « Calque N », N étant le plus petit numéro non utilisé par un nom de l'arbre. */
export function nextLayerName(nodes: readonly LayerNode[]): string {
  const names = flattenLayers(nodes).map((visit) => visit.node.name);
  return `${LAYER_NAME_PREFIX} ${smallestFree(numbersWithPrefix(names, `${LAYER_NAME_PREFIX} `))}`;
}

/** Id `layer-N`, N étant le plus petit numéro non utilisé par un id de l'arbre, plages comprises (déterministe). */
export function nextLayerId(nodes: readonly LayerNode[]): string {
  const ids = allIds(nodes);
  return `${LAYER_ID_PREFIX}${smallestFree(numbersWithPrefix(ids, LAYER_ID_PREFIX))}`;
}

/** Nouveau calque vide, sans cible, nommé et identifié sans collision dans `nodes`. */
export function newLayer(nodes: readonly LayerNode[]): ILayer {
  return { id: nextLayerId(nodes), type: 'layer', name: nextLayerName(nodes), spans: [] };
}

/** Arbre avec `layer` ajouté au rang et dans le parent de `anchorId` (haut de l'arbre si absent). */
export function addLayer(
  nodes: readonly LayerNode[],
  layer: ILayer,
  anchorId: string | undefined
): readonly LayerNode[] {
  const location = anchorId === undefined ? undefined : locateNode(nodes, anchorId);
  return insertNode(nodes, location?.parentId, location?.index ?? 0, layer);
}

/**
 * Id de la ligne à sélectionner après une suppression : celle qui a pris le
 * rang de la première ligne supprimée (ou, à défaut, la dernière restante) ;
 * `undefined` s'il ne reste aucune ligne ou si aucune ligne visible n'a été
 * supprimée (la sélection ne bouge pas). Les lignes supprimées sont celles de
 * `before` qui ne sont plus dans `after` (sous-arbres compris).
 */
export function rowAfterDelete(before: readonly string[], after: readonly string[]): string | undefined {
  if (after.length === 0) return undefined;
  const remaining = new Set(after);
  const firstRemoved = before.findIndex((id) => !remaining.has(id));
  if (firstRemoved === -1) return undefined;
  const kept = before.slice(0, firstRemoved).filter((id) => remaining.has(id)).length;
  return after[Math.min(kept, after.length - 1)];
}
