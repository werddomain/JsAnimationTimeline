// packages/editor/src/plugins/layers/selection/__tests__/selectionModel.test.ts
/**
 * Modèle pur de la sélection : modes de `select`, plages, tout sélectionner,
 * vider, focus seul, plus proche ligne restante et élagage.
 */

import {
  EMPTY_SELECTION,
  clearSelection,
  focusRow,
  nearestRemaining,
  orderedIds,
  pruneSelection,
  sameSelection,
  selectAllIds,
  selectIds,
  selectRangeIds
} from '../selectionModel';
import type { SelectionRowRef, SelectionState } from '../selectionModel';

const ROWS = ['a', 'b', 'c', 'd', 'e'];

function state(ids: readonly string[], anchor?: string, focused?: string): SelectionState {
  return { ids: new Set(ids), anchor, focused };
}

function ids(value: SelectionState): string[] {
  return orderedIds(value, ROWS) as string[];
}

describe('selectIds', () => {
  it('replaces the selection and moves anchor and focus to the last id', () => {
    const next = selectIds(state(['a'], 'a', 'a'), ROWS, ['c', 'b'], 'replace');
    expect(ids(next)).toEqual(['b', 'c']);
    expect(next.anchor).toBe('b');
    expect(next.focused).toBe('b');
  });

  it('defaults to replace', () => {
    expect(ids(selectIds(state(['a']), ROWS, ['d']))).toEqual(['d']);
  });

  it('adds to the selection', () => {
    expect(ids(selectIds(state(['a'], 'a', 'a'), ROWS, ['c'], 'add'))).toEqual(['a', 'c']);
  });

  it('toggles each id and still moves the anchor when the id is deselected', () => {
    const next = selectIds(state(['a', 'c'], 'a', 'a'), ROWS, ['c', 'd'], 'toggle');
    expect(ids(next)).toEqual(['a', 'd']);
    expect(next.anchor).toBe('d');
    const off = selectIds(next, ROWS, ['a'], 'toggle');
    expect(ids(off)).toEqual(['d']);
    expect(off.anchor).toBe('a');
  });

  it('ignores ids that are not visible rows and duplicates', () => {
    const next = selectIds(EMPTY_SELECTION, ROWS, ['zz', 'b', 'b'], 'toggle');
    expect(ids(next)).toEqual(['b']);
    expect(next.anchor).toBe('b');
  });

  it('keeps the state for add and toggle without any valid id', () => {
    const before = state(['a'], 'a', 'a');
    expect(selectIds(before, ROWS, ['zz'], 'add')).toBe(before);
    expect(selectIds(before, ROWS, [], 'toggle')).toBe(before);
  });

  it('clears the selection and the anchor on replace without valid id, keeping the focus', () => {
    const next = selectIds(state(['a'], 'a', 'b'), ROWS, ['zz'], 'replace');
    expect(next.ids.size).toBe(0);
    expect(next.anchor).toBeUndefined();
    expect(next.focused).toBe('b');
  });

  it('does not mutate the input state', () => {
    const before = state(['a'], 'a', 'a');
    selectIds(before, ROWS, ['b'], 'add');
    expect(Array.from(before.ids)).toEqual(['a']);
  });
});

describe('selectRangeIds', () => {
  it('selects from the anchor to the target, inclusive, in either direction', () => {
    const down = selectRangeIds(EMPTY_SELECTION, ROWS, 'b', 'd');
    expect(ids(down)).toEqual(['b', 'c', 'd']);
    expect(down.anchor).toBe('b');
    expect(down.focused).toBe('d');
    const up = selectRangeIds(EMPTY_SELECTION, ROWS, 'd', 'b');
    expect(ids(up)).toEqual(['b', 'c', 'd']);
    expect(up.anchor).toBe('d');
    expect(up.focused).toBe('b');
  });

  it('replaces the selection unless additive', () => {
    const before = state(['a'], 'a', 'a');
    expect(ids(selectRangeIds(before, ROWS, 'c', 'd'))).toEqual(['c', 'd']);
    expect(ids(selectRangeIds(before, ROWS, 'c', 'd', true))).toEqual(['a', 'c', 'd']);
  });

  it('selects a single row when both ends are the same', () => {
    expect(ids(selectRangeIds(EMPTY_SELECTION, ROWS, 'c', 'c'))).toEqual(['c']);
  });

  it('does nothing when an end is not a visible row', () => {
    const before = state(['a'], 'a', 'a');
    expect(selectRangeIds(before, ROWS, 'zz', 'c')).toBe(before);
    expect(selectRangeIds(before, ROWS, 'a', 'zz')).toBe(before);
  });
});

