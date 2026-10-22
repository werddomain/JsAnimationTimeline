// packages/runtime/src/evaluate/__tests__/track.test.ts
/**
 * Reading a property track at a (possibly eased) frame.
 */

import { createPropertyRegistry } from '../../properties/PropertyRegistry';
import { valueAtFrame, withImplicitStart } from '../track';

const registry = createPropertyRegistry();
const x = registry.require('x');
const opacity = registry.require('opacity');
const range = { start: 1, end: 11 };

describe('withImplicitStart', () => {
  it('keeps a track that starts at the span start', () => {
    const track = [{ frame: 1, value: 5 }];
    expect(withImplicitStart(track, range, 0)).toBe(track);
  });

  it('adds the carried value at the span start when the track starts later', () => {
    expect(withImplicitStart([{ frame: 6, value: 50 }], range, 10))
      .toEqual([{ frame: 1, value: 10 }, { frame: 6, value: 50 }]);
  });

  it('uses the carried value alone for an empty track', () => {
    expect(withImplicitStart([], range, 7)).toEqual([{ frame: 1, value: 7 }]);
  });
});

describe('valueAtFrame', () => {
  const points = [{ frame: 1, value: 0 }, { frame: 6, value: 50 }, { frame: 11, value: 100 }];

  it.each([
    [1, 0],
    [3.5, 25],
    [6, 50],
    [8.5, 75],
    [11, 100]
  ])('interpolates linearly at frame %p → %p', (frame, expected) => {
    expect(valueAtFrame(x, points, frame, range)).toBeCloseTo(expected, 10);
  });

  it('holds a single keyframe', () => {
    expect(valueAtFrame(x, [{ frame: 4, value: 9 }], 8, range)).toBe(9);
  });

  it('holds the last value after the last keyframe inside the span', () => {
    const early = [{ frame: 1, value: 0 }, { frame: 5, value: 40 }];
    expect(valueAtFrame(x, early, 9, range)).toBe(40);
    expect(valueAtFrame(x, early, 12, range)).toBe(40);
  });

  it('extrapolates past the span end when the last keyframe is at the end (overshoot)', () => {
    expect(valueAtFrame(x, points, 12, range)).toBeCloseTo(110, 10);
  });

  it('extrapolates before the span start when the first keyframe is at the start (overshoot)', () => {
    expect(valueAtFrame(x, points, 0, range)).toBeCloseTo(-10, 10);
  });

  it('holds the first value before a first keyframe that is not at the span start', () => {
    const late = [{ frame: 4, value: 30 }, { frame: 11, value: 100 }];
    expect(valueAtFrame(x, late, 0, range)).toBe(30);
  });

  it('applies the property bounds', () => {
    const fade = [{ frame: 1, value: 0 }, { frame: 11, value: 1 }];
    expect(valueAtFrame(opacity, fade, 12, range)).toBe(1);
  });
});
