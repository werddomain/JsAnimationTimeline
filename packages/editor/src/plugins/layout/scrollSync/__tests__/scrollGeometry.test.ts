// packages/editor/src/plugins/layout/scrollSync/__tests__/scrollGeometry.test.ts
/**
 * Tests des calculs sans DOM de `layout.scrollSync` : conversion de la
 * molette, axe utilisé au-dessus de la règle et des calques, état de
 * défilement et épaisseur des barres.
 */

import {
  DELTA_LINE,
  DELTA_PAGE,
  LINE_HEIGHT_PX,
  layersDelta,
  readScrollState,
  rulerDelta,
  scrollStateChanged,
  scrollbarSizes,
  wheelToPixels
} from '../scrollGeometry';

const PAGE = { dx: 400, dy: 200 };

describe('wheelToPixels', () => {
  it('keeps pixel deltas as they are', () => {
    // Act
    const delta = wheelToPixels({ deltaX: 3, deltaY: -7, deltaMode: 0 }, PAGE);

    // Assert
    expect(delta).toEqual({ dx: 3, dy: -7 });
  });

  it('converts lines with the usual line height', () => {
    // Act
    const delta = wheelToPixels({ deltaX: 1, deltaY: 2, deltaMode: DELTA_LINE }, PAGE);

    // Assert
    expect(delta).toEqual({ dx: LINE_HEIGHT_PX, dy: 2 * LINE_HEIGHT_PX });
  });

  it('converts pages with the visible size of each axis', () => {
    // Act
    const delta = wheelToPixels({ deltaX: 1, deltaY: -1, deltaMode: DELTA_PAGE }, PAGE);

    // Assert
    expect(delta).toEqual({ dx: 400, dy: -200 });
  });
});

describe('rulerDelta and layersDelta', () => {
  it('turns any movement over the ruler into a horizontal one', () => {
    // Assert
    expect(rulerDelta({ dx: 0, dy: 30 })).toEqual({ dx: 30, dy: 0 });
    expect(rulerDelta({ dx: -12, dy: 30 })).toEqual({ dx: -12, dy: 0 });
  });

  it('keeps only the vertical movement over the layers, unless Shift is held', () => {
    // Assert
    expect(layersDelta({ dx: 9, dy: 30 }, false)).toEqual({ dx: 0, dy: 30 });
    expect(layersDelta({ dx: 0, dy: 30 }, true)).toEqual({ dx: 30, dy: 0 });
  });
});

describe('scroll state', () => {
  const state = { scrollLeft: 1, scrollTop: 2, viewportWidth: 3, viewportHeight: 4 };

  it('reads the position and the visible size', () => {
    // Act
    const read = readScrollState({ scrollLeft: 1, scrollTop: 2, clientWidth: 3, clientHeight: 4 });

    // Assert
    expect(read).toEqual(state);
  });

  it('reports a change on any field, and always without a previous state', () => {
    // Assert
    expect(scrollStateChanged(undefined, state)).toBe(true);
    expect(scrollStateChanged(state, { ...state })).toBe(false);
    expect(scrollStateChanged(state, { ...state, scrollLeft: 9 })).toBe(true);
    expect(scrollStateChanged(state, { ...state, scrollTop: 9 })).toBe(true);
    expect(scrollStateChanged(state, { ...state, viewportWidth: 9 })).toBe(true);
    expect(scrollStateChanged(state, { ...state, viewportHeight: 9 })).toBe(true);
  });
});

describe('scrollbarSizes', () => {
  it('measures both scrollbars without the borders', () => {
    // Act
    const sizes = scrollbarSizes({
      offsetWidth: 519,
      offsetHeight: 316,
      clientWidth: 500,
      clientHeight: 300,
      clientLeft: 2,
      clientTop: 2
    });

    // Assert
    expect(sizes).toEqual({ x: 12, y: 15 });
  });

  it('never returns a negative size', () => {
    // Act
    const sizes = scrollbarSizes({
      offsetWidth: 100,
      offsetHeight: 100,
      clientWidth: 100,
      clientHeight: 100,
      clientLeft: 1,
      clientTop: 1
    });

    // Assert
    expect(sizes).toEqual({ x: 0, y: 0 });
  });
});
