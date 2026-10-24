// packages/editor/src/plugins/layers/selection/selectionModel.ts
/**
 * Modèle de la sélection des calques : état immuable et fonctions pures.
 *
 * Toutes les fonctions reçoivent l'ordre d'affichage (`rowIds`, les lignes
 * visibles) et retournent un nouvel état ; l'état d'entrée n'est jamais
 * modifié. Invariant après chaque opération : les ids sélectionnés sont des
 * lignes visibles ; l'ancre et le focus, s'ils existent, aussi.
 */

import type { SelectionMode } from './types';

/** État de la sélection : ensemble des ids, ancre (plages) et focus (clavier). */
export interface SelectionState {
  readonly ids: ReadonlySet<string>;
  readonly anchor: string | undefined;
  readonly focused: string | undefined;
}

/** Ligne minimale pour l'élagage : son id et celui de son dossier parent. */
export interface SelectionRowRef {
  readonly id: string;
  readonly parentId?: string;
}

/** Sélection vide, sans ancre ni focus. */
export const EMPTY_SELECTION: SelectionState = Object.freeze({
  ids: new Set<string>(),
  anchor: undefined,
  focused: undefined
});

/** Ids de `state`, dans l'ordre d'affichage `rowIds` (les ids hors des lignes sont ignorés). */
export function orderedIds(state: SelectionState, rowIds: readonly string[]): readonly string[] {
  return rowIds.filter((id) => state.ids.has(id));
}

/** Vrai si les deux états ont les mêmes ids (sans tenir compte de l'ordre), la même ancre et le même focus. */
export function sameSelection(a: SelectionState, b: SelectionState): boolean {
  if (a.anchor !== b.anchor || a.focused !== b.focused || a.ids.size !== b.ids.size) return false;
  for (const id of a.ids) if (!b.ids.has(id)) return false;
  return true;
}

/** Ids de `ids` qui sont des lignes visibles, sans doublon, dans l'ordre donné. */
function visibleIds(rowIds: readonly string[], ids: readonly string[]): string[] {
  const visible = new Set(rowIds);
  return Array.from(new Set(ids)).filter((id) => visible.has(id));
}

function combine(current: ReadonlySet<string>, ids: readonly string[], mode: SelectionMode): Set<string> {
  if (mode === 'replace') return new Set(ids);
  const next = new Set(current);
  for (const id of ids) {
    if (mode === 'toggle' && next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}

/**
 * Sélectionne `ids` selon `mode`. L'ancre et le focus vont sur le dernier id
 * valide (même quand `toggle` le désélectionne). Sans id valide, `add` et
 * `toggle` ne changent rien et `replace` vide la sélection et l'ancre.
 */
export function selectIds(
  state: SelectionState,
  rowIds: readonly string[],
  ids: readonly string[],
  mode: SelectionMode = 'replace'
): SelectionState {
  const valid = visibleIds(rowIds, ids);
  const last = valid[valid.length - 1];
  if (last === undefined) {
    return mode === 'replace' ? { ids: new Set(), anchor: undefined, focused: state.focused } : state;
  }
  return { ids: combine(state.ids, valid, mode), anchor: last, focused: last };
}

/**
 * Sélectionne les lignes de `fromId` à `toId` incluses, dans un sens ou
 * l'autre. L'ancre va sur `fromId`, le focus sur `toId`. Retourne `state`
 * tel quel si l'un des deux n'est pas une ligne visible.
 */
export function selectRangeIds(
  state: SelectionState,
  rowIds: readonly string[],
  fromId: string,
  toId: string,
  additive = false
): SelectionState {
  const from = rowIds.indexOf(fromId);
  const to = rowIds.indexOf(toId);
  if (from < 0 || to < 0) return state;
  const range = rowIds.slice(Math.min(from, to), Math.max(from, to) + 1);
  return { ids: combine(state.ids, range, additive ? 'add' : 'replace'), anchor: fromId, focused: toId };
}

/** Sélectionne toutes les lignes ; l'ancre et le focus restent s'ils sont valides, sinon ils vont sur la première ligne. */
export function selectAllIds(state: SelectionState, rowIds: readonly string[]): SelectionState {
  const first = rowIds[0];
  if (first === undefined) return selectIds(state, rowIds, [], 'replace');
  const keep = (id: string | undefined): string => (id !== undefined && rowIds.includes(id) ? id : first);
  return { ids: new Set(rowIds), anchor: keep(state.anchor), focused: keep(state.focused) };
}

/** Vide la sélection et l'ancre ; le focus clavier reste. */
export function clearSelection(state: SelectionState): SelectionState {
  if (state.ids.size === 0 && state.anchor === undefined) return state;
  return { ids: new Set(), anchor: undefined, focused: state.focused };
}

/** Déplace le focus sur `id` sans toucher à la sélection ni à l'ancre ; sans effet si `id` n'est pas visible. */
export function focusRow(state: SelectionState, rowIds: readonly string[], id: string): SelectionState {
  if (!rowIds.includes(id) || state.focused === id) return state;
  return { ...state, focused: id };
}

function nearestVisibleAncestor(
  id: string,
  previous: readonly SelectionRowRef[],
  visible: ReadonlySet<string>
): string | undefined {
  const parents = new Map(previous.map((row) => [row.id, row.parentId]));
  const seen = new Set<string>();
  let current = parents.get(id);
  while (current !== undefined && !seen.has(current)) {
    if (visible.has(current)) return current;
    seen.add(current);
    current = parents.get(current);
  }
  return undefined;
}

/**
 * Ligne qui remplace `id` quand elle n'est plus affichée. Si le nœud existe
 * encore (il est caché dans un dossier replié), c'est son plus proche
 * ancêtre visible, d'après les lignes d'avant ; sinon (supprimé), ou sans
 * ancêtre visible, la ligne voisine d'avant qui reste (la suivante d'abord).
 * `undefined` s'il ne reste aucune ligne.
 */
export function nearestRemaining(
  id: string,
  previous: readonly SelectionRowRef[],
  rowIds: readonly string[],
  exists: (id: string) => boolean
): string | undefined {
  const visible = new Set(rowIds);
  if (visible.has(id)) return id;
  if (exists(id)) {
    const ancestor = nearestVisibleAncestor(id, previous, visible);
    if (ancestor !== undefined) return ancestor;
  }
  const index = previous.findIndex((row) => row.id === id);
  if (index < 0) return rowIds[0];
  for (let distance = 1; distance < previous.length; distance += 1) {
    const after = previous[index + distance]?.id;
    if (after !== undefined && visible.has(after)) return after;
    const before = previous[index - distance]?.id;
    if (before !== undefined && visible.has(before)) return before;
  }
  return rowIds[0];
}

/**
 * Retire de la sélection les ids qui ne sont plus des lignes visibles
 * (supprimés ou cachés par un dossier replié), et remet l'ancre et le focus
 * sur la ligne restante la plus proche (`nearestRemaining`). Retourne
 * `state` tel quel si rien ne change.
 */
export function pruneSelection(
  state: SelectionState,
  previous: readonly SelectionRowRef[],
  rows: readonly SelectionRowRef[],
  exists: (id: string) => boolean
): SelectionState {
  const rowIds = rows.map((row) => row.id);
  const visible = new Set(rowIds);
  const ids = new Set(Array.from(state.ids).filter((id) => visible.has(id)));
  const fix = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : nearestRemaining(id, previous, rowIds, exists);
  const next: SelectionState = { ids, anchor: fix(state.anchor), focused: fix(state.focused) };
  return sameSelection(state, next) ? state : next;
}
