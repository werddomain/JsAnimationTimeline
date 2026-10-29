// packages/runtime/src/player/__tests__/Player.test.ts
/**
 * Player: animation creation, play/pause/seek, loop, speed, events, update
 * and destroy, with a fake clock and a fake `Element.animate`.
 */

import * as runtime from '../../index';
import type { ITimelineDocument } from '../../model/document';
import type { ILayer } from '../../model/layer';
import { createPropertyRegistry } from '../../properties/PropertyRegistry';
import * as player from '../index';
import { createPlayer } from '../Player';
import type { IPlayer, IPlayerOptions } from '../types';
import { FakeClock, installFakeAnimate } from './fakes';
import type { FakeAnimation } from './fakes';

/** 10 frames at 10 fps: one frame every 100 ms, 1000 ms in all. */
function makeDoc(overrides: Partial<ITimelineDocument> = {}): ITimelineDocument {
  return {
    version: '2.0.0',
    settings: { fps: 10, totalFrames: 10 },
    layers: [
      {
        id: 'box', type: 'layer', name: 'Box', target: { selector: '#box' },
        spans: [{ id: 's1', start: 1, end: 10, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] } }]
      },
      {
        id: 'folder', type: 'folder', name: 'F', children: [
          { id: 'dot', type: 'layer', name: 'Dot', target: { selector: '.dot' }, spans: [{ id: 's2', start: 1, end: 10, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.5 }] } }] },
          { id: 'still', type: 'layer', name: 'Still', target: { selector: '#box' }, spans: [{ id: 's3', start: 1, end: 10, kind: 'static' }] },
          { id: 'ghost', type: 'layer', name: 'Ghost', target: { selector: '#missing' }, spans: [{ id: 's4', start: 1, end: 10, kind: 'blank' }] }
        ]
      }
    ],
    ...overrides
  };
}

let fake: ReturnType<typeof installFakeAnimate>;
let clock: FakeClock;
let players: IPlayer[];

function create(doc: ITimelineDocument = makeDoc(), options: IPlayerOptions = {}): IPlayer {
  const created = createPlayer(doc, { clock, ...options });
  players.push(created);
  return created;
}

function times(animations: readonly FakeAnimation[]): Array<number | null> {
  return animations.map((a) => a.currentTime);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="box"></div><span class="dot"></span>';
  fake = installFakeAnimate();
  clock = new FakeClock();
  players = [];
});

afterEach(() => {
  players.forEach((p) => p.destroy());
  fake.restore();
});

describe('creation', () => {
  it('animates each target with a changing layer, for the whole duration', () => {
    const p = create();
    expect(fake.animations.map((a) => a.target.id || a.target.className)).toEqual(['box', 'dot']);
    fake.animations.forEach((a) => {
      expect(a.options).toEqual({ duration: 1000, fill: 'both', easing: 'linear' });
      expect(a.playState).toBe('paused');
      expect(a.currentTime).toBe(0);
    });
    expect(p).toMatchObject({ frame: 1, totalFrames: 10, fps: 10, duration: 1000, playing: false, loop: false, speed: 1 });
  });

  it('reports layers whose target is missing', () => {
    expect(create().missingTargets).toEqual(['ghost']);
  });

  it('resolves selectors inside root', () => {
    const root = document.createElement('section');
    root.innerHTML = '<div id="box"></div>';
    create(makeDoc(), { root });
    expect(fake.animations).toHaveLength(1);
    expect(fake.animations[0].target.parentElement).toBe(root);
  });

  it('accepts an element target', () => {
    const element = document.createElement('i');
    const doc = makeDoc({ layers: [{ id: 'e', type: 'layer', name: 'E', target: { element }, spans: [{ id: 's', start: 1, end: 10, kind: 'blank' }] }] });
    create(doc);
    expect(fake.animations[0].target).toBe(element);
  });

  it('uses the given registry for plugin properties', () => {
    const registry = createPropertyRegistry([{ name: 'radius', kind: 'style', cssName: 'border-radius', unit: 'px', defaultValue: 0 }]);
    const doc = makeDoc({ layers: [{ id: 'r', type: 'layer', name: 'R', target: { selector: '#box' }, spans: [{ id: 's', start: 1, end: 10, kind: 'static', tracks: { radius: [{ frame: 1, value: 4 }] } }] }] });
    create(doc, { registry });
    expect(fake.animations[0].keyframes[0]).toMatchObject({ borderRadius: '4px' });
  });

  it('throws for an invalid document', () => {
    const doc = makeDoc({ settings: { fps: 10, totalFrames: 5 } });
    expect(() => create(doc)).toThrow(/Invalid timeline document \(\d+ issue\(s\)\); first at \/layers\/0\/spans\/0\/end/);
  });

  it('lists a layer with an invalid selector in missingTargets', () => {
    const doc = makeDoc({ layers: [{ id: 'bad', type: 'layer', name: 'B', target: { selector: '##' }, spans: [{ id: 's', start: 1, end: 10, kind: 'blank' }] }] });
    expect(create(doc).missingTargets).toEqual(['bad']);
    expect(fake.animations).toHaveLength(0);
  });

  it('throws when Web Animations is not available', () => {
    fake.restore();
    expect(() => create()).toThrow('The Web Animations API (Element.animate) is not available.');
  });

  it.each([0, -1, Number.NaN])('throws for speed %p', (speed) => {
    expect(() => create(makeDoc(), { speed })).toThrow('Speed must be a finite number above 0');
  });

  it('plays right away with autoplay', () => {
    const p = create(makeDoc(), { autoplay: true });
    expect(p.playing).toBe(true);
    expect(fake.animations.every((a) => a.playState === 'running')).toBe(true);
  });
});

