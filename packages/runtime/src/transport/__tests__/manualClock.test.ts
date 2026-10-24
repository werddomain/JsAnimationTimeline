// packages/runtime/src/transport/__tests__/manualClock.test.ts
/**
 * Horloge manuelle : avance du temps, rappels d'image en attente, annulation,
 * erreurs des rappels et validation.
 */

import { createManualClock } from '../manualClock';

describe('createManualClock', () => {
  it('starts at 0 or at the given time and moves only on advance', () => {
    expect(createManualClock().now()).toBe(0);
    const clock = createManualClock(500);
    expect(clock.now()).toBe(500);
    clock.advance(16.5);
    expect(clock.now()).toBe(516.5);
  });

  it('runs the frame callbacks requested before the advance, once, after moving the time', () => {
    const clock = createManualClock();
    const seen: number[] = [];
    clock.requestFrame(() => seen.push(clock.now()));
    clock.requestFrame(() => seen.push(clock.now() + 1));
    expect(clock.pendingFrames).toBe(2);
    clock.advance(10);
    expect(seen).toEqual([10, 11]);
    expect(clock.pendingFrames).toBe(0);
    clock.advance(10);
    expect(seen).toEqual([10, 11]);
  });

  it('keeps callbacks requested during an advance for the next one', () => {
    const clock = createManualClock();
    const seen: number[] = [];
    const loop = (): void => {
      seen.push(clock.now());
      clock.requestFrame(loop);
    };
    clock.requestFrame(loop);
    clock.advance(5);
    clock.advance(5);
    expect(seen).toEqual([5, 10]);
    expect(clock.pendingFrames).toBe(1);
  });

  it('runs pending callbacks on advance(0)', () => {
    const clock = createManualClock();
    const callback = jest.fn();
    clock.requestFrame(callback);
    clock.advance(0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(clock.now()).toBe(0);
  });

  it('cancels a pending callback and returns distinct handles', () => {
    const clock = createManualClock();
    const callback = jest.fn();
    const a = clock.requestFrame(callback);
    const b = clock.requestFrame(callback);
    expect(a).not.toBe(b);
    clock.cancelFrame(a);
    clock.cancelFrame(999);
    clock.advance(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('skips a callback cancelled by an earlier callback of the same advance', () => {
    const clock = createManualClock();
    const second = jest.fn();
    let secondHandle = 0;
    clock.requestFrame(() => clock.cancelFrame(secondHandle));
    secondHandle = clock.requestFrame(second);
    clock.advance(1);
    expect(second).not.toHaveBeenCalled();
    expect(clock.pendingFrames).toBe(0);
  });

  it('runs every callback and rethrows the first error', () => {
    const clock = createManualClock();
    const after = jest.fn();
    clock.requestFrame(() => {
      throw new Error('first');
    });
    clock.requestFrame(() => {
      throw new Error('second');
    });
    clock.requestFrame(after);
    expect(() => clock.advance(1)).toThrow('first');
    expect(after).toHaveBeenCalledTimes(1);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('refuses deltaMs %p and keeps the time', (delta) => {
    const clock = createManualClock();
    const callback = jest.fn();
    clock.requestFrame(callback);
    expect(() => clock.advance(delta)).toThrow('deltaMs must be a finite number of at least 0');
    expect(clock.now()).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  it('refuses an invalid start time', () => {
    expect(() => createManualClock(-5)).toThrow('startMs must be a finite number of at least 0');
  });
});
