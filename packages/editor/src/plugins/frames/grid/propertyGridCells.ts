// packages/editor/src/plugins/frames/grid/propertyGridCells.ts
import type { IPropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { IFrameRange } from './gridCells';

export interface IPropertyGridSegment {
  readonly kind: 'empty' | 'static' | 'tween';
  readonly start: number;
  readonly end: number;
  readonly transitionId?: string;
}

/** Sparse held keys and explicit transitions, without manufacturing legacy spans. */
export function propertyRowSegments(track: IPropertyTimeline, totalFrames: number, range: IFrameRange): readonly IPropertyGridSegment[] {
  const result: IPropertyGridSegment[] = [];
  const push = (kind: IPropertyGridSegment['kind'], start: number, end: number, transitionId?: string): void => {
    const first = Math.max(1, start, range.first);
    const last = Math.min(totalFrames, end, range.last);
    if (first <= last) result.push({ kind, start: first, end: last, ...(transitionId === undefined ? {} : { transitionId }) });
  };
  push(track.beforeFirst === 'first-key' ? 'static' : 'empty', 1, (track.keys[0]?.frame ?? totalFrames + 1) - 1);
  track.keys.forEach((key, index) => {
    const next = track.keys[index + 1];
    const transition = track.transitions?.find((candidate) => candidate.fromFrame === key.frame);
    push(transition === undefined ? 'static' : 'tween', key.frame, next === undefined ? totalFrames : next.frame - 1, transition?.id);
  });
  return result;
}
