// packages/editor/src/plugins/layout/zoom/__tests__/zoomLevels.test.ts
/**
 * Tests des calculs du zoom : validité, bornes, paliers (dans, hors et au
 * bout de la liste) et défilement qui garde un point d'ancrage immobile.
 */

import {
  DEFAULT_ZOOM_LEVELS,
  anchoredScrollLeft,
  clampZoom,
  isValidZoom,
  stepZoom
} from '../zoomLevels';

const RANGE = { min: 0.1, max: 8 };

describe('zoom values', () => {
  it('accepts only finite factors above zero', () => {
    // Assert
    expect(isValidZoom(1)).toBe(true);
    [0, -2, Number.NaN, Number.POSITIVE_INFINITY].forEach((value) => expect(isValidZoom(value)).toBe(false));
  });

  it('clamps to the range', () => {
    // Assert
    expect(clampZoom(0.01, RANGE)).toBe(0.1);
    expect(clampZoom(20, RANGE)).toBe(8);
    expect(clampZoom(2, RANGE)).toBe(2);
  });
});

describe('stepZoom', () => {
  it('moves to the next or previous level', () => {
    // Assert
    expect(stepZoom(1, 1, DEFAULT_ZOOM_LEVELS, RANGE)).toBe(1.5);
    expect(stepZoom(1, -1, DEFAULT_ZOOM_LEVELS, RANGE)).toBe(0.75);
  });

  it('goes to the nearest level in the direction from a value between levels', () => {
    // Assert
    expect(stepZoom(1.2, 1, DEFAULT_ZOOM_LEVELS, RANGE)).toBe(1.5);
    expect(stepZoom(1.2, -1, DEFAULT_ZOOM_LEVELS, RANGE)).toBe(1);
  });

  it('goes to the bound past the last level', () => {
    // Assert
    expect(stepZoom(4, 1, DEFAULT_ZOOM_LEVELS, RANGE)).toBe(8);
    expect(stepZoom(0.25, -1, DEFAULT_ZOOM_LEVELS, RANGE)).toBe(0.1);
  });

  it('skips levels outside the range', () => {
    // Assert
    expect(stepZoom(1, 1, DEFAULT_ZOOM_LEVELS, { min: 0.5, max: 1.2 })).toBe(1.2);
    expect(stepZoom(1, -1, DEFAULT_ZOOM_LEVELS, { min: 0.6, max: 4 })).toBe(0.75);
  });
});

describe('anchoredScrollLeft', () => {
  it('keeps the anchored point at the same place on screen', () => {
    // Act
    const left = anchoredScrollLeft(150, 150, 15, 30);

    // Assert : (150 + 150) / 15 = image 20 (en largeurs), à 150 px du bord.
    expect(left).toBe(20 * 30 - 150);
  });

  it('never scrolls before the start', () => {
    // Assert
    expect(anchoredScrollLeft(200, 0, 30, 15)).toBe(0);
  });
});
