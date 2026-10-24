// packages/editor/src/plugins/frames/grid/__tests__/gridCells.test.ts
/**
 * Tests des calculs sans DOM de `frames.grid` : morceaux et marques d'une
 * ligne, coupés à la fenêtre affichée, et fenêtre visible (images, lignes).
 */

import type { IFolder, ILayer, ISpan } from '@werddomain/timeline-runtime';
import {
  FRAME_OVERSCAN,
  ROW_OVERSCAN,
  UNMEASURED_FRAMES,
  UNMEASURED_ROWS,
  rowMarks,
  rowSegments,
  visibleFrameRange,
  rangeContains,
  visibleRowRange
} from '../gridCells';

const ALL = { first: 1, last: 1000 };

function layer(spans: readonly ISpan[]): ILayer {
  return { id: 'l', type: 'layer', name: 'l', spans };
}

const folder: IFolder = { id: 'f', type: 'folder', name: 'f', children: [] };

const spans: readonly ISpan[] = [
  { id: 's1', start: 1, end: 5, kind: 'static' },
  { id: 's2', start: 6, end: 6, kind: 'blank' },
  {
    id: 's3',
    start: 7,
    end: 12,
    kind: 'tween',
    tracks: {
      x: [
        { frame: 7, value: 0 },
        { frame: 10, value: 5 },
        { frame: 12, value: 9 }
      ],
      y: [
        { frame: 7, value: 0 },
        { frame: 10, value: 1 },
        { frame: 20, value: 1 }
      ]
    }
  },
  { id: 's4', start: 13, end: 16, kind: 'blank' }
];

describe('rowSegments', () => {
  it('returns one segment per span, then the empty end of the timeline', () => {
    // Act
    const segments = rowSegments(layer(spans), 20, ALL);

    // Assert
    expect(segments).toEqual([
      { kind: 'static', start: 1, end: 5, spanId: 's1', spanStart: 1, spanEnd: 5 },
      { kind: 'blank', start: 6, end: 6, spanId: 's2', spanStart: 6, spanEnd: 6 },
      { kind: 'tween', start: 7, end: 12, spanId: 's3', spanStart: 7, spanEnd: 12 },
      { kind: 'blank', start: 13, end: 16, spanId: 's4', spanStart: 13, spanEnd: 16 },
      { kind: 'empty', start: 17, end: 20 }
    ]);
  });

  it('clips segments to the displayed range and to totalFrames', () => {
    // Act
    const segments = rowSegments(layer(spans), 14, { first: 4, last: 8 });

    // Assert
    expect(segments).toEqual([
      { kind: 'static', start: 4, end: 5, spanId: 's1', spanStart: 1, spanEnd: 5 },
      { kind: 'blank', start: 6, end: 6, spanId: 's2', spanStart: 6, spanEnd: 6 },
      { kind: 'tween', start: 7, end: 8, spanId: 's3', spanStart: 7, spanEnd: 12 }
    ]);
  });

  it('cuts a span that goes past totalFrames and ignores spans after it', () => {
    // Act
    const segments = rowSegments(layer(spans), 9, ALL);

    // Assert
    expect(segments[segments.length - 1]).toEqual({ kind: 'tween', start: 7, end: 9, spanId: 's3', spanStart: 7, spanEnd: 12 });
    expect(segments).toHaveLength(3);
  });

  it('fills a layer without spans, or a gap between spans, with empty segments', () => {
    // Arrange
    const gapped = layer([
      { id: 'a', start: 1, end: 2, kind: 'static' },
      { id: 'b', start: 5, end: 6, kind: 'static' }
    ]);

    // Act
    const none = rowSegments(layer([]), 10, ALL);
    const gaps = rowSegments(gapped, 6, ALL);

    // Assert
    expect(none).toEqual([{ kind: 'empty', start: 1, end: 10 }]);
    expect(gaps.map((segment) => segment.kind)).toEqual(['static', 'empty', 'static']);
    expect(gaps[1]).toEqual({ kind: 'empty', start: 3, end: 4 });
  });

  it('keeps the whole span bounds on a clipped segment', () => {
    // Act
    const [segment] = rowSegments(layer(spans), 20, { first: 3, last: 4 });

    // Assert
    expect(segment).toEqual({ kind: 'static', start: 3, end: 4, spanId: 's1', spanStart: 1, spanEnd: 5 });
  });

  it('returns a single folder segment for a folder row', () => {
    // Act
    const segments = rowSegments(folder, 30, { first: 10, last: 50 });

    // Assert
    expect(segments).toEqual([{ kind: 'folder', start: 10, end: 30 }]);
  });

  it('returns nothing for a range outside the timeline', () => {
    // Act / Assert
    expect(rowSegments(layer(spans), 20, { first: 30, last: 40 })).toEqual([]);
    expect(rowSegments(folder, 20, { first: 30, last: 40 })).toEqual([]);
  });
});

