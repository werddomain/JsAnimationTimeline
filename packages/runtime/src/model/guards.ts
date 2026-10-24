// packages/runtime/src/model/guards.ts
/**
 * Gardes de type pour les unions du modèle (nœuds et cibles).
 */

import type { IFolder, ILayer, LayerNode } from './layer';
import type { IElementTarget, IRefTarget, ISelectorTarget, LayerTarget } from './target';

export function isLayer(node: LayerNode): node is ILayer {
  return node.type === 'layer';
}

export function isFolder(node: LayerNode): node is IFolder {
  return node.type === 'folder';
}

export function isSelectorTarget(target: LayerTarget | undefined): target is ISelectorTarget {
  return target !== undefined && 'selector' in target;
}

export function isRefTarget(target: LayerTarget | undefined): target is IRefTarget {
  return target !== undefined && 'ref' in target;
}

export function isElementTarget(target: LayerTarget | undefined): target is IElementTarget {
  return target !== undefined && 'element' in target;
}
