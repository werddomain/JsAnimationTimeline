// packages/runtime/src/stage/__tests__/StageHost.review.test.ts
/**
 * Cas limites relevés en revue : document refusé avec plusieurs scènes
 * pendant la lecture (waapi et frame), styles périmés en mode `frame`,
 * `onError` qui lève ou détruit pendant un chargement, changement de cibles
 * pendant un chargement, contexte effacé au `detach`.
 */

import type { ILayer } from '../../model/layer';
import { installFakeAnimate } from '../../player/__tests__/fakes';
import { createPlayer } from '../../player/Player';
import type { IPlayer } from '../../player/types';
import { createManualClock } from '../../transport/manualClock';
import type { IManualClock } from '../../transport/manualClock';
import { createHtmlStage } from '../html/createHtmlStage';
import { StageDocumentError } from '../reports';
import { StageHost } from '../StageHost';
import { defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import type { IStage, IStageContext } from '../types';
import { createFakeStage, createHost, docOf, refLayer, timeAt } from './fakeStage';
import type { IFakeObject } from './fakeStage';

let fake: ReturnType<typeof installFakeAnimate>;
let clock: IManualClock;
let players: IPlayer[];

beforeEach(() => {
  document.body.innerHTML = '<div id="box" style="color: red"></div>';
  fake = installFakeAnimate();
  clock = createManualClock();
  players = [];
});

afterEach(() => {
  players.forEach((p) => p.destroy());
  fake.restore();
});

function box(): HTMLElement {
  return document.getElementById('box') as HTMLElement;
}

function boxLayer(id: string, tracks: NonNullable<ILayer['spans'][number]['tracks']>): ILayer {
  return { id, type: 'layer', name: id, target: { selector: '#box' }, spans: [{ id: `${id}-s`, start: 1, end: 10, kind: 'tween', tracks }] };
}

/** A stage refusing every document that holds a layer for it once `refuse` is on. */
function refusingStage(state: { refuse: boolean }): IStage<IFakeObject> {
  const base = createFakeStage('canvas');
  base.objects.set('hero', { name: 'Hero' });
  return {
    ...base.stage,
    update(_doc, layers) {
      if (state.refuse && layers.length > 0) {
        throw new StageDocumentError('refused');
      }
    }
  };
}

const MOVE = { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] };

describe('refused document with several stages', () => {
  it('realigns re-updated waapi animations on the playing transport', () => {
    const state = { refuse: false };
    const p = createPlayer(docOf([boxLayer('a', MOVE)]), { clock, stage: [createHtmlStage({ mode: 'waapi' }), refusingStage(state)] });
    players.push(p);
    p.play();
    clock.advance(300);
    state.refuse = true;
    expect(() => p.update(docOf([boxLayer('a', { x: [{ frame: 1, value: 5 }] }), refLayer('h', 'hero', 'canvas')]))).toThrow('refused');
    const live = fake.animations.filter((a) => a.playState !== 'idle');
    expect(live).toHaveLength(1);
    expect(live[0].keyframes[0]).toMatchObject({ transform: expect.stringContaining('translateX(0px)') });
    expect(live[0].playState).toBe('running');
    expect(live[0].currentTime).toBe(p.time.timeMs);
    expect(p.time.timeMs).toBe(300);
  });

  it('rewrites the frame-mode styles of the previous document', () => {
    const state = { refuse: false };
    const p = createPlayer(docOf([boxLayer('a', MOVE)]), { clock, stage: [createHtmlStage({ mode: 'frame' }), refusingStage(state)] });
    players.push(p);
    p.seek(4);
    state.refuse = true;
    expect(() => p.update(docOf([refLayer('h', 'hero', 'canvas')]))).toThrow('refused');
    expect(box().style.getPropertyValue('transform')).toContain('translateX(30px)');
    expect(box().style.getPropertyValue('color')).toBe('red');
  });
});

describe('frame mode across documents', () => {
  it('drops the inline values of tracks and visibility a kept layer no longer has', () => {
    const first: ILayer = {
      ...boxLayer('a', MOVE),
      spans: [
        { id: 's1', start: 1, end: 5, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.5 }] } },
        { id: 's2', start: 6, end: 10, kind: 'blank' }
      ]
    };
    const p = createPlayer(docOf([first]), { clock, stage: createHtmlStage({ mode: 'frame' }) });
    players.push(p);
    p.seek(7);
    expect(box().style.getPropertyValue('opacity')).toBe('0.5');
    expect(box().style.getPropertyValue('visibility')).toBe('hidden');
    p.update(docOf([boxLayer('a', MOVE)]));
    expect(box().style.getPropertyValue('opacity')).toBe('');
    expect(box().style.getPropertyValue('visibility')).toBe('');
    expect(box().style.getPropertyValue('transform')).toContain('translateX(60px)');
    expect(box().style.getPropertyValue('color')).toBe('red');
  });
});

