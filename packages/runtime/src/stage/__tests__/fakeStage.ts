// packages/runtime/src/stage/__tests__/fakeStage.ts
/**
 * Doubles de test des scènes : une fausse scène qui note chaque appel, des
 * documents à calques `{ ref }` et un hôte prêt à l'emploi.
 */

import type { ITimelineDocument } from '../../model/document';
import { isRefTarget } from '../../model/guards';
import type { ILayer } from '../../model/layer';
import type { PropertyTracks } from '../../model/span';
import type { LayerTarget } from '../../model/target';
import { defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import type { PropertyDescriptor } from '../../properties/types';
import type { ITransportSyncState, ITransportTime } from '../../transport/types';
import { refStage } from '../routing';
import { StageHost } from '../StageHost';
import type { IStageHostClock } from '../StageHost';
import type { IStage, IStageContext, IStageLayer, IStageLayerState, IStageTargets } from '../types';

/** Object animated by a fake stage. */
export interface IFakeObject {
  readonly name: string;
}

/** Options of `createFakeStage`. */
export interface IFakeStageOptions {
  readonly unscoped?: boolean;
  readonly sync?: boolean;
  readonly render?: boolean;
  readonly subscribe?: boolean;
  readonly properties?: readonly PropertyDescriptor[];
  /** Overrides `accepts`. */
  readonly accepts?: (target: LayerTarget) => boolean;
}

/** A fake stage and what it saw. */
export interface IFakeStage {
  readonly stage: IStage<IFakeObject>;
  /** Objects by ref; `resolve` returns `null` for an absent ref. */
  readonly objects: Map<string, IFakeObject>;
  readonly calls: string[];
  readonly renders: Array<{ time: ITransportTime; states: readonly IStageLayerState<IFakeObject>[] }>;
  readonly syncs: Array<{ time: ITransportTime; state: ITransportSyncState }>;
  readonly updates: Array<readonly IStageLayer<IFakeObject>[]>;
  ctx: IStageContext | null;
  /** Calls the `targets.subscribe` listeners, with `affected` when given. */
  notify(affected?: readonly LayerTarget[]): void;
  readonly subscribers: Set<(affected?: readonly LayerTarget[]) => void>;
}

function refOf(target: LayerTarget): string {
  return isRefTarget(target) ? target.ref : '?';
}

/** Creates a fake stage of id `id` accepting `{ ref, stage: id }` (and `{ ref }` when unscoped). */
export function createFakeStage(id: string, options: IFakeStageOptions = {}): IFakeStage {
  const fake: IFakeStage = {
    objects: new Map(),
    calls: [],
    renders: [],
    syncs: [],
    updates: [],
    ctx: null,
    subscribers: new Set(),
    notify: (affected) => Array.from(fake.subscribers).forEach((listener) => listener(affected)),
    stage: undefined as unknown as IStage<IFakeObject>
  };
  const stage: IStage<IFakeObject> = {
    id,
    properties: options.properties,
    accepts: options.accepts ?? refStage(id, { unscoped: options.unscoped }),
    resolve(target) {
      fake.calls.push(`resolve ${refOf(target)}`);
      return fake.objects.get(refOf(target)) ?? null;
    },
    attach(ctx) {
      fake.ctx = ctx;
      fake.calls.push('attach');
    },
    update(_doc, layers) {
      fake.updates.push(layers);
      fake.calls.push(`update ${layers.map((l) => l.layerId).join(',')}`);
    },
    release(layerId, object) {
      fake.calls.push(`release ${layerId} ${object.name}`);
    },
    detach() {
      fake.calls.push('detach');
    }
  };
  if (options.sync !== false) {
    stage.sync = (time, state) => {
      fake.syncs.push({ time, state });
      fake.calls.push(`sync ${state.playing ? 'playing' : 'paused'}`);
    };
  }
  if (options.render !== false) {
    stage.render = (time, states) => {
      fake.renders.push({ time, states });
      fake.calls.push(`render ${states.length}`);
    };
  }
  const targets: IStageTargets = {
    list: () => [],
    subscribe: (listener: (affected?: readonly LayerTarget[]) => void) => {
      fake.subscribers.add(listener);
      fake.calls.push('subscribe');
      return () => {
        fake.subscribers.delete(listener);
        fake.calls.push('unsubscribe');
      };
    }
  };
  const withTargets: IStage<IFakeObject> = options.subscribe === true ? { ...stage, targets } : stage;
  (fake as { stage: IStage<IFakeObject> }).stage = withTargets;
  return fake;
}

/** A layer with a `{ ref, stage? }` target. */
export function refLayer(id: string, ref: string, stage?: string, tracks: PropertyTracks = { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] }): ILayer {
  const target: LayerTarget = stage === undefined ? { ref } : { ref, stage };
  return { id, type: 'layer', name: id, target, spans: [{ id: `${id}-s`, start: 1, end: 10, kind: 'tween', tracks }] };
}

/** A 10-frame document at 10 fps. */
export function docOf(layers: readonly ILayer[], totalFrames = 10): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 10, totalFrames }, layers };
}

/** Time of an integer frame at 10 fps. */
export function timeAt(frame: number): ITransportTime {
  return { timeMs: (frame - 1) * 100, frame, integerFrame: Math.floor(frame) };
}

/** A host on `stages`, collecting the reported errors. */
export function createHost(stages: readonly IStage[], errors: unknown[] = [], clock?: IStageHostClock): StageHost {
  return new StageHost({
    stages,
    registry: defaultPropertyRegistry,
    onError: (error) => errors.push(error),
    now: () => clock ?? { time: timeAt(1), state: { playing: false, speed: 1 } }
  });
}
