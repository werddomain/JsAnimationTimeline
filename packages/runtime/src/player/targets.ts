// packages/runtime/src/player/targets.ts
/**
 * Résolution de la cible d'un calque : sélecteur CSS cherché dans `root`,
 * ou élément passé directement.
 */

import { isElementTarget, isSelectorTarget } from '../model/guards';
import type { ILayer } from '../model/layer';

/**
 * Element animated by `layer`, or `null` when the layer has no target or its
 * selector matches nothing. Throws for a syntactically invalid selector.
 */
export function resolveTarget(layer: ILayer, root: ParentNode): Element | null {
  if (isElementTarget(layer.target)) {
    return layer.target.element;
  }
  if (isSelectorTarget(layer.target)) {
    try {
      return root.querySelector(layer.target.selector);
    } catch {
      throw new Error(`Layer "${layer.id}" has an invalid selector "${layer.target.selector}".`);
    }
  }
  return null;
}