describe('play and pause', () => {
  it('plays, emits frame events as frames change, and pauses', () => {
    const p = create();
    const events: string[] = [];
    p.on('play', () => events.push('play'));
    p.on('pause', () => events.push('pause'));
    p.on('frame', ({ frame }) => events.push(`frame ${frame}`));

    p.play();
    expect(fake.animations.every((a) => a.playState === 'running')).toBe(true);
    clock.advance(50);
    clock.advance(60);
    clock.advance(200);
    expect(p.frame).toBe(4);
    p.pause();

    expect(events).toEqual(['play', 'frame 2', 'frame 4', 'pause']);
    expect(p.playing).toBe(false);
    expect(fake.animations.every((a) => a.playState === 'paused' && a.currentTime === 310)).toBe(true);
    expect(clock.pendingFrames).toBe(0);
  });

  it('keeps the time while paused', () => {
    const p = create();
    p.play();
    clock.advance(250);
    p.pause();
    clock.time += 5000;
    expect(p.frame).toBe(3);
    p.play();
    expect(times(fake.animations)).toEqual([250, 250]);
  });

  it('ignores play while playing and pause while paused', () => {
    const p = create();
    const listener = jest.fn();
    p.on('play', listener);
    p.on('pause', listener);
    p.pause();
    p.play();
    p.play();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('end of the timeline', () => {
  it('stops on the last frame and emits complete', () => {
    const p = create();
    const events: string[] = [];
    p.on('frame', ({ frame }) => events.push(`frame ${frame}`));
    p.on('complete', () => events.push('complete'));
    p.play();
    clock.advance(950);
    clock.advance(100);
    expect(events).toEqual(['frame 10', 'complete']);
    expect(p.playing).toBe(false);
    expect(p.frame).toBe(10);
    expect(times(fake.animations)).toEqual([1000, 1000]);
    expect(clock.pendingFrames).toBe(0);
  });

  it('restarts from frame 1 when played again after the end', () => {
    const p = create();
    p.play();
    clock.advance(2000);
    p.play();
    expect(times(fake.animations)).toEqual([0, 0]);
    expect(p.frame).toBe(1);
  });

  it('loops back to frame 1 and keeps playing with loop', () => {
    const p = create(makeDoc(), { loop: true });
    const events: string[] = [];
    p.on('loop', () => events.push('loop'));
    p.on('complete', () => events.push('complete'));
    p.on('frame', ({ frame }) => events.push(`frame ${frame}`));
    p.play();
    clock.advance(1000);
    expect(events).toEqual(['loop', 'frame 1']);
    expect(p.playing).toBe(true);
    expect(times(fake.animations)).toEqual([0, 0]);
    clock.advance(100);
    expect(events).toEqual(['loop', 'frame 1', 'frame 2']);
  });

  it('applies a loop change during playback', () => {
    const p = create();
    p.play();
    p.loop = true;
    clock.advance(1000);
    expect(p.playing).toBe(true);
    p.loop = false;
    clock.advance(1000);
    expect(p.playing).toBe(false);
  });
});

describe('seek', () => {
  it('moves every animation to the start of the frame and emits frame', () => {
    const p = create();
    const frames: number[] = [];
    p.on('frame', ({ frame }) => frames.push(frame));
    p.seek(6);
    expect(times(fake.animations)).toEqual([500, 500]);
    expect(p.frame).toBe(6);
    p.seek(6);
    expect(frames).toEqual([6, 6]);
  });

  it('clamps to the timeline', () => {
    const p = create();
    p.seek(0);
    expect(p.frame).toBe(1);
    p.seek(99);
    expect(p.frame).toBe(10);
    expect(times(fake.animations)).toEqual([900, 900]);
  });

  it('keeps playing from the new frame', () => {
    const p = create();
    p.play();
    clock.advance(100);
    p.seek(8);
    clock.advance(100);
    expect(p.frame).toBe(9);
    expect(p.playing).toBe(true);
  });

  it('throws for a non-finite frame', () => {
    expect(() => create().seek(Number.NaN)).toThrow('Frame must be a finite number');
  });
});

describe('speed', () => {
  it('sets the playback rate and speeds the clock', () => {
    const p = create(makeDoc(), { speed: 2 });
    expect(fake.animations.every((a) => a.playbackRate === 2)).toBe(true);
    p.play();
    clock.advance(100);
    expect(p.frame).toBe(3);
  });

  it('changes speed during playback from the current time', () => {
    const p = create();
    p.play();
    clock.advance(200);
    p.speed = 0.5;
    clock.advance(200);
    expect(p.frame).toBe(4);
    expect(p.speed).toBe(0.5);
    expect(fake.animations.every((a) => a.playbackRate === 0.5)).toBe(true);
  });

  it('refuses a speed of 0 or less', () => {
    const p = create();
    expect(() => {
      p.speed = 0;
    }).toThrow('Speed must be a finite number above 0');
  });
});

describe('update', () => {
  it('rebuilds the animations and keeps the time and play state', () => {
    const p = create();
    p.play();
    clock.advance(300);
    const old = [...fake.animations];
    const frames: number[] = [];
    p.on('frame', ({ frame }) => frames.push(frame));
    const doc = makeDoc();
    p.update({ ...doc, layers: [doc.layers[0]] });
    expect(old.every((a) => a.playState === 'idle')).toBe(true);
    const fresh = fake.animations.slice(old.length);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].currentTime).toBe(300);
    expect(fresh[0].playState).toBe('running');
    expect(frames).toEqual([4]);
    expect(p.missingTargets).toEqual([]);
  });

  it('clamps the time to a shorter document', () => {
    const p = create();
    p.seek(9);
    p.update(makeDoc({ settings: { fps: 10, totalFrames: 10 }, layers: [] }));
    p.update({ version: '2.0.0', settings: { fps: 10, totalFrames: 5 }, layers: [] });
    expect(p.frame).toBe(5);
  });

  it('refuses an invalid document and keeps the old one', () => {
    const p = create();
    expect(() => p.update(makeDoc({ settings: { fps: 10, totalFrames: 3 } }))).toThrow('Invalid timeline document');
    expect(p.totalFrames).toBe(10);
    expect(fake.animations.every((a) => a.playState === 'paused')).toBe(true);
  });
});

describe('listeners and destroy', () => {
  it('removes a listener with off or with the returned function', () => {
    const p = create();
    const a = jest.fn();
    const b = jest.fn();
    const removeB = p.on('frame', b);
    p.on('frame', a);
    p.off('frame', a);
    removeB();
    p.seek(2);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('cancels animations, the frame loop and listeners', () => {
    const p = create();
    const listener = jest.fn();
    p.on('pause', listener);
    p.play();
    p.destroy();
    expect(fake.animations.every((a) => a.playState === 'idle')).toBe(true);
    expect(clock.pendingFrames).toBe(0);
    expect(p.playing).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    p.destroy();
  });

  it.each([
    ['play', (p: IPlayer) => p.play()],
    ['pause', (p: IPlayer) => p.pause()],
    ['seek', (p: IPlayer) => p.seek(1)],
    ['update', (p: IPlayer) => p.update(makeDoc())]
  ])('throws on %s after destroy', (_name, call) => {
    const p = create();
    p.destroy();
    expect(() => call(p)).toThrow('The player was destroyed.');
  });
});

/** A layer whose element has no `Element.animate` (the failure used by the rollback tests). */
function layerWithoutAnimate(): ILayer {
  const element = document.createElement('div');
  Object.defineProperty(element, 'animate', { value: undefined });
  return { id: 'bad', type: 'layer', name: 'B', target: { element }, spans: [{ id: 'sx', start: 1, end: 10, kind: 'blank' }] };
}

describe('robustness', () => {
  it('cancels the animations already created when a later target fails', () => {
    const doc = makeDoc();
    const bad = layerWithoutAnimate();
    expect(() => create({ ...doc, layers: [doc.layers[0], bad] })).toThrow('The Web Animations API (Element.animate) is not available.');
    expect(fake.animations).toHaveLength(1);
    expect(fake.animations[0].playState).toBe('idle');
  });

  it('keeps the old document and animations when update fails on a target', () => {
    const p = create();
    p.play();
    clock.advance(200);
    const doc = makeDoc();
    const bad = layerWithoutAnimate();
    expect(() => p.update({ ...doc, layers: [doc.layers[0], bad] })).toThrow('The Web Animations API (Element.animate) is not available.');
    // The layer dropped by the refused document was released, so the previous animations are rebuilt, running.
    expect(fake.animations.filter((a) => a.playState === 'running').map((a) => a.target)).toEqual([document.getElementById('box'), document.querySelector('.dot')]);
    expect(p.playing).toBe(true);
    clock.advance(100);
    expect(p.frame).toBe(4);
  });

  it('keeps playing when a listener throws, and reports the error', () => {
    const errors: unknown[] = [];
    const p = create(makeDoc(), { onListenerError: (error) => errors.push(error) });
    const boom = new Error('boom');
    p.on('frame', () => {
      throw boom;
    });
    p.play();
    clock.advance(100);
    clock.advance(100);
    expect(errors).toEqual([boom, boom]);
    expect(p.playing).toBe(true);
    expect(clock.pendingFrames).toBe(1);
  });

  it('rethrows listener errors asynchronously by default', () => {
    jest.useFakeTimers();
    try {
      const p = create();
      p.on('frame', () => {
        throw new Error('late');
      });
      expect(() => p.seek(2)).not.toThrow();
      expect(() => jest.runOnlyPendingTimers()).toThrow('late');
    } finally {
      jest.useRealTimers();
    }
  });

  it('completes when paused past the end before the frame loop noticed', () => {
    const p = create();
    p.play();
    clock.time += 1500;
    p.pause();
    expect(p.frame).toBe(10);
    expect(times(fake.animations)).toEqual([1000, 1000]);
    p.play();
    expect(p.frame).toBe(1);
  });

  it('keeps the overshoot when looping', () => {
    const p = create(makeDoc(), { loop: true });
    p.play();
    clock.advance(1250);
    expect(p.frame).toBe(3);
    expect(times(fake.animations)).toEqual([250, 250]);
  });

  it('does not restart finished animations when update shortens the document while playing', () => {
    const p = create();
    p.play();
    clock.advance(800);
    const doc = makeDoc();
    p.update({
      ...doc,
      settings: { fps: 10, totalFrames: 5 },
      layers: [{ id: 'box', type: 'layer', name: 'Box', target: { selector: '#box' }, spans: [{ id: 's1', start: 1, end: 5, kind: 'static', tracks: { x: [{ frame: 1, value: 1 }] } }] }]
    });
    const fresh = fake.animations[fake.animations.length - 1];
    expect(fresh.playState).toBe('paused');
    expect(fresh.currentTime).toBe(500);
    const complete = jest.fn();
    p.on('complete', complete);
    clock.advance(16);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('keeps a single frame loop when a listener pauses and plays during a tick', () => {
    const p = create();
    let toggled = false;
    p.on('frame', () => {
      if (!toggled) {
        toggled = true;
        p.pause();
        p.play();
      }
    });
    p.play();
    clock.advance(100);
    expect(clock.pendingFrames).toBe(1);
    p.pause();
    expect(clock.pendingFrames).toBe(0);
  });

  it('stops the frame loop when a listener pauses during a tick', () => {
    const p = create();
    p.on('frame', () => p.pause());
    p.play();
    clock.advance(100);
    expect(p.playing).toBe(false);
    expect(clock.pendingFrames).toBe(0);
  });

  it.each([
    ['loop', (p: IPlayer) => {
      p.loop = true;
    }],
    ['speed', (p: IPlayer) => {
      p.speed = 2;
    }],
    ['on', (p: IPlayer) => p.on('frame', () => undefined)]
  ])('throws on %s after destroy', (_name, call) => {
    const p = create();
    p.destroy();
    expect(() => call(p)).toThrow('The player was destroyed.');
  });
});

describe('player entry point', () => {
  it('exports the player values', () => {
    expect(Object.keys(player).sort()).toEqual([
      'EventEmitter',
      'Player',
      'buildLayerKeyframes',
      'createBrowserClock',
      'createPlayer',
      'frameToOffset',
      'resolveTarget'
    ]);
  });

  it('is re-exported by the package', () => {
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining(Object.keys(player)));
  });
});
