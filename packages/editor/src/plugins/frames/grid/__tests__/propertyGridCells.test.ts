// packages/editor/src/plugins/frames/grid/__tests__/propertyGridCells.test.ts
import type { IPropertyTimeline } from '@kazo-ca/timeline-runtime';
import { propertyRowSegments } from '../propertyGridCells';

const track: IPropertyTimeline = {
  initialValue: { kind: 'number', value: 0 },
  keys: [5, 10, 20].map((frame) => ({ frame, value: { kind: 'number', value: frame } })),
  transitions: [{ id: 'motion', fromFrame: 10, toFrame: 20 }]
};

it('shows held keys and only explicit motion transitions, including the final held key', () => {
  expect(propertyRowSegments(track, 30, { first: 1, last: 30 })).toEqual([
    { kind: 'empty', start: 1, end: 4 },
    { kind: 'static', start: 5, end: 9 },
    { kind: 'tween', start: 10, end: 19, transitionId: 'motion' },
    { kind: 'static', start: 20, end: 30 }
  ]);
});

it('clips the virtual window and represents beforeFirst first-key without a manufactured key', () => {
  expect(propertyRowSegments({ ...track, beforeFirst: 'first-key' }, 30, { first: 3, last: 12 })).toEqual([
    { kind: 'static', start: 3, end: 4 }, { kind: 'static', start: 5, end: 9 },
    { kind: 'tween', start: 10, end: 12, transitionId: 'motion' }
  ]);
});
