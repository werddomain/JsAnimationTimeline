// packages/editor/src/plugins/frames/selection/__tests__/frameSelection.test.ts
/**
 * Tests du modèle sans DOM de `frames.selection` : clic seul, Ctrl, Maj
 * (rectangle), remplacement, nettoyage et regroupement en suites.
 */

import type { IVisibleRow } from '../../../../model/rows';
import {
  EMPTY_FRAME_SELECTION,
  cellKey,
  cellRuns,
  isSelectableCell,
  pruneSelection,
  rectangleCells,
  sameCells,
  selectCells,
  selectOnly,
  selectRectangle,
  toggleCell
} from '../frameSelection';

const rows: readonly IVisibleRow[] = [
  { id: 'a', kind: 'layer', depth: 0, index: 0 },
  { id: 'f', kind: 'folder', depth: 0, index: 1 },
  { id: 'b', kind: 'layer', depth: 1, parentId: 'f', index: 2 },
  { id: 'c', kind: 'layer', depth: 0, index: 3 }
];
const TOTAL = 20;

describe('selectable cells', () => {
  it('accepts frames of visible layer rows within the duration only', () => {
    // Act / Assert
    expect(isSelectableCell({ rowId: 'a', frame: 1 }, rows, TOTAL)).toBe(true);
    expect(isSelectableCell({ rowId: 'a', frame: 20 }, rows, TOTAL)).toBe(true);
    expect(isSelectableCell({ rowId: 'a', frame: 21 }, rows, TOTAL)).toBe(false);
    expect(isSelectableCell({ rowId: 'a', frame: 0 }, rows, TOTAL)).toBe(false);
    expect(isSelectableCell({ rowId: 'a', frame: 2.5 }, rows, TOTAL)).toBe(false);
    expect(isSelectableCell({ rowId: 'f', frame: 3 }, rows, TOTAL)).toBe(false);
    expect(isSelectableCell({ rowId: 'zz', frame: 3 }, rows, TOTAL)).toBe(false);
  });
});

describe('selectOnly', () => {
  it('selects the single cell and anchors on it', () => {
    // Act
    const state = selectOnly({ rowId: 'b', frame: 4 }, rows, TOTAL);

    // Assert
    expect(state).toEqual({ cells: [{ rowId: 'b', frame: 4 }], anchor: { rowId: 'b', frame: 4 } });
  });

  it('clears the selection for an invalid cell', () => {
    // Act / Assert
    expect(selectOnly({ rowId: 'f', frame: 4 }, rows, TOTAL)).toBe(EMPTY_FRAME_SELECTION);
  });
});

describe('toggleCell', () => {
  it('adds a cell, keeps display order, and moves the anchor to it', () => {
    // Arrange
    const start = selectOnly({ rowId: 'c', frame: 2 }, rows, TOTAL);

    // Act
    const state = toggleCell(start, { rowId: 'a', frame: 9 }, rows, TOTAL);

    // Assert
    expect(state.cells).toEqual([
      { rowId: 'a', frame: 9 },
      { rowId: 'c', frame: 2 }
    ]);
    expect(state.anchor).toEqual({ rowId: 'a', frame: 9 });
  });

  it('removes a selected cell and drops the anchor when it was that cell', () => {
    // Arrange
    const start = toggleCell(selectOnly({ rowId: 'c', frame: 2 }, rows, TOTAL), { rowId: 'a', frame: 9 }, rows, TOTAL);

    // Act
    const removedAnchor = toggleCell(start, { rowId: 'a', frame: 9 }, rows, TOTAL);
    const removedOther = toggleCell(start, { rowId: 'c', frame: 2 }, rows, TOTAL);

    // Assert
    expect(removedAnchor).toEqual({ cells: [{ rowId: 'c', frame: 2 }] });
    expect(removedOther).toEqual({ cells: [{ rowId: 'a', frame: 9 }], anchor: { rowId: 'a', frame: 9 } });
  });

  it('ignores an invalid cell', () => {
    // Arrange
    const start = selectOnly({ rowId: 'c', frame: 2 }, rows, TOTAL);

    // Act / Assert
    expect(toggleCell(start, { rowId: 'f', frame: 2 }, rows, TOTAL)).toBe(start);
  });
});