describe('onError that throws or destroys', () => {
  it('rethrows a throwing onError asynchronously and finishes the load', () => {
    jest.useFakeTimers();
    try {
      const a = createFakeStage('a', { unscoped: true });
      a.objects.set('x', { name: 'X' });
      const broken: IStage<IFakeObject> = { ...a.stage, attach: () => {
        throw new Error('attach');
      } };
      const host = new StageHost({
        stages: [broken],
        registry: defaultPropertyRegistry,
        onError: () => {
          throw new Error('handler');
        },
        onReport: () => {
          throw new Error('report handler');
        },
        now: () => ({ time: timeAt(1), state: { playing: false, speed: 1 } })
      });
      expect(() => host.load(docOf([refLayer('l1', 'x')]))).not.toThrow();
      expect(a.calls).toEqual(['resolve x', 'update l1']);
      expect(() => jest.runOnlyPendingTimers()).toThrow(/handler/);
    } finally {
      jest.useRealTimers();
    }
  });

  it('resolves, updates and renders nothing more once onError destroyed the host', () => {
    const a = createFakeStage('a', { unscoped: true });
    a.objects.set('x', { name: 'X' });
    a.objects.set('y', { name: 'Y' });
    const broken: IStage<IFakeObject> = {
      ...a.stage,
      resolve(target) {
        const object = a.stage.resolve(target);
        if (object?.name === 'X') {
          throw new Error('resolve');
        }
        return object;
      }
    };
    const destroying = new StageHost({
      stages: [broken],
      registry: defaultPropertyRegistry,
      onError: () => destroying.destroy(),
      now: () => ({ time: timeAt(1), state: { playing: false, speed: 1 } })
    });
    destroying.load(docOf([refLayer('l1', 'x'), refLayer('l2', 'y')]));
    expect(a.calls).toEqual(['attach', 'resolve x', 'detach']);
    destroying.render(timeAt(2));
    expect(a.calls).toHaveLength(3);
  });

  it('stops a player update when onError destroys the player', () => {
    const a = createFakeStage('a', { unscoped: true });
    let p: IPlayer | null = null;
    const broken: IStage<IFakeObject> = { ...a.stage, update: (_doc, layers) => {
      if (layers.length === 0 && p !== null) {
        throw new Error('update');
      }
    } };
    p = createPlayer(docOf([refLayer('l1', 'none')]), { clock, stage: broken, onListenerError: () => p?.destroy() });
    a.objects.set('none', { name: 'N' });
    expect(() => p?.update(docOf([]))).not.toThrow();
    expect(() => p?.play()).toThrow('The player was destroyed.');
  });
});

describe('targets changed during a load', () => {
  it('defers the retry until the load ends', () => {
    const a = createFakeStage('a', { unscoped: true, subscribe: true });
    const notifying: IStage<IFakeObject> = {
      ...a.stage,
      resolve(target) {
        const object = a.stage.resolve(target);
        if (object === null) {
          a.objects.set('late', { name: 'Late' });
          a.notify();
        }
        return object;
      }
    };
    const host = createHost([notifying]);
    host.load(docOf([refLayer('l1', 'late')]));
    expect(a.calls).toEqual(['attach', 'subscribe', 'resolve late', 'update ', 'resolve late', 'update l1', 'sync paused', 'render 1']);
    expect(host.missingTargets).toEqual([]);
  });
});

describe('HTML stage detach', () => {
  it('forgets its context', () => {
    const stage = createHtmlStage({ mode: 'frame' });
    const report = jest.fn();
    const ctx: IStageContext = { registry: defaultPropertyRegistry, report, error: jest.fn() };
    stage.attach?.(ctx);
    stage.detach?.();
    const layer = boxLayer('a', MOVE);
    stage.update?.(docOf([layer, { ...layer, id: 'b' }]), [
      { layerId: 'a', layer, target: { selector: '#box' }, object: box() },
      { layerId: 'b', layer, target: { selector: '#box' }, object: box() }
    ]);
    expect(report).not.toHaveBeenCalled();
    const waapi = createHtmlStage();
    waapi.attach?.(ctx);
    waapi.detach?.();
    waapi.update?.(docOf([layer]), [
      { layerId: 'a', layer, target: { selector: '#box' }, object: box() },
      { layerId: 'b', layer, target: { selector: '#box' }, object: box() }
    ]);
    expect(report).not.toHaveBeenCalled();
  });
});