describe('selectAllIds, clearSelection, focusRow', () => {
  it('selects every row and keeps a valid anchor and focus', () => {
    const next = selectAllIds(state(['b'], 'b', 'c'), ROWS);
    expect(ids(next)).toEqual(ROWS);
    expect(next.anchor).toBe('b');
    expect(next.focused).toBe('c');
  });

  it('puts the anchor and focus on the first row when there are none', () => {
    const next = selectAllIds(EMPTY_SELECTION, ROWS);
    expect(next.anchor).toBe('a');
    expect(next.focused).toBe('a');
  });

  it('selects nothing when there is no row', () => {
    expect(selectAllIds(state([], undefined, 'x'), []).ids.size).toBe(0);
  });

  it('clears ids and anchor but keeps the focus; returns the same state when already empty', () => {
    const next = clearSelection(state(['a', 'b'], 'a', 'b'));
    expect(next.ids.size).toBe(0);
    expect(next.anchor).toBeUndefined();
    expect(next.focused).toBe('b');
    const empty = state([], undefined, 'b');
    expect(clearSelection(empty)).toBe(empty);
  });

  it('moves only the focus, and only to a visible row', () => {
    const before = state(['a'], 'a', 'a');
    const next = focusRow(before, ROWS, 'c');
    expect(next.focused).toBe('c');
    expect(next.anchor).toBe('a');
    expect(ids(next)).toEqual(['a']);
    expect(focusRow(before, ROWS, 'zz')).toBe(before);
    expect(focusRow(before, ROWS, 'a')).toBe(before);
  });
});

describe('sameSelection', () => {
  it('compares the set regardless of order, plus anchor and focus', () => {
    expect(sameSelection(state(['a', 'b'], 'a', 'b'), state(['b', 'a'], 'a', 'b'))).toBe(true);
    expect(sameSelection(state(['a']), state(['a', 'b']))).toBe(false);
    expect(sameSelection(state(['a'], 'a'), state(['a'], 'b'))).toBe(false);
    expect(sameSelection(state(['a'], 'a', 'a'), state(['a'], 'a', 'b'))).toBe(false);
    expect(sameSelection(state(['a'], 'a'), state(['b'], 'a'))).toBe(false);
  });
});

/** Arbre : f(a, g(b)), c ; lignes d'avant avec leurs parents. */
const BEFORE: readonly SelectionRowRef[] = [
  { id: 'f' },
  { id: 'a', parentId: 'f' },
  { id: 'g', parentId: 'f' },
  { id: 'b', parentId: 'g' },
  { id: 'c' }
];

describe('nearestRemaining', () => {
  const everything = (): boolean => true;
  const nothing = (): boolean => false;

  it('keeps an id that is still visible', () => {
    expect(nearestRemaining('c', BEFORE, ['f', 'c'], everything)).toBe('c');
  });

  it('goes to the nearest visible ancestor of a node hidden by a collapsed folder', () => {
    expect(nearestRemaining('b', BEFORE, ['f', 'c'], everything)).toBe('f');
    expect(nearestRemaining('b', BEFORE, ['f', 'a', 'g', 'c'], everything)).toBe('g');
  });

  it('goes to the next row, then the previous, for a deleted node', () => {
    expect(nearestRemaining('a', BEFORE, ['f', 'g', 'b', 'c'], nothing)).toBe('g');
    expect(nearestRemaining('c', BEFORE, ['f', 'a', 'g', 'b'], nothing)).toBe('b');
  });

  it('goes to the next row for a deleted node even when its parent remains', () => {
    expect(nearestRemaining('b', BEFORE, ['f', 'a', 'g', 'c'], nothing)).toBe('c');
  });

  it('falls back to the first row for an unknown id, and to undefined without rows', () => {
    expect(nearestRemaining('zz', BEFORE, ['f', 'c'], nothing)).toBe('f');
    expect(nearestRemaining('a', BEFORE, [], nothing)).toBeUndefined();
  });

  it('does not loop on a parent cycle', () => {
    const cycle: SelectionRowRef[] = [
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
      { id: 'z' }
    ];
    expect(nearestRemaining('x', cycle, ['z'], everything)).toBe('z');
  });
});

describe('pruneSelection', () => {
  const exists = (id: string): boolean => id !== 'gone';

  it('returns the same state when everything is still visible', () => {
    const before = state(['f', 'c'], 'f', 'c');
    expect(pruneSelection(before, BEFORE, BEFORE, exists)).toBe(before);
  });

  it('drops ids hidden by a collapsed folder and moves anchor and focus to the folder', () => {
    const before = state(['a', 'b', 'c'], 'b', 'a');
    const rows: SelectionRowRef[] = [{ id: 'f' }, { id: 'c' }];
    const next = pruneSelection(before, BEFORE, rows, exists);
    expect(Array.from(next.ids)).toEqual(['c']);
    expect(next.anchor).toBe('f');
    expect(next.focused).toBe('f');
  });

  it('drops deleted ids and moves the focus to the nearest remaining row', () => {
    const before = state(['g'], 'g', 'g');
    const rows: SelectionRowRef[] = [{ id: 'f' }, { id: 'a', parentId: 'f' }, { id: 'c' }];
    const next = pruneSelection(before, BEFORE, rows, () => false);
    expect(next.ids.size).toBe(0);
    expect(next.focused).toBe('a');
  });

  it('clears everything when no row is left', () => {
    const next = pruneSelection(state(['a'], 'a', 'a'), BEFORE, [], exists);
    expect(next.ids.size).toBe(0);
    expect(next.anchor).toBeUndefined();
    expect(next.focused).toBeUndefined();
  });

  it('leaves an absent focus absent', () => {
    const before = state(['a'], 'a', undefined);
    const next = pruneSelection(before, BEFORE, [{ id: 'f' }, { id: 'c' }], exists);
    expect(next.focused).toBeUndefined();
  });
});
