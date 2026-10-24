// packages/runtime/src/stage/StageHost.ts
/**
 * Cycle de vie des scènes, sans DOM (lecteur, puis éditeur en C7) :
 * 1. `attach` une seule fois (et abonnement à `targets.subscribe`) ;
 * 2. à chaque document, les calques sont comparés par id et par cible ;
 * 3. calque supprimé ou cible changée : `release(layerId, ancienObjet)`, puis
 *    un nouveau `resolve` ;
 * 4. `resolve` est mis en cache ; un échec (`null`) est retenu et réessayé sur
 *    `targets.subscribe` ou `refresh(layerId?)`, jamais à chaque image ;
 * 5. puis `update(doc, calquesLiés)` ; le propriétaire appelle ensuite `sync`
 *    et `render` de l'image courante ;
 * 6. fin : `release` de chaque calque, puis `detach`.
 * Une `StageDocumentError` levée par `update` annule le document (retour au
 * précédent) et remonte ; toute autre erreur est signalée par `StageReporter`.
 */

import { collectLayers } from '../evaluate/evaluateDocument';
import type { ITimelineDocument } from '../model/document';
import type { ILayer } from '../model/layer';
import type { LayerTarget } from '../model/target';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { ITransportSyncState, ITransportTime } from '../transport/types';
import { evaluateStageLayers, prepareStageLayer } from './frameStates';
import { isStageDocumentError, StageReportCodes } from './reports';
import type { IStageReport } from './reports';
import { assertValidStages, routeTarget, sameTarget } from './routing';
import { StageReporter } from './StageReporter';
import type { StageErrorHandler } from './StageReporter';
import type { IStage, IStageContext, IStageLayer } from './types';

/** Current position and play state, read when targets are refreshed. */
export interface IStageHostClock {
  readonly time: ITransportTime;
  readonly state: ITransportSyncState;
}

/** Options of `StageHost`. */
export interface IStageHostOptions {
  readonly stages: readonly IStage[];
  /** Registry handed to the stages and used to evaluate (already holds the stages' properties). */
  readonly registry: PropertyRegistry;
  /** Receives the errors thrown by the stages (first per stage and per layer). */
  readonly onError: StageErrorHandler;
  /** Called for every new report. */
  readonly onReport?: (report: IStageReport) => void;
  /** Current time and play state, to re-apply a stage after a refresh. */
  readonly now: () => IStageHostClock;
}

/** A routed layer and its cached resolution (`object` null: resolution failed). */
interface IBinding {
  readonly layerId: string;
  readonly target: LayerTarget;
  readonly stage: IStage;
  readonly object: unknown;
  readonly resolved: boolean;
}

/** What `load` changes, saved to roll back a refused document. */
interface IHostState {
  readonly doc: ITimelineDocument | null;
  readonly bindings: ReadonlyMap<string, IBinding>;
  readonly prepared: ReadonlyMap<string, ILayer>;
}

/** See the module comment. */
export class StageHost {
  private readonly stages: readonly IStage[];
  private readonly registry: PropertyRegistry;
  private readonly reporter: StageReporter;
  private readonly now: () => IStageHostClock;
  private doc: ITimelineDocument | null = null;
  private bindings = new Map<string, IBinding>();
  /** Layers of the document without their unknown tracks, by id (routed layers only). */
  private prepared = new Map<string, ILayer>();
  private stageLayers = new Map<IStage, IStageLayer[]>();
  private missing: readonly string[] = [];
  private unsubscribers: Array<{ readonly stageId: string; readonly unsubscribe: () => void }> = [];
  private attached = false;
  private destroyed = false;

  /** Throws for a malformed stage or a duplicate stage id. */
  constructor(options: IStageHostOptions) {
    assertValidStages(options.stages);
    this.stages = options.stages.slice();
    this.registry = options.registry;
    this.reporter = new StageReporter(options.onError, options.onReport);
    this.now = options.now;
  }

  /** Ids of the layers without a resolved object (no target, unknown stage, unrouted, resolve failed), in document order. */
  get missingTargets(): readonly string[] {
    return this.missing;
  }

  /** Reports of the current document. */
  get warnings(): readonly IStageReport[] {
    return this.reporter.list;
  }

