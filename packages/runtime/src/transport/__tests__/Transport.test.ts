// packages/runtime/src/transport/__tests__/Transport.test.ts
/**
 * Transport sans DOM : temps → image, play/pause/seek, vitesse en cours de
 * lecture, boucle, fin, contenu de `tick`, `onSync`, changement de timeline
 * et destruction, avec l'horloge manuelle.
 */

import * as runtime from '../../index';
import * as transportModule from '../index';
import { createManualClock } from '../manualClock';
import type { IManualClock } from '../manualClock';
import { createTransport, Transport } from '../Transport';
import type { ITransportOptions, ITransportSyncState, ITransportTime } from '../types';

let clock: IManualClock;

/** 10 frames at 10 fps: one frame every 100 ms, 1000 ms in all. */
function create(options: Partial<ITransportOptions> = {}): Transport {
  return createTransport({ fps: 10, totalFrames: 10, clock, ...options });
}

/** Records every event of `t` as short strings. */
function record(t: Transport): string[] {
  const events: string[] = [];
  t.on('tick', ({ timeMs, frame, integerFrame }) => events.push(`tick ${timeMs} ${frame} ${integerFrame}`));
  t.on('frame', ({ frame }) => events.push(`frame ${frame}`));
  t.on('play', () => events.push('play'));
  t.on('pause', () => events.push('pause'));
  t.on('loop', () => events.push('loop'));
  t.on('complete', () => events.push('complete'));
  return events;
}

beforeEach(() => {
  clock = createManualClock();
});

describe('creation', () => {
  it('starts paused at frame 1 with the given settings', () => {
    const t = create({ speed: 2, loop: true });
    expect(t).toBeInstanceOf(Transport);
    expect(t).toMatchObject({ fps: 10, totalFrames: 10, duration: 1000, frame: 1, timeMs: 0, playing: false, loop: true, speed: 2 });
    expect(t.time).toEqual({ timeMs: 0, frame: 1, integerFrame: 1 });
    expect(clock.pendingFrames).toBe(0);
  });

  it('refuses an invalid speed or timeline', () => {
    expect(() => create({ speed: 0 })).toThrow('Speed must be a finite number above 0');
    expect(() => create({ fps: 0 })).toThrow('fps must be a finite number above 0');
    expect(() => create({ totalFrames: 0 })).toThrow('totalFrames must be an integer of at least 1');
  });
});

describe('playback and tick', () => {
  it('emits tick on every clock frame with the fractional time, and frame when the integer frame changes', () => {
    const t = create();
    const events = record(t);
    t.play();
    clock.advance(50);
    clock.advance(25);
    clock.advance(50);
    expect(events).toEqual(['play', 'tick 50 1.5 1', 'tick 75 1.75 1', 'tick 125 2.25 2', 'frame 2']);
    expect(t.time).toEqual({ timeMs: 125, frame: 2.25, integerFrame: 2 });
  });

  it('pauses, keeps the time and stops the frame loop', () => {
    const t = create();
    const events = record(t);
    t.play();
    clock.advance(250);
    t.pause();
    clock.advance(5000);
    expect(t.timeMs).toBe(250);
    expect(t.frame).toBe(3);
    expect(t.playing).toBe(false);
    expect(clock.pendingFrames).toBe(0);
    expect(events.slice(-1)).toEqual(['pause']);
    t.pause();
    t.play();
    t.play();
    expect(events.filter((e) => e === 'play')).toHaveLength(2);
  });

  it('changes speed mid-play from the current time', () => {
    const t = create();
    t.play();
    clock.advance(200);
    t.speed = 0.5;
    clock.advance(200);
    expect(t.timeMs).toBe(300);
    t.speed = 3;
    clock.advance(100);
    expect(t.timeMs).toBe(600);
    expect(t.frame).toBe(7);
    expect(t.speed).toBe(3);
  });
});

describe('end of the timeline', () => {
  it('stops on the last frame and emits tick, frame then complete', () => {
    const t = create();
    const events = record(t);
    t.play();
    clock.advance(950);
    clock.advance(100);
    expect(events).toEqual(['play', 'tick 950 10.5 10', 'frame 10', 'tick 1000 11 10', 'complete']);
    expect(t.playing).toBe(false);
    expect(t.timeMs).toBe(1000);
    expect(clock.pendingFrames).toBe(0);
  });

  it('restarts from frame 1 when played after the end', () => {
    const t = create();
    t.play();
    clock.advance(2000);
    t.play();
    expect(t.time).toEqual({ timeMs: 0, frame: 1, integerFrame: 1 });
  });

  it('loops with the overshoot and keeps playing', () => {
    const t = create({ loop: true });
    const events = record(t);
    t.play();
    clock.advance(1250);
    expect(events).toEqual(['play', 'loop', 'tick 250 3.5 3', 'frame 3']);
    expect(t.playing).toBe(true);
    expect(clock.pendingFrames).toBe(1);
  });

  it('applies a loop change during playback', () => {
    const t = create();
    t.play();
    t.loop = true;
    clock.advance(1000);
    expect(t.playing).toBe(true);
    t.loop = false;
    clock.advance(1000);
    expect(t.playing).toBe(false);
  });

  it('clamps the reported time while the frame loop has not noticed the end', () => {
    const t = create();
    const seen: number[] = [];
    // Requested before play: runs before the transport's own frame callback.
    clock.requestFrame(() => seen.push(t.timeMs, t.frame, t.time.timeMs));
    t.play();
    clock.advance(1500);
    expect(seen).toEqual([1000, 10, 1000]);
  });
});

