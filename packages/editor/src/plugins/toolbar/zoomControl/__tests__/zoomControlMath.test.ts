// packages/editor/src/plugins/toolbar/zoomControl/__tests__/zoomControlMath.test.ts
/**
 * Tests des calculs de `toolbar.zoomControl` : préréglages dans les bornes,
 * bornes et échelle logarithmique du curseur, zoom « Ajuster à la fenêtre »
 * et libellés en pourcentage.
 */

import {
  fitZoom,
  formatZoom,
  presetsWithin,
  sliderRange,
  sliderToZoom,
  ZOOM_PRESETS,
  zoomToSlider
} from '../zoomControlMath';

describe('zoom presets and slider range', () => {
  it('lists 25 % to 400 %, keeping only presets inside the zoom range', () => {
    // Assert
    expect(ZOOM_PRESETS).toEqual([0.25, 0.5, 1, 2, 4]);
    expect(presetsWithin({ min: 0.1, max: 8 })).toEqual([0.25, 0.5, 1, 2, 4]);
    expect(presetsWithin({ min: 0.5, max: 2 })).toEqual([0.5, 1, 2]);
  });

  it('bounds the slider by the presets, within the zoom range', () => {
    // Assert
    expect(sliderRange({ min: 0.1, max: 8 })).toEqual({ min: 0.25, max: 4 });
    expect(sliderRange({ min: 0.5, max: 3 })).toEqual({ min: 0.5, max: 2 });
    expect(sliderRange({ min: 5, max: 6 })).toEqual({ min: 5, max: 6 });
  });

  it('maps zoom to the slider on a log2 scale and back', () => {
    // Assert
    expect([zoomToSlider(0.25), zoomToSlider(1), zoomToSlider(4)]).toEqual([-200, 0, 200]);
    expect(sliderToZoom(100)).toBe(2);
    expect(Math.abs(sliderToZoom(zoomToSlider(1.5)) - 1.5)).toBeLessThan(0.01);
  });
});

describe('fitZoom', () => {
  it('fits every frame in the visible width, within the zoom range', () => {
    // Assert
    expect(fitZoom(600, 60, 10, { min: 0.1, max: 8 })).toBe(1);
    expect(fitZoom(300, 60, 10, { min: 0.1, max: 8 })).toBe(0.5);
    expect(fitZoom(100, 6000, 10, { min: 0.1, max: 8 })).toBe(0.1);
    expect(fitZoom(10_000, 10, 10, { min: 0.1, max: 8 })).toBe(8);
  });

  it('returns undefined while the view has no width', () => {
    // Assert
    expect(fitZoom(0, 60, 10, { min: 0.1, max: 8 })).toBeUndefined();
  });
});

describe('formatZoom', () => {
  it('writes a rounded percentage with a non-breaking space', () => {
    // Assert
    expect(formatZoom(1)).toBe('100 %');
    expect(formatZoom(0.25)).toBe('25 %');
    expect(formatZoom(1 / 3)).toBe('33 %');
  });
});