  /**
   * Binds the layers of `doc` (see the module comment). Throws the
   * `StageDocumentError` of a stage after restoring the previous document.
   */
  load(doc: ITimelineDocument): void {
    this.assertAlive();
    const saved: IHostState = { doc: this.doc, bindings: new Map(this.bindings), prepared: this.prepared };
    const savedReports = this.reporter.save();
    this.reporter.reset();
    this.attach();
    const layers = collectLayers(doc);
    this.releaseStale(layers);
    this.prepared = new Map();
    layers.forEach((layer) => this.bindLayer(layer));
    this.doc = doc;
    this.refreshDerived();
    const updated: IStage[] = [];
    for (const stage of this.stages) {
      try {
        this.updateStage(stage, true);
        updated.push(stage);
      } catch (error) {
        this.rollback(saved, updated);
        this.reporter.restore(savedReports);
        throw error;
      }
    }
  }

  /** `sync` of every stage implementing it. */
  sync(time: ITransportTime, state: ITransportSyncState): void {
    this.stages.forEach((stage) => this.syncStage(stage, time, state));
  }

  /** Evaluates the layers of every stage implementing `render` and renders them, once per stage. */
  render(time: ITransportTime): void {
    this.stages.forEach((stage) => this.renderStage(stage, time));
  }

  /** Retries the failed resolutions (of `layerId` only when given); re-applies the stages that gained objects. */
  refresh(layerId?: string): void {
    this.assertAlive();
    this.retry((binding) => layerId === undefined || binding.layerId === layerId);
  }

  /** `release` of every resolved layer, then `detach`. Idempotent. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.bindings.forEach((binding) => this.release(binding));
    this.bindings.clear();
    this.unsubscribers.forEach(({ stageId, unsubscribe }) => this.reporter.guard(stageId, undefined, unsubscribe, undefined));
    this.unsubscribers = [];
    if (this.attached) {
      this.stages.forEach((stage) => this.reporter.guard(stage.id, undefined, () => stage.detach?.(), undefined));
    }
    this.stageLayers.clear();
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error('The stages were destroyed.');
    }
  }

  private attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    for (const stage of this.stages) {
      this.reporter.guard(stage.id, undefined, () => stage.attach?.(this.createContext(stage)), undefined);
      const subscribe = stage.targets?.subscribe;
      if (typeof subscribe === 'function') {
        const unsubscribe = this.reporter.guard(stage.id, undefined, () => subscribe.call(stage.targets, () => this.onTargetsChanged(stage)), undefined);
        if (typeof unsubscribe === 'function') {
          this.unsubscribers.push({ stageId: stage.id, unsubscribe });
        }
      }
    }
  }

  private createContext(stage: IStage): IStageContext {
    return {
      registry: this.registry,
      report: (report) => this.reporter.add({ ...report, stageId: stage.id }),
      error: (error, layerId) => this.reporter.error(stage.id, layerId, error)
    };
  }

  private onTargetsChanged(stage: IStage): void {
    if (!this.destroyed && this.doc !== null) {
      this.retry((binding) => binding.stage === stage);
    }
  }

  /** Releases the bindings whose layer is gone or whose target changed. */
  private releaseStale(layers: readonly ILayer[]): void {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    for (const [id, binding] of Array.from(this.bindings)) {
      const layer = byId.get(id);
      if (layer === undefined || !sameTarget(layer.target, binding.target)) {
        this.release(binding);
        this.bindings.delete(id);
      }
    }
  }

  /** Keeps the cached binding of `layer`, or routes and resolves it. */
  private bindLayer(layer: ILayer): void {
    const target = layer.target;
    if (target === undefined) {
      return;
    }
    let binding = this.bindings.get(layer.id);
    if (binding === undefined) {
      const route = routeTarget(target, this.stages, (stage, t) => this.reporter.guard(stage.id, layer.id, () => stage.accepts(t) === true, false));
      if (route.kind !== 'stage') {
        this.reportUnrouted(layer.id, route.kind === 'unknown-stage' ? route.stageId : undefined);
        return;
      }
      binding = this.resolve(layer.id, target, route.stage);
      this.bindings.set(layer.id, binding);
    }
    const stageId = binding.stage.id;
    this.prepared.set(layer.id, prepareStageLayer(layer, this.registry, (issue) => this.reporter.add({
      code: StageReportCodes.UNKNOWN_PROPERTY,
      stageId,
      layerId: issue.layerId,
      property: issue.property,
      message: issue.message
    })));
  }

