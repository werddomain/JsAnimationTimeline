// packages/runtime/src/player/__tests__/PlayerStage.test.ts
/**
 * Lecteur et scènes : option `stage`, sync et render branchés sur le
 * transport, propriétés des scènes, `refreshTargets`, `warnings`, erreurs de
 * scène, fin, et un test de performance (200 calques).
 */

import * as runtime from '../../index';
import type { ILayer } from '../../model/layer';
import { createManualClock } from '../../transport/manualClock';
import type { IManualClock } from '../../transport/manualClock';
import { StageDocumentError } from '../../stage/reports';
import type { IStage, IStageAbortSignal } from '../../stage/types';
import { createFakeStage, docOf, refLayer } from '../../stage/__tests__/fakeStage';
import type { IFakeObject } from '../../stage/__tests__/fakeStage';
import { createPlayer } from '../Player';
import type { IPlayer, IPlayerOptions } from '../types';

let clock: IManualClock;
let players: IPlayer[];

function create(layers: ILayer[], options: IPlayerOptions): IPlayer {
  const player = createPlayer(docOf(layers), { clock, ...options });
  players.push(player);
  return player;
}

beforeEach(() => {
  clock = createManualClock();
  players = [];
});

afterEach(() => players.forEach((p) => p.destroy()));

describe('stage option', () => {
  it('syncs and renders the current frame at creation, then on every tick', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('hero', { name: 'Hero' });
    const p = create([refLayer('l1', 'hero')], { stage: fake.stage });
    expect(fake.calls).toEqual(['attach', 'resolve hero', 'update l1', 'sync paused', 'render 1']);
    p.play();
    clock.advance(150);
    clock.advance(100);
    expect(fake.calls.slice(5)).toEqual(['sync playing', 'render 1', 'render 1']);
    expect(fake.renders[2].time.frame).toBeCloseTo(3.5);
    expect(fake.renders[2].states[0].values.x).toBeCloseTo(25);
  });

  it('syncs on pause, seek, speed, loop and update', () => {
    const fake = createFakeStage('audio', { render: false, unscoped: true });
    const p = create([], { stage: fake.stage, loop: true });
    fake.calls.length = 0;
    p.play();
    p.speed = 2;
    p.seek(4);
    clock.advance(1000);
    p.pause();
    p.update(docOf([]));
    expect(fake.calls).toEqual(['sync playing', 'sync playing', 'sync playing', 'sync playing', 'sync paused', 'update ', 'sync paused']);
    expect(fake.syncs[2].state.speed).toBe(2);
  });

  it('routes between several stages and adds their properties to the registry', () => {
    const volume = { name: 'volume', kind: 'value' as const, unit: '', defaultValue: 1 };
    const audio = createFakeStage('audio', { properties: [volume] });
    const canvas = createFakeStage('canvas', { unscoped: true });
    audio.objects.set('music', { name: 'Music' });
    canvas.objects.set('hero', { name: 'Hero' });
    const music = refLayer('music', 'music', 'audio', { volume: [{ frame: 1, value: 0 }, { frame: 10, value: 0.9 }] });
    const p = create([refLayer('hero', 'hero'), music], { stage: [audio.stage, canvas.stage] });
    p.seek(10);
    expect(audio.renders[audio.renders.length - 1].states[0]).toMatchObject({ layerId: 'music', values: { volume: 0.9 } });
    expect(canvas.renders[canvas.renders.length - 1].states.map((s) => s.layerId)).toEqual(['hero']);
    expect(audio.ctx?.registry.has('volume')).toBe(true);
    expect(runtime.defaultPropertyRegistry.has('volume')).toBe(false);
  });

  it('refuses root with stage, an empty stage list and duplicate stage ids', () => {
    const stage = createFakeStage('canvas').stage;
    expect(() => create([], { stage, root: document })).toThrow('Pass either root or stage to createPlayer, not both.');
    expect(() => create([], { stage: [] })).toThrow('The stage option needs at least one stage.');
    expect(() => create([], { stage: [stage, createFakeStage('canvas').stage] })).toThrow('Two stages have the id "canvas".');
  });

  it('validates the stages before building the registry, with a clear error', () => {
    const notTypeError = (options: IPlayerOptions, message: string): void => {
      let thrown: unknown = null;
      try {
        create([], options);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toEqual(new Error(message));
      expect(thrown).not.toBeInstanceOf(TypeError);
    };
    notTypeError({ stage: null as unknown as IStage }, 'Stage #0 must be an object.');
    notTypeError({ stage: [createFakeStage('canvas').stage, 42 as unknown as IStage] }, 'Stage #1 must be an object.');
  });

  it('lists missing targets and warnings, reset per document, and refreshes targets', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    const p = create([refLayer('l1', 'late'), refLayer('l2', 'x', 'nowhere')], { stage: fake.stage });
    expect(p.missingTargets).toEqual(['l1', 'l2']);
    expect(p.warnings.map((w) => w.code)).toEqual(['unknown-stage']);
    fake.objects.set('late', { name: 'Late' });
    p.refreshTargets('l2');
    expect(p.missingTargets).toEqual(['l1', 'l2']);
    p.refreshTargets();
    expect(p.missingTargets).toEqual(['l2']);
    p.update(docOf([refLayer('l1', 'late')]));
    expect(p.warnings).toEqual([]);
    p.destroy();
    expect(() => p.refreshTargets()).toThrow('The player was destroyed.');
  });

  it('reports the first error of a stage to onListenerError and keeps playing', () => {
    const errors: unknown[] = [];
    const fake = createFakeStage('canvas', { unscoped: true });
    const stage: IStage<IFakeObject> = {
      ...fake.stage,
      render: () => {
        throw new Error('draw failed');
      }
    };
    const p = create([], { stage, onListenerError: (error) => errors.push(error) });
    p.play();
    clock.advance(100);
    clock.advance(100);
    expect(errors).toEqual([new Error('draw failed')]);
    expect(p.warnings.map((w) => w.code)).toEqual(['stage-error']);
    expect(p.frame).toBe(3);
    expect(p.playing).toBe(true);
  });

  it('releases every layer then detaches on destroy, without touching the objects', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    const hero = Object.freeze({ name: 'Hero' });
    fake.objects.set('hero', hero);
    const p = create([refLayer('l1', 'hero')], { stage: fake.stage });
    fake.calls.length = 0;
    p.destroy();
    expect(fake.calls).toEqual(['release l1 Hero', 'detach']);
  });

  it('throws a document refused at creation and stops everything', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    const stage: IStage<IFakeObject> = {
      ...fake.stage,
      update: () => {
        throw new StageDocumentError('no way');
      }
    };
    expect(() => create([], { stage, autoplay: true })).toThrow('no way');
    expect(fake.calls).toEqual(['attach', 'detach']);
    expect(clock.pendingFrames).toBe(0);
  });

  it('keeps the previous document when update is refused', () => {
    let refuse = false;
    const fake = createFakeStage('canvas', { unscoped: true });
    const stage: IStage<IFakeObject> = {
      ...fake.stage,
      update: () => {
        if (refuse) {
          throw new StageDocumentError('no way');
        }
      }
    };
    const p = create([], { stage });
    refuse = true;
    expect(() => p.update(docOf([], 5))).toThrow('no way');
    expect(p.totalFrames).toBe(10);
  });
});