describe('seek', () => {
  it('applies the frame immediately, emitting tick and frame synchronously', () => {
    const t = create();
    const events = record(t);
    t.seek(6);
    expect(events).toEqual(['tick 500 6 6', 'frame 6']);
    t.seek(6);
    expect(events.slice(2)).toEqual(['tick 500 6 6', 'frame 6']);
  });

  it('clamps to the timeline', () => {
    const t = create();
    t.seek(0);
    expect(t.frame).toBe(1);
    t.seek(99);
    expect(t.time).toEqual({ timeMs: 900, frame: 10, integerFrame: 10 });
    t.seek(2.5);
    expect(t.timeMs).toBe(150);
  });

  it('keeps playing from the new frame', () => {
    const t = create();
    t.play();
    clock.advance(300);
    t.seek(2);
    clock.advance(100);
    expect(t.frame).toBe(3);
    expect(t.playing).toBe(true);
  });

  it('throws for a non-finite frame', () => {
    expect(() => create().seek(Number.NaN)).toThrow('Frame must be a finite number');
  });
});

describe('onSync', () => {
  it('reports each time jump or state change before the events', () => {
    const calls: string[] = [];
    const onSync = (time: ITransportTime, state: ITransportSyncState): void => {
      calls.push(`sync ${time.timeMs} ${state.playing} ${state.speed}`);
    };
    const t = create({ onSync, loop: true });
    t.on('play', () => calls.push('play'));
    t.on('loop', () => calls.push('loop'));
    t.play();
    clock.advance(400);
    t.speed = 2;
    t.seek(3);
    clock.advance(450);
    t.pause();
    expect(calls).toEqual([
      'sync 0 true 1', 'play',
      'sync 400 true 2',
      'sync 200 true 2',
      'sync 100 true 2', 'loop',
      'sync 100 false 2'
    ]);
  });
});

describe('setTimeline', () => {
  it('keeps the time in milliseconds and emits tick and frame', () => {
    const t = create();
    t.seek(5);
    const events = record(t);
    t.setTimeline({ fps: 20, totalFrames: 40 });
    expect(events).toEqual(['tick 400 9 9', 'frame 9']);
    expect(t).toMatchObject({ fps: 20, totalFrames: 40, duration: 2000 });
  });

  it('clamps the time to a shorter timeline, then completes on the next frame', () => {
    const t = create();
    t.play();
    clock.advance(800);
    t.setTimeline({ fps: 10, totalFrames: 5 });
    expect(t.timeMs).toBe(500);
    const complete = jest.fn();
    t.on('complete', complete);
    clock.advance(16);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('refuses an invalid timeline and keeps the old one', () => {
    const t = create();
    expect(() => t.setTimeline({ fps: 10, totalFrames: -1 })).toThrow('totalFrames');
    expect(t.totalFrames).toBe(10);
  });
});

describe('listeners and destroy', () => {
  it('isolates a throwing listener and hands the error to onListenerError', () => {
    const errors: unknown[] = [];
    const t = create({ onListenerError: (error) => errors.push(error) });
    const boom = new Error('boom');
    t.on('tick', () => {
      throw boom;
    });
    t.play();
    clock.advance(100);
    expect(errors).toEqual([boom]);
    expect(clock.pendingFrames).toBe(1);
  });

  it('rethrows listener errors asynchronously by default', () => {
    jest.useFakeTimers();
    try {
      const t = create();
      t.on('frame', () => {
        throw new Error('late');
      });
      expect(() => t.seek(2)).not.toThrow();
      expect(() => jest.runOnlyPendingTimers()).toThrow('late');
    } finally {
      jest.useRealTimers();
    }
  });

  it('removes a listener with off or with the returned function', () => {
    const t = create();
    const a = jest.fn();
    const b = jest.fn();
    t.on('frame', a);
    const offB = t.on('frame', b);
    t.off('frame', a);
    offB();
    t.seek(3);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('stops the frame loop and refuses calls after destroy', () => {
    const t = create();
    const tick = jest.fn();
    t.on('tick', tick);
    t.play();
    t.destroy();
    t.destroy();
    clock.advance(100);
    expect(tick).not.toHaveBeenCalled();
    expect(t.playing).toBe(false);
    expect(clock.pendingFrames).toBe(0);
    expect(() => t.play()).toThrow('The transport was destroyed.');
    expect(() => t.on('tick', tick)).toThrow('The transport was destroyed.');
    expect(() => {
      t.loop = true;
    }).toThrow('The transport was destroyed.');
    expect(() => t.off('tick', tick)).not.toThrow();
  });
});

describe('transport entry point', () => {
  it('exports the transport values, also from the package', () => {
    expect(Object.keys(transportModule).sort()).toEqual([
      'Transport',
      'createManualClock',
      'createTransport',
      'frameToTime',
      'timelineDuration',
      'toTransportTime'
    ]);
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining(Object.keys(transportModule)));
  });
});
