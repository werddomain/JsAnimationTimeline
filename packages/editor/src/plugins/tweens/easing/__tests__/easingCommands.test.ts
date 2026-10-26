// packages/editor/src/plugins/tweens/easing/__tests__/easingCommands.test.ts
import type { Easing, ILayer, ITimelineDocument } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../../../core/commands/CommandRefusedError';
import { createSetEasingCommand, setSpanEasing } from '../easingCommands';

import { fixture } from './fixtures';

describe('span easing commands', () => {
  it('changes only easing, preserving every track and field, and undoes/redoes exactly', () => {
    const before = fixture();
    const command = createSetEasingCommand('a', 6, 'ease-in');
    const after = command.do(before);
    const original = before.layers[0] as ILayer;
    const changed = after.layers[0] as ILayer;
    expect(changed).toEqual({ ...original, spans: [{ ...original.spans[0], easing: 'ease-in' }, ...original.spans.slice(1)] });
    expect(changed.spans[0].tracks).toBe(original.spans[0].tracks);
    expect(changed.spans[1]).toBe(original.spans[1]);
    expect(command.undo(after)).toEqual(before);
    expect(command.do(command.undo(after))).toEqual(after);
    expect(original.spans[0].easing).toBeUndefined();
  });

  it('returns the same document for an identical effective choice', () => {
    const implicit = fixture();
    expect(setSpanEasing(implicit, 'a', 1, 'linear')).toBe(implicit);
    const explicit = fixture('ease-out');
    expect(setSpanEasing(explicit, 'a', 6, 'ease-out')).toBe(explicit);
  });

  it('keeps an imported curve unless an explicit valid easing is applied', () => {
    const curve = 'cubic-bezier(0.2, -0.5, 0.8, 1.5)';
    const before = fixture(curve);
    expect(setSpanEasing(before, 'a', 1, curve)).toBe(before);
    const command = createSetEasingCommand('a', 2, 'ease');
    expect((command.do(before).layers[0] as ILayer).spans[0].easing).toBe('ease');
    expect(command.undo(command.do(before))).toEqual(before);
  });

  it.each([0, -1, 1.1, NaN, Infinity, 21, 12, 16])('atomically refuses an invalid or non-tween frame %s', (frame) => {
    const before = fixture();
    expect(() => createSetEasingCommand('a', frame, 'ease').do(before)).toThrow(CommandRefusedError);
    expect((before.layers[0] as ILayer).spans[0].easing).toBeUndefined();
  });

  it.each(['garbage', '', 'cubic-bezier(2, 0, 1, 1)', null, undefined, 3])('refuses invalid easing %s', (value) => {
    expect(() => createSetEasingCommand('a', 1, value as Easing).do(fixture())).toThrow(CommandRefusedError);
  });

  it('rechecks locks, including ancestors, against the document at execution', () => {
    const before = fixture();
    const child = before.layers[0] as ILayer;
    const locked: ITimelineDocument = { ...before, layers: [{ id: 'folder', type: 'folder', name: 'Folder', locked: true, children: [child] }] };
    const command = createSetEasingCommand('a', 1, 'ease');
    expect(() => command.do(locked)).toThrow(CommandRefusedError);
    expect(() => command.do({ ...before, layers: [{ ...child, locked: true }] })).toThrow(CommandRefusedError);
    expect(() => createSetEasingCommand('missing', 1, 'ease').do(before)).toThrow(CommandRefusedError);
    expect(() => createSetEasingCommand('folder', 1, 'ease').do(locked)).toThrow(CommandRefusedError);
    expect(command.undo(before)).toBe(before);
  });
});


it('preserves reference targets and arbitrary value tracks without resolving them', () => {
  const before = fixture();
  const original = before.layers[0] as ILayer;
  const target = { ref: 'object-1', stage: 'objects' };
  const tracks = { volume: [{ frame: 1, value: 0 }, { frame: 11, value: 1 }] };
  const source: ITimelineDocument = { ...before, layers: [{ ...original, target, spans: [{ ...original.spans[0], tracks }, ...original.spans.slice(1)] }] };
  const after = setSpanEasing(source, 'a', 1, 'ease-out');
  const changed = after.layers[0] as ILayer;
  expect(changed.target).toBe(target); expect(changed.spans[0].tracks).toBe(tracks);
  expect(changed.spans[0]).toEqual({ ...original.spans[0], tracks, easing: 'ease-out' });
});
