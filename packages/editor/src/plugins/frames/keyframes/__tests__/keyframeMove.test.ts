// packages/editor/src/plugins/frames/keyframes/__tests__/keyframeMove.test.ts
/**
 * Tests du calcul pur du déplacement : bornes du décalage, ordre des
 * déplacements par ligne, images clés de propriété redondantes et nouvelle
 * sélection.
 */

import type { ISpan } from '@werddomain/timeline-runtime';
import { moveKeyframe } from '../../../../model/spans';
import { createDoc, layer, spansOf } from '../../../../model/spans/__tests__/fixtures';
import type { ISelectedKeyframe } from '../../selection/types';
import { clampOffset, planMove, shiftCells } from '../keyframeMove';

const content = (rowId: string, frame: number, spanId = `${rowId}-${frame}`): ISelectedKeyframe => ({
  rowId,
  frame,
  kind: 'keyframe',
  spanId
});

const property = (rowId: string, frame: number, spanId: string): ISelectedKeyframe => ({
  rowId,
  frame,
  kind: 'propertyKeyframe',
  spanId
});

const stat = (id: string, start: number, end: number): ISpan => ({ id, start, end, kind: 'static' });

const tween = (id: string, start: number, end: number, frames: readonly number[]): ISpan => ({
  id,
  start,
  end,
  kind: 'tween',
  tracks: { x: frames.map((frame) => ({ frame, value: frame * 10 })) }
});

const plain = createDoc([layer('c', [stat('c1', 1, 3), stat('c2', 4, 6), stat('c3', 7, 9)])], 12);

const steps = (moves: readonly { rowId: string; from: number; to: number }[]): string[] =>
  moves.map((move) => `${move.rowId}:${move.from}>${move.to}`);

describe('clampOffset', () => {
  it('keeps the keyframes between the first and the last frame', () => {
    // Arrange
    const keyframes = [content('c', 3), content('c', 8)];

    // Act and assert
    expect(clampOffset(5, keyframes, 10)).toBe(2);
    expect(clampOffset(-9, keyframes, 10)).toBe(-2);
    expect(clampOffset(1, keyframes, 10)).toBe(1);
  });

  it('returns 0 without keyframes', () => {
    expect(clampOffset(4, [], 10)).toBe(0);
  });
});

describe('planMove', () => {
  it('moves the rightmost keyframe first for a positive offset', () => {
    // Act
    const moves = planMove(plain, [content('c', 4), content('c', 7)], 1);

    // Assert
    expect(steps(moves)).toEqual(['c:7>8', 'c:4>5']);
  });

  it('moves the leftmost keyframe first for a negative offset', () => {
    // Act
    const moves = planMove(plain, [content('c', 7), content('c', 4)], -1);

    // Assert
    expect(steps(moves)).toEqual(['c:4>3', 'c:7>6']);
  });

  it('plans nothing for an offset of 0 or without keyframes', () => {
    expect(planMove(plain, [content('c', 4)], 0)).toEqual([]);
    expect(planMove(plain, [], 2)).toEqual([]);
  });

  it('groups the moves by row in order of first appearance', () => {
    // Arrange
    const doc = createDoc([layer('a', [stat('a1', 1, 3), stat('a2', 4, 6)]), layer('c', [stat('c1', 1, 3), stat('c2', 4, 6)])]);

    // Act
    const moves = planMove(doc, [content('c', 4), content('a', 4)], 1);

    // Assert
    expect(steps(moves)).toEqual(['c:4>5', 'a:4>5']);
  });

  it('orders property keyframes so that a move never overwrites a selected one', () => {
    // Arrange
    const doc = createDoc([layer('a', [tween('t', 1, 10, [1, 6, 7])])]);
    const selected = [property('a', 6, 't'), property('a', 7, 't')];

    // Act
    const moves = planMove(doc, selected, 1);
    const moved = moves.reduce((current, step) => moveKeyframe(current, step.rowId, step.from, step.to), doc);

    // Assert
    expect(steps(moves)).toEqual(['a:7>8', 'a:6>7']);
    expect(spansOf(moved, 'a')[0].tracks?.x?.map((keyframe) => keyframe.frame)).toEqual([1, 7, 8]);
  });

  it('drops the property keyframes of a span that a content keyframe move resizes', () => {
    // Arrange
    const doc = createDoc([layer('a', [stat('a1', 1, 4), tween('t', 5, 10, [5, 8]), stat('a3', 11, 12)])]);
    const selected = [content('a', 5, 't'), property('a', 8, 't')];

    // Act
    const moves = planMove(doc, selected, 1);

    // Assert
    expect(steps(moves)).toEqual(['a:5>6']);
  });

  it('also drops the property keyframes of the span before a moved content keyframe', () => {
    // Arrange
    const doc = createDoc([layer('a', [stat('a1', 1, 4), tween('t', 5, 10, [5, 8]), stat('a3', 11, 12)])]);
    const selected = [property('a', 8, 't'), content('a', 11, 'a3')];

    // Act
    const moves = planMove(doc, selected, -1);

    // Assert
    expect(steps(moves)).toEqual(['a:11>10']);
  });

  it('keeps the property keyframes of a span in another row', () => {
    // Arrange
    const doc = createDoc([
      layer('a', [stat('a1', 1, 4), stat('a2', 5, 8)]),
      layer('b', [tween('t', 1, 10, [1, 5])])
    ]);
    const selected = [content('a', 5), property('b', 5, 't')];

    // Act
    const moves = planMove(doc, selected, 1);

    // Assert
    expect(steps(moves)).toEqual(['a:5>6', 'b:5>6']);
  });

  it('leaves out locked rows and rows under a locked folder', () => {
    // Arrange
    const doc = createDoc([
      layer('a', [stat('a1', 1, 3), stat('a2', 4, 6)], { locked: true }),
      { id: 'f', type: 'folder', name: 'f', locked: true, children: [layer('b', [stat('b1', 1, 3), stat('b2', 4, 6)])] },
      layer('c', [stat('c1', 1, 3), stat('c2', 4, 6)])
    ]);

    // Act
    const moves = planMove(doc, [content('a', 4), content('b', 4), content('c', 4)], 1);

    // Assert
    expect(steps(moves)).toEqual(['c:4>5']);
  });
});

describe('shiftCells', () => {
  it('moves every cell by the offset without touching the input', () => {
    // Arrange
    const cells = Object.freeze([{ rowId: 'a', frame: 2 }, { rowId: 'b', frame: 5 }]);

    // Act
    const shifted = shiftCells(cells, -1);

    // Assert
    expect(shifted).toEqual([{ rowId: 'a', frame: 1 }, { rowId: 'b', frame: 4 }]);
    expect(cells[0].frame).toBe(2);
  });

  it('leaves the cells of rows that did not move in place', () => {
    // Arrange
    const cells = [{ rowId: 'a', frame: 2 }, { rowId: 'locked', frame: 5 }];

    // Act
    const shifted = shiftCells(cells, 3, new Set(['a']));

    // Assert
    expect(shifted).toEqual([{ rowId: 'a', frame: 5 }, { rowId: 'locked', frame: 5 }]);
  });
});