describe('rowMarks', () => {
  it('marks span starts, tween property keyframes and the end of static and blank spans', () => {
    // Act
    const marks = rowMarks(layer(spans), 20, ALL);

    // Assert
    expect(marks).toEqual([
      { kind: 'keyframe', frame: 1, spanId: 's1' },
      { kind: 'spanEnd', frame: 5, spanId: 's1' },
      { kind: 'blankKeyframe', frame: 6, spanId: 's2' },
      { kind: 'keyframe', frame: 7, spanId: 's3' },
      { kind: 'propertyKeyframe', frame: 10, spanId: 's3' },
      { kind: 'propertyKeyframe', frame: 12, spanId: 's3' },
      { kind: 'blankKeyframe', frame: 13, spanId: 's4' },
      { kind: 'spanEnd', frame: 16, spanId: 's4' }
    ]);
  });

  it('keeps only the marks inside the displayed range and the timeline', () => {
    // Act
    const marks = rowMarks(layer(spans), 12, { first: 6, last: 100 });

    // Assert
    expect(marks.map((mark) => mark.frame)).toEqual([6, 7, 10, 12]);
  });

  it('has no marks on a folder row', () => {
    // Act / Assert
    expect(rowMarks(folder, 20, ALL)).toEqual([]);
  });
});

describe('visibleFrameRange', () => {
  it('covers the visible frames plus the overscan on each side', () => {
    // Act : 300 px à partir de 1500 px, images de 15 px -> images 101 à 120 visibles.
    const range = visibleFrameRange(1500, 300, 15, 1000);

    // Assert
    expect(range).toEqual({ first: 101 - FRAME_OVERSCAN, last: 101 + 20 + FRAME_OVERSCAN });
  });

  it('is bounded by 1 and totalFrames', () => {
    // Act
    const start = visibleFrameRange(0, 300, 15, 1000);
    const short = visibleFrameRange(0, 300, 15, 8);

    // Assert
    expect(start.first).toBe(1);
    expect(short).toEqual({ first: 1, last: 8 });
  });

  it('draws UNMEASURED_FRAMES frames before the zone has a measured width', () => {
    // Act
    const range = visibleFrameRange(0, 0, 15, 10000);

    // Assert
    expect(range).toEqual({ first: 1, last: 1 + UNMEASURED_FRAMES + FRAME_OVERSCAN });
  });

  it('stays valid when scrolled past the end', () => {
    // Act
    const range = visibleFrameRange(100000, 300, 15, 10);

    // Assert
    expect(range.first).toBeLessThanOrEqual(range.last);
    expect(range.last).toBe(10);
  });
});

describe('visibleRowRange', () => {
  it('covers the visible rows plus the overscan, bounded by the row count', () => {
    // Act : 150 px à partir de 300 px, lignes de 30 px -> lignes 10 à 14 visibles.
    const range = visibleRowRange(300, 150, 30, 100);

    // Assert
    expect(range).toEqual({ first: 10 - ROW_OVERSCAN, last: 10 + 5 + ROW_OVERSCAN });
  });

  it('starts at 0 and stops at the last row', () => {
    // Act / Assert
    expect(visibleRowRange(0, 150, 30, 3)).toEqual({ first: 0, last: 2 });
  });

  it('is empty without rows', () => {
    // Act
    const range = visibleRowRange(0, 150, 30, 0);

    // Assert
    expect(range.last).toBeLessThan(range.first);
  });

  it('draws UNMEASURED_ROWS rows before the zone has a measured height', () => {
    // Act / Assert
    expect(visibleRowRange(0, 0, 30, 1000)).toEqual({ first: 0, last: UNMEASURED_ROWS + ROW_OVERSCAN });
  });
});

describe('overscan and rangeContains', () => {
  it('computes the visible range without margin when overscan is 0', () => {
    // Act / Assert
    expect(visibleFrameRange(1500, 300, 15, 1000, 0)).toEqual({ first: 101, last: 121 });
    expect(visibleRowRange(300, 150, 30, 100, 0)).toEqual({ first: 10, last: 15 });
  });

  it('tells whether a range is inside another, an empty range being always inside', () => {
    // Act / Assert
    expect(rangeContains({ first: 1, last: 50 }, { first: 10, last: 50 })).toBe(true);
    expect(rangeContains({ first: 1, last: 50 }, { first: 10, last: 51 })).toBe(false);
    expect(rangeContains({ first: 5, last: 50 }, { first: 4, last: 10 })).toBe(false);
    expect(rangeContains({ first: 0, last: -1 }, { first: 0, last: -1 })).toBe(true);
  });
});
