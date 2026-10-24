// packages/editor/src/plugins/toolbar/zoomControl/__tests__/zoomControlMath.test.ts
/**
 * Tests des calculs de `toolbar.zoomControl` : échelle logarithmique du
 * curseur sur toutes les bornes du zoom, pas du clavier qui s'arrête sur les
 * paliers, zoom « Ajuster à la fenêtre » et libellés en pourcentage qui ne
 * se confondent jamais avec un palier.
 */

import {
  fitZoom,
  formatCustomZoom,
  formatZoom,
  sliderBounds,
  sliderToZoom,
  stepSlider,
  zoomToSlider
} from '../zoomControlMath';

const RANGE = { min: 0.1, max: 8 };
const LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

describe('slider scale', () => {
  it('covers the whole zoom range, on an exact log2 scale', () => {
    // Assert
    const bounds = sliderBounds(RANGE);
    expect(sliderToZoom(bounds.min)).toBeCloseTo(0.1, 12);
    expect(sliderToZoom(bounds.max)).toBeCloseTo(8, 12);
    expect([zoomToSlider(0.25), zoomToSlider(1), zoomToSlider(4)]).toEqual([-200, 0, 200]);
    expect(sliderToZoom(zoomToSlider(0.75))).toBeCloseTo(0.75, 12);
  });
});

describe('stepSlider', () => {
  it('moves one small step from 10 %, not to the next level', () => {
    // Act
    const next = stepSlider(0.1, 1, LEVELS, RANGE);

    // Assert
    expect(next).toBeGreaterThan(0.1);
    expect(next).toBeLessThan(0.25);
    expect(next).toBeCloseTo(2 ** (Math.log2(0.1) + 0.05), 12);
  });

  it('moves one small step down from 800 %', () => {
    // Act
    const next = stepSlider(8, -1, LEVELS, RANGE);

    // Assert
    expect(next).toBeLessThan(8);
    expect(next).toBeGreaterThan(4);
  });

  it('stops on a level it would step over', () => {
    // Assert
    expect(stepSlider(0.74, 1, LEVELS, RANGE)).toBe(0.75);
    expect(stepSlider(1.52, -1, LEVELS, RANGE)).toBe(1.5);
  });

  it('stays within the range at both ends', () => {
    // Assert
    expect(stepSlider(8, 1, LEVELS, RANGE)).toBe(8);
    expect(stepSlider(0.1, -1, LEVELS, RANGE)).toBe(0.1);
  });
});

describe('fitZoom', () => {
  it('fits every frame in the visible width, within the zoom range', () => {
    // Assert
    expect(fitZoom(600, 60, 10, RANGE)).toBe(1);
    expect(fitZoom(300, 60, 10, RANGE)).toBe(0.5);
    expect(fitZoom(900, 2000, 10, RANGE)).toBe(0.1);
    expect(fitZoom(10_000, 10, 10, RANGE)).toBe(8);
  });

  it('returns undefined while the view has no width', () => {
    // Assert
    expect(fitZoom(0, 60, 10, RANGE)).toBeUndefined();
  });
});

describe('zoom labels', () => {
  it('writes a rounded percentage with a non-breaking space', () => {
    // Assert
    expect(formatZoom(1)).toBe('100\u00a0%');
    expect(formatZoom(0.25)).toBe('25\u00a0%');
    expect(formatZoom(1 / 3)).toBe('33\u00a0%');
  });

  it('adds decimals until a custom zoom no longer reads like a listed level', () => {
    // Assert
    expect(formatCustomZoom(1.52, LEVELS)).toBe('152\u00a0%');
    expect(formatCustomZoom(0.998, LEVELS)).toBe('99,8\u00a0%');
    expect(formatCustomZoom(0.9996, LEVELS)).toBe('99,96\u00a0%');
    expect(formatCustomZoom(0.24996, LEVELS)).toBe('24,996\u00a0%');
  });
});

describe('custom zoom labels against level labels', () => {
  it('does not reuse the whole-percent label of a level such as 12,5 % ("13 %")', () => {
    // Arrange
    const levels = [0.125, 0.25, 0.5, 1];

    // Act
    const label = formatCustomZoom(0.13, levels);

    // Assert
    expect(formatZoom(0.125)).toBe('13\u00a0%');
    expect(label).not.toBe('13\u00a0%');
    expect(label).toBe('13,0\u00a0%');
    expect(formatCustomZoom(0.1254, [0.125, 0.25])).toBe('12,54\u00a0%');
    expect(formatCustomZoom(0.4996, [0.125, 0.25, 0.5, 1])).toBe('49,96\u00a0%');
  });
});

