// packages/editor/src/plugins/layout/ruler/__tests__/frameGeometry.test.ts
/**
 * Tests des calculs de la règle : position d'une image, image sous un point
 * (toute la cellule), bornes, pas des étiquettes et images étiquetées.
 */

import {
  LABEL_STEPS,
  clampFrame,
  frameAtX,
  frameCenter,
  frameLeft,
  isValidFrameWidth,
  labelStep,
  labelledFrames,
  timelineWidth
} from '../frameGeometry';

describe('frame positions', () => {
  it('places frame n at (n - 1) * width, its center half a frame further', () => {
    // Assert
    expect(frameLeft(1, 15)).toBe(0);
    expect(frameLeft(4, 15)).toBe(45);
    expect(frameCenter(4, 15)).toBe(52.5);
    expect(timelineWidth(100, 15)).toBe(1500);
  });

  it('accepts only finite widths above zero', () => {
    // Assert
    expect(isValidFrameWidth(15)).toBe(true);
    expect(isValidFrameWidth(0.5)).toBe(true);
    [0, -1, Number.NaN, Number.POSITIVE_INFINITY].forEach((width) => expect(isValidFrameWidth(width)).toBe(false));
  });
});

describe('frameAtX', () => {
  it('maps the whole cell of a frame to that frame', () => {
    // Assert
    expect(frameAtX(0, 15, 100)).toBe(1);
    expect(frameAtX(14.9, 15, 100)).toBe(1);
    expect(frameAtX(15, 15, 100)).toBe(2);
    expect(frameAtX(52, 15, 100)).toBe(4);
  });

  it('clamps to 1..totalFrames', () => {
    // Assert
    expect(frameAtX(-40, 15, 100)).toBe(1);
    expect(frameAtX(99999, 15, 100)).toBe(100);
    expect(clampFrame(0, 10)).toBe(1);
    expect(clampFrame(11, 10)).toBe(10);
    expect(clampFrame(5, 0)).toBe(1);
  });
});

describe('labels', () => {
  it('labels every 5 frames at the default width, then spaces them out as frames narrow', () => {
    // Assert
    expect(labelStep(15)).toBe(5);
    expect(labelStep(6)).toBe(5);
    expect(labelStep(5)).toBe(10);
    expect(labelStep(1)).toBe(50);
    expect(labelStep(0.001)).toBe(LABEL_STEPS[LABEL_STEPS.length - 1]);
  });

  it('labels frame 1, then each multiple of the step', () => {
    // Assert
    expect(labelledFrames(22, 5, 15)).toEqual([1, 5, 10, 15, 20]);
    expect(labelledFrames(3, 5, 15)).toEqual([1]);
    expect(labelledFrames(0, 5, 15)).toEqual([]);
  });

  it('drops a multiple too close to the label of frame 1', () => {
    // Assert
    expect(labelledFrames(30, 10, 3)).toEqual([1, 20, 30]);
    expect(labelledFrames(30, 5, 6)).toEqual([1, 10, 15, 20, 25, 30]);
  });
});
