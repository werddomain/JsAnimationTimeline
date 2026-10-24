// packages/editor/src/plugins/layers/selection/selectionView.ts
/**
 * Rendu de la sélection sur les éléments de `layers.list` : classe et
 * `aria-selected` des lignes, `tabindex` itinérant (la ligne qui a le focus
 * clavier est tabulable, les autres non) et `aria-multiselectable` de la
 * liste. Les éléments des lignes viennent de `rowElement`.
 */

import type { ILayerListService } from '../list';
import type { SelectionState } from './selectionModel';

/** Classe posée sur les lignes sélectionnées. */
export const SELECTED_ROW_CLASS = 'jt-layer-row--selected';

/**
 * Ligne tabulable : celle qui a le focus clavier ; sans focus, la première
 * ligne. `undefined` s'il n'y a aucune ligne.
 */
export function tabbableRowId(state: SelectionState, rowIds: readonly string[]): string | undefined {
  const focused = state.focused;
  return focused !== undefined && rowIds.includes(focused) ? focused : rowIds[0];
}

/** Pose classe, `aria-selected` et `tabindex` sur chaque ligne affichée. */
export function paintRows(list: ILayerListService, state: SelectionState): void {
  const rowIds = list.rows().map((row) => row.id);
  const tabbable = tabbableRowId(state, rowIds);
  for (const id of rowIds) {
    const element = list.rowElement(id);
    if (element === undefined) continue;
    const selected = state.ids.has(id);
    element.classList.toggle(SELECTED_ROW_CLASS, selected);
    element.setAttribute('aria-selected', String(selected));
    element.tabIndex = id === tabbable ? 0 : -1;
  }
}

/** Marque la liste comme à sélection multiple. */
export function paintList(element: HTMLElement): void {
  element.setAttribute('aria-multiselectable', 'true');
}

/** Retire tout ce que `paintRows` et `paintList` ont posé (destruction du plugin). */
export function unpaint(list: ILayerListService): void {
  list.element()?.removeAttribute('aria-multiselectable');
  for (const row of list.rows()) {
    const element = list.rowElement(row.id);
    if (element === undefined) continue;
    element.classList.remove(SELECTED_ROW_CLASS);
    element.removeAttribute('aria-selected');
    element.removeAttribute('tabindex');
  }
}
