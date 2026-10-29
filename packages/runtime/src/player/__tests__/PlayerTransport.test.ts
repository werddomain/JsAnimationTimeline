// packages/runtime/src/player/__tests__/PlayerTransport.test.ts
/**
 * Lecteur sur le transport : lecture avec l'horloge manuelle, événements
 * `tick` (temps fractionnaire) et `frame`, propriété `time`, `seek` et
 * `update` appliqués tout de suite, et réexports du package.
 */

import * as runtime from '../../index';
import type { ITimelineDocument } from '../../model/document';
import { createManualClock } from '../../transport/manualClock';
import type { IManualClock } from '../../transport/manualClock';
import type { ITransportTime } from '../../transport/types';
import { createPlayer } from '../Player';
import type { IPlayer, IPlayerClock } from '../types';
import { installFakeAnimate } from './fakes';

/** 10 frames at 10 fps: one frame every 100 ms, 1000 ms in all. */
function makeDoc(totalFrames = 10): ITimelineDocument {
  return {
    version: '2.0.0',
    settings: { fps: 10, totalFrames },
    layers: [{
      id: 'box', type: 'layer', name: 'Box', target: { selector: '#box' },
      spans: [{ id: 's1', start: 1, end: totalFrames, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: totalFrames, value: 90 }] } }]
    }]
  };
}

let fake: ReturnType<typeof installFakeAnimate>;
let clock: IManualClock;
let player: IPlayer;

beforeEach(() => {
  document.body.innerHTML = '<div id="box"></div>';
  fake = installFakeAnimate();
  clock = createManualClock();
  player = createPlayer(makeDoc(), { clock });
});

afterEach(() => {
  player.destroy();
  fake.restore();
});

describe('player on the manual clock', () => {
  it('emits tick on every advance and frame when the integer frame changes', () => {
    const ticks: ITransportTime[] = [];
    const frames: number[] = [];
    player.on('tick', (time) => ticks.push(time));
    player.on('frame', ({ frame }) => frames.push(frame));
    player.play();
    clock.advance(40);
    clock.advance(40);
    clock.advance(40);
    expect(ticks).toEqual([
      { timeMs: 40, frame: 1.4, integerFrame: 1 },
      { timeMs: 80, frame: 1.8, integerFrame: 1 },
      { timeMs: 120, frame: 2.2, integerFrame: 2 }
    ]);
    expect(frames).toEqual([2]);
    expect(player.time).toEqual({ timeMs: 120, frame: 2.2, integerFrame: 2 });
    expect(fake.animations[0].playState).toBe('running');
  });

  it('applies seek and update immediately, whatever the clock', () => {
    const events: string[] = [];
    player.on('tick', ({ timeMs }) => events.push(`tick ${timeMs}`));
    player.on('frame', ({ frame }) => events.push(`frame ${frame}`));
    player.seek(4);
    expect(events).toEqual(['tick 300', 'frame 4']);
    expect(fake.animations[0].currentTime).toBe(300);
    player.update(makeDoc(3));
    expect(events).toEqual(['tick 300', 'frame 4', 'tick 300', 'frame 3']);
    expect(player.time).toEqual({ timeMs: 300, frame: 4, integerFrame: 3 });
    expect(clock.pendingFrames).toBe(0);
  });

  it('follows speed changes and completes at the end', () => {
    const complete = jest.fn();
    player.on('complete', complete);
    player.speed = 4;
    player.play();
    clock.advance(100);
    expect(player.frame).toBe(5);
    expect(fake.animations[0].playbackRate).toBe(4);
    clock.advance(200);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(player.time).toEqual({ timeMs: 1000, frame: 11, integerFrame: 10 });
    expect(fake.animations[0]).toMatchObject({ playState: 'paused', currentTime: 1000 });
  });

  it('accepts any IPlayerClock, such as a game loop clock', () => {
    const external: IPlayerClock = clock;
    const p = createPlayer(makeDoc(), { clock: external, autoplay: true, loop: true });
    const loops = jest.fn();
    p.on('loop', loops);
    clock.advance(1100);
    expect(loops).toHaveBeenCalledTimes(1);
    expect(p.frame).toBe(2);
    p.destroy();
  });
});

describe('package exports', () => {
  it('exposes the transport and the manual clock next to the player', () => {
    expect(runtime.createManualClock).toBe(createManualClock);
    expect(typeof runtime.createTransport).toBe('function');
    expect(typeof runtime.createPlayer).toBe('function');
    expect(typeof runtime.createBrowserClock).toBe('function');
  });
});