  private reportUnrouted(layerId: string, stageId: string | undefined): void {
    if (stageId !== undefined) {
      this.reporter.add({ code: StageReportCodes.UNKNOWN_STAGE, stageId, layerId, message: `Layer "${layerId}" names the unknown stage "${stageId}".` });
    } else {
      this.reporter.add({ code: StageReportCodes.UNROUTED, layerId, message: `No stage accepts the target of layer "${layerId}".` });
    }
  }

  private resolve(layerId: string, target: LayerTarget, stage: IStage): IBinding {
    const object = this.reporter.guard(stage.id, layerId, () => stage.resolve(target), null);
    const resolved = object !== null && object !== undefined;
    return { layerId, target, stage, object: resolved ? object : null, resolved };
  }

  private release(binding: IBinding): void {
    if (binding.resolved) {
      this.reporter.guard(binding.stage.id, binding.layerId, () => binding.stage.release?.(binding.layerId, binding.object), undefined);
    }
  }

  /** Missing targets and per-stage layer lists, from the document and the bindings. */
  private refreshDerived(): void {
    const layers = this.doc === null ? [] : collectLayers(this.doc);
    this.missing = Object.freeze(layers.filter((layer) => this.bindings.get(layer.id)?.resolved !== true).map((layer) => layer.id));
    this.stageLayers = new Map(this.stages.map((stage) => [stage, [] as IStageLayer[]]));
    for (const layer of layers) {
      const binding = this.bindings.get(layer.id);
      const prepared = this.prepared.get(layer.id);
      if (binding !== undefined && binding.resolved && prepared !== undefined) {
        this.stageLayers.get(binding.stage)?.push({ layerId: layer.id, layer: prepared, target: binding.target, object: binding.object });
      }
    }
  }

  /** `update` of `stage`; a `StageDocumentError` is rethrown when `canRefuse`, every other error reported. */
  private updateStage(stage: IStage, canRefuse: boolean): void {
    if (typeof stage.update !== 'function' || this.doc === null) {
      return;
    }
    try {
      stage.update(this.doc, this.stageLayers.get(stage) ?? []);
    } catch (error) {
      if (canRefuse && isStageDocumentError(error)) {
        throw error;
      }
      this.reporter.error(stage.id, undefined, error);
    }
  }

  /** Back to `saved`: new objects released, released ones resolved again, stages updated again. */
  private rollback(saved: IHostState, updated: readonly IStage[]): void {
    const restored = new Map<string, IBinding>();
    this.bindings.forEach((binding, id) => {
      if (saved.bindings.get(id) !== binding) {
        this.release(binding);
      }
    });
    saved.bindings.forEach((binding, id) => {
      const kept = this.bindings.get(id) === binding;
      restored.set(id, kept || !binding.resolved ? binding : this.resolve(id, binding.target, binding.stage));
    });
    this.bindings = restored;
    this.prepared = new Map(saved.prepared);
    this.doc = saved.doc;
    this.refreshDerived();
    updated.forEach((stage) => this.updateStage(stage, false));
  }

  private retry(filter: (binding: IBinding) => boolean): void {
    const changed = new Set<IStage>();
    for (const [id, binding] of Array.from(this.bindings)) {
      if (!binding.resolved && filter(binding)) {
        const next = this.resolve(id, binding.target, binding.stage);
        this.bindings.set(id, next);
        if (next.resolved) {
          changed.add(binding.stage);
        }
      }
    }
    if (changed.size === 0) {
      return;
    }
    this.refreshDerived();
    const { time, state } = this.now();
    changed.forEach((stage) => {
      this.updateStage(stage, false);
      this.syncStage(stage, time, state);
      this.renderStage(stage, time);
    });
  }

  private syncStage(stage: IStage, time: ITransportTime, state: ITransportSyncState): void {
    if (typeof stage.sync === 'function' && this.doc !== null && !this.destroyed) {
      this.reporter.guard(stage.id, undefined, () => stage.sync?.(time, state), undefined);
    }
  }

  private renderStage(stage: IStage, time: ITransportTime): void {
    const doc = this.doc;
    if (typeof stage.render !== 'function' || doc === null || this.destroyed) {
      return;
    }
    const layers = this.stageLayers.get(stage) ?? [];
    this.reporter.guard(stage.id, undefined, () => {
      const states = evaluateStageLayers(layers, time, doc.settings.totalFrames, this.registry);
      stage.render?.(time, states);
    }, undefined);
  }
}
