// packages/runtime/src/playback/__tests__/createPlaybackPlayer.test.ts
import { createPlaybackPlayer } from '../createPlaybackPlayer';
import { createManualClock } from '../../transport/manualClock';
import { parsedFixture } from './fixtures';
import type { IPlaybackFrame, IPlaybackPlayer, IPlaybackPlayerOptions } from '../types';

describe('generic compiled playback player', () => {
  it('renders initial and direct-seek snapshots before public tick listeners, without replay', () => {
    const clock = createManualClock();
    const frames: number[] = [];
    const render = jest.fn((snapshot: IPlaybackFrame) => { const value = snapshot.object.values.gain; if (value.kind === 'number') frames.push(value.value); });
    const player = createPlaybackPlayer(parsedFixture(), { clock, render });
    expect(frames).toEqual([1]);
    player.on('tick', () => expect(frames[frames.length - 1]).toBe(player.frame));
    player.seek(2);
    player.seek(1);
    player.seek(1.9);
    expect(frames).toEqual([1, 2, 1, 1]);
    expect(player.sample(2).object.values.gain).toEqual({ kind: 'number', value: 2 });
    expect(player.frame).toBe(1);
    expect(player.time.frame).toBeCloseTo(1.9);
    expect(typeof document).toBe('undefined');
    player.destroy();
  });

  it('uses transport speed, pause, loop, completion and clock cancellation', () => {
    const clock = createManualClock();
    const player = createPlaybackPlayer(parsedFixture(), { clock });
    const complete = jest.fn();
    const loop = jest.fn();
    player.on('complete', complete);
    const offLoop = player.on('loop', loop);
    expect(player.duration).toBe(100);
    expect(player.totalFrames).toBe(2);
    expect(player.fps).toBe(20);
    player.play();
    clock.advance(25);
    player.speed = 2;
    expect(player.speed).toBe(2);
    clock.advance(15);
    expect(player.frame).toBe(2);
    player.pause();
    expect(clock.pendingFrames).toBe(0);
    const at = player.timeMs;
    clock.advance(300);
    expect(player.timeMs).toBe(at);
    player.play();
    clock.advance(100);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(player.playing).toBe(false);
    player.loop = true;
    player.play();
    clock.advance(75);
    expect(loop).toHaveBeenCalledTimes(1);
    offLoop();
    clock.advance(100);
    expect(loop).toHaveBeenCalledTimes(1);
    expect(player.loop).toBe(true);
    player.destroy();
    player.destroy();
    expect(clock.pendingFrames).toBe(0);
    expect(() => player.seek(1)).toThrow();
    expect(() => player.play()).toThrow();
    expect(() => player.sample()).toThrow();
  });

  it('detaches input and callback values, and supports listener removal', () => {
    const input = parsedFixture();
    const clock = createManualClock();
    const player = createPlaybackPlayer(input, { clock, render: (state) => { Reflect.set(state.object.values.gain, 'value', 99); } });
    Reflect.set(input.frames['1'].object.values.gain, 'value', 50);
    expect(player.sample().object.values.gain).toEqual({ kind: 'number', value: 1 });
    const listener = jest.fn();
    player.on('frame', listener);
    player.off('frame', listener);
    player.seek(2);
    expect(listener).not.toHaveBeenCalled();
    expect(player.sample().object.values.gain).toEqual({ kind: 'number', value: 2 });
    player.destroy();
  });

  it('rejects invalid input before rendering and validates frame and transport options', () => {
    const clock = createManualClock();
    const render = jest.fn();
    expect(() => createPlaybackPlayer({ ...parsedFixture(), version: 2 } as unknown as ReturnType<typeof parsedFixture>, { clock, render })).toThrow();
    expect(render).not.toHaveBeenCalled();
    expect(() => createPlaybackPlayer(parsedFixture(), { clock, speed: 0 })).toThrow();
    const player = createPlaybackPlayer(parsedFixture(), { clock });
    expect(() => player.seek(NaN)).toThrow();
    expect(() => player.sample(Infinity)).toThrow();
    expect(() => { player.speed = 0; }).toThrow();
    player.destroy();
  });

  it('routes scheduled render failures to the configured error handler', () => {
    const clock = createManualClock();
    const error = new Error('host render failed');
    const onListenerError = jest.fn();
    const player = createPlaybackPlayer(parsedFixture(), { clock, onListenerError, render: (_state, time) => { if (time.integerFrame === 2) throw error; } });
    player.play();
    clock.advance(50);
    expect(onListenerError).toHaveBeenCalledWith(error);
    player.destroy();
    expect(clock.pendingFrames).toBe(0);
  });

  it('renders the restart synchronously when play is called after completion', () => {
    const clock = createManualClock();
    const shown: number[] = [];
    const player = createPlaybackPlayer(parsedFixture(), { clock, render: (_snapshot, time) => shown.push(time.integerFrame) });
    player.play();
    clock.advance(100);
    expect(shown[shown.length - 1]).toBe(2);
    player.play();
    expect(shown[shown.length - 1]).toBe(1);
    player.destroy();
  });

  it('releases the scheduled callback when rendering a restart destroys the player', () => {
    const clock = createManualClock();
    let stop = false;
    const player: IPlaybackPlayer = createPlaybackPlayer(parsedFixture(), { clock, render: (_snapshot, time) => { if (stop && time.integerFrame === 1) player.destroy(); } });
    player.play();
    clock.advance(100);
    stop = true;
    player.play();
    expect(player.playing).toBe(false);
    expect(clock.pendingFrames).toBe(0);
  });

  it('rejects invalid host options and propagates an initial render error before scheduling', () => {
    const clock = createManualClock();
    expect(() => createPlaybackPlayer(parsedFixture(), {} as IPlaybackPlayerOptions)).toThrow('horloge');
    expect(() => createPlaybackPlayer(parsedFixture(), { clock, loop: 'yes' } as unknown as IPlaybackPlayerOptions)).toThrow('booléenne');
    const error = new Error('initial render');
    expect(() => createPlaybackPlayer(parsedFixture(), { clock, render: () => { throw error; } })).toThrow(error);
    expect(clock.pendingFrames).toBe(0);
    const player = createPlaybackPlayer(parsedFixture(), { clock });
    expect(() => Reflect.set(player, 'loop', 'yes')).toThrow('booléenne');
    player.destroy();
  });
});