describe('types', () => {
  it('accepts a typed stage and a DOM AbortSignal', () => {
    interface ISprite { x: number }
    const sprite: ISprite = { x: 0 };
    const typed: IStage<ISprite> = {
      id: 'sprites',
      accepts: runtime.refStage('sprites'),
      resolve: () => sprite,
      render(_time, states) {
        states.forEach((s) => {
          s.object.x = s.values.x;
        });
      }
    };
    const p = create([refLayer('l1', 'a', 'sprites')], { stage: typed });
    p.seek(10);
    expect(sprite.x).toBe(90);
    const signal: IStageAbortSignal = new AbortController().signal;
    expect(signal.aborted).toBe(false);
  });
});

describe('performance', () => {
  it('renders 200 layers for 300 frames within a generous budget', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('a', { name: 'A' });
    const layers = Array.from({ length: 200 }, (_, i): ILayer => ({
      ...refLayer(`l${i}`, 'a'),
      spans: [
        { id: `s${i}a`, start: 1, end: 150, kind: 'tween', easing: 'ease-in-out', tracks: { x: [{ frame: 1, value: 0 }, { frame: 150, value: i }], opacity: [{ frame: 1, value: 0 }, { frame: 80, value: 1 }] } },
        { id: `s${i}b`, start: 151, end: 300, kind: 'tween', tracks: { y: [{ frame: 151, value: 0 }, { frame: 300, value: 50 }] } }
      ]
    }));
    const p = createPlayer({ version: '2.0.0', settings: { fps: 60, totalFrames: 300 }, layers }, { clock, stage: fake.stage });
    players.push(p);
    const started = Date.now();
    p.play();
    for (let frame = 0; frame < 300; frame++) {
      clock.advance(1000 / 60);
    }
    const elapsed = Date.now() - started;
    expect(fake.renders.length).toBeGreaterThanOrEqual(300);
    expect(fake.renders[150].states).toHaveLength(200);
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('package entry point', () => {
  it('exports the stage API', () => {
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining([
      'createHtmlStage', 'HTML_STAGE_ID', 'TARGET_ATTRIBUTE', 'refStage', 'sameTarget', 'StageHost',
      'StageDocumentError', 'isStageDocumentError', 'StageReportCodes', 'buildStageRegistry'
    ]));
    expect(runtime.isStageDocumentError(new StageDocumentError('x'))).toBe(true);
    expect(runtime.isStageDocumentError(new Error('x'))).toBe(false);
  });
});