describe('rectangle selection', () => {
  it('covers the layer rows and frames between the two cells, skipping folders', () => {
    // Act
    const cells = rectangleCells({ rowId: 'c', frame: 5 }, { rowId: 'a', frame: 3 }, rows, TOTAL);

    // Assert
    expect(cells.map(cellKey)).toEqual(['a:3', 'a:4', 'a:5', 'b:3', 'b:4', 'b:5', 'c:3', 'c:4', 'c:5']);
  });

  it('is empty when a corner is not on a visible layer row', () => {
    // Act / Assert
    expect(rectangleCells({ rowId: 'zz', frame: 1 }, { rowId: 'a', frame: 3 }, rows, TOTAL)).toEqual([]);
  });

  it('replaces the selection with the rectangle from the anchor, keeping the anchor', () => {
    // Arrange
    const start = toggleCell(selectOnly({ rowId: 'c', frame: 9 }, rows, TOTAL), { rowId: 'a', frame: 2 }, rows, TOTAL);

    // Act
    const state = selectRectangle(start, { rowId: 'b', frame: 3 }, false, rows, TOTAL);

    // Assert
    expect(state.cells.map(cellKey)).toEqual(['a:2', 'a:3', 'b:2', 'b:3']);
    expect(state.anchor).toEqual({ rowId: 'a', frame: 2 });
  });

  it('adds the rectangle to the selection when additive', () => {
    // Arrange
    const start = toggleCell(selectOnly({ rowId: 'c', frame: 9 }, rows, TOTAL), { rowId: 'a', frame: 2 }, rows, TOTAL);

    // Act
    const state = selectRectangle(start, { rowId: 'a', frame: 4 }, true, rows, TOTAL);

    // Assert
    expect(state.cells.map(cellKey)).toEqual(['a:2', 'a:3', 'a:4', 'c:9']);
  });

  it('acts like a single click without an anchor, and ignores an invalid target', () => {
    // Arrange
    const anchored = selectOnly({ rowId: 'a', frame: 1 }, rows, TOTAL);

    // Act
    const fromNothing = selectRectangle(EMPTY_FRAME_SELECTION, { rowId: 'b', frame: 6 }, false, rows, TOTAL);
    const toFolder = selectRectangle(anchored, { rowId: 'f', frame: 6 }, false, rows, TOTAL);

    // Assert
    expect(fromNothing).toEqual({ cells: [{ rowId: 'b', frame: 6 }], anchor: { rowId: 'b', frame: 6 } });
    expect(toFolder).toBe(anchored);
  });
});

describe('selectCells', () => {
  it('keeps the valid cells once, in display order, anchored on the last valid one given', () => {
    // Act
    const state = selectCells(
      [
        { rowId: 'c', frame: 1 },
        { rowId: 'a', frame: 5 },
        { rowId: 'a', frame: 5 },
        { rowId: 'f', frame: 2 }
      ],
      rows,
      TOTAL
    );

    // Assert
    expect(state.cells.map(cellKey)).toEqual(['a:5', 'c:1']);
    expect(state.anchor).toEqual({ rowId: 'a', frame: 5 });
  });

  it('returns the empty selection when nothing is valid', () => {
    // Act / Assert
    expect(selectCells([{ rowId: 'zz', frame: 1 }], rows, TOTAL)).toBe(EMPTY_FRAME_SELECTION);
  });
});

describe('pruneSelection', () => {
  it('returns the same state when everything is still valid', () => {
    // Arrange
    const state = selectOnly({ rowId: 'b', frame: 4 }, rows, TOTAL);

    // Act / Assert
    expect(pruneSelection(state, rows, TOTAL)).toBe(state);
  });

  it('drops cells and the anchor of rows that are gone, and frames past the duration', () => {
    // Arrange
    const state = selectCells(
      [
        { rowId: 'a', frame: 3 },
        { rowId: 'c', frame: 18 },
        { rowId: 'b', frame: 7 }
      ],
      rows,
      TOTAL
    );
    const withoutB = rows.filter((row) => row.id !== 'b');

    // Act
    const pruned = pruneSelection(state, withoutB, 10);

    // Assert
    expect(pruned).toEqual({ cells: [{ rowId: 'a', frame: 3 }] });
  });
});

describe('helpers', () => {
  it('compares cell lists in order', () => {
    // Act / Assert
    expect(sameCells([{ rowId: 'a', frame: 1 }], [{ rowId: 'a', frame: 1 }])).toBe(true);
    expect(sameCells([{ rowId: 'a', frame: 1 }], [{ rowId: 'a', frame: 2 }])).toBe(false);
    expect(sameCells([], [{ rowId: 'a', frame: 2 }])).toBe(false);
  });

  it('groups sorted cells into contiguous runs per row', () => {
    // Act
    const runs = cellRuns([
      { rowId: 'a', frame: 2 },
      { rowId: 'a', frame: 3 },
      { rowId: 'a', frame: 5 },
      { rowId: 'b', frame: 6 },
      { rowId: 'b', frame: 7 }
    ]);

    // Assert
    expect(runs).toEqual([
      { rowId: 'a', first: 2, last: 3 },
      { rowId: 'a', first: 5, last: 5 },
      { rowId: 'b', first: 6, last: 7 }
    ]);
  });
});
