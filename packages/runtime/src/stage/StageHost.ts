// packages/runtime/src/stage/StageHost.ts
/**
 * Cycle de vie des scènes, sans DOM (lecteur, puis éditeur en C7) :
 * 1. `attach` une seule fois (et abonnement à `targets.subscribe`) ;
 * 2. à chaque document, les calques sont comparés par id et par cible ;
 * 3. calque supprimé ou cible changée : `release(layerId, ancienObjet)`, puis
 *    un nouveau `resolve` ;
 * 4. `resolve` est mis en cache ; un échec (`null`) est retenu et réessayé sur
 *    `targets.subscribe` ou `refresh(layerId?)`, jamais à chaque image ; une
 *    notification de `subscribe` qui nomme des cibles touchées (ref liée à
 *    un autre élément) résout aussi à nouveau les calques déjà liés à ces
 *    cibles : nouvel objet, `release` de l'ancien ; `null`, calque manquant ;
 * 5. puis `update(doc, calquesLiés)` ; le propriétaire appelle ensuite `sync`
 *    et `render` de l'image courante (`editorVisible` lu par
 *    `isEditorVisible`, toujours vrai par défaut) ;
 * 6. fin : `release` de chaque calque, puis `detach` des scènes attachées.
 * Une `StageDocumentError` levée par `update` annule le document : retour au
 * précédent, `update` de toutes les scènes avec lui, puis `sync` et `render`
 * de l'instant courant, et l'erreur remonte (premier document refusé : les
 * nouveaux calques sont seulement libérés). Toute autre erreur est signalée
 * par `StageReporter`. Si `onError` détruit l'hôte pendant un chargement,
 * plus rien n'est résolu ni appliqué. Un changement de cibles signalé pendant
 * un chargement est traité à la fin de celui-ci.
 */

import { collectLayers } from '../evaluate/evaluateDocument';
import type { ITimelineDocument } from '../model/document';
import type { ILayer } from '../model/layer';
import type { LayerTarget } from '../model/target';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { ITransportSyncState, ITransportTime } from '../transport/types';
import { ALWAYS_VISIBLE, evaluateStageLayers, prepareStageLayer } from './frameStates';
import type { EditorVisibility } from './frameStates';
import { isStageDocumentError } from './reports';
import type { IStageReport } from './reports';
import type { IBinding, IHostState, IStageHostClock, IStageHostOptions } from './stageHostTypes';
import { assertValidStages, routeTarget, sameTarget, toTargetList } from './routing';
import { StageReporter } from './StageReporter';
import type { IStageReporterState } from './StageReporter';
import type { IStage, IStageContext, IStageLayer } from './types';

export type { IStageHostClock, IStageHostOptions } from './stageHostTypes';

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
  /** Stages whose `attach` was called (the only ones detached). */
  private readonly attachedStages = new Set<IStage>();
  private destroyed = false;
  private loading = false;
  /** Stages whose targets changed during a load, with the affected targets; retried when it ends. */
  private readonly pendingRetries = new Map<IStage, LayerTarget[]>();
  private readonly isEditorVisible: EditorVisibility;

  /** Throws for a malformed stage or a duplicate stage id. */
  constructor(options: IStageHostOptions) {
    assertValidStages(options.stages);
    this.stages = options.stages.slice();
    this.registry = options.registry;
    this.reporter = new StageReporter(options.onError, options.onReport);
    this.now = options.now;
    this.isEditorVisible = options.isEditorVisible ?? ALWAYS_VISIBLE;
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
   * Target changes signalled meanwhile are retried afterwards, on whichever
   * document is then current. Refused while a load runs (e.g. from a stage).
   */
  load(doc: ITimelineDocument): void {
    this.assertNotLoading();
    this.loading = true;
    let failure: { readonly error: unknown } | null = null;
    try {
      this.loadDocument(doc);
    } catch (error) {
      failure = { error };
    }
    this.loading = false;
    const pending = Array.from(this.pendingRetries);
    this.pendingRetries.clear();
    pending.forEach(([stage, affected]) => this.onTargetsChanged(stage, affected));
    if (failure !== null) {
      throw failure.error;
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
    this.assertNotLoading();
    this.retry((binding) => layerId === undefined || binding.layerId === layerId);
  }

  /** `release` of every resolved layer, then `detach` of the attached stages. Idempotent. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.bindings.forEach((binding) => this.release(binding));
    this.bindings.clear();
    this.unsubscribers.forEach(({ stageId, unsubscribe }) => this.reporter.guard(stageId, undefined, unsubscribe, undefined));
    this.unsubscribers = [];
    this.stages
      .filter((stage) => this.attachedStages.has(stage))
      .forEach((stage) => this.reporter.guard(stage.id, undefined, () => stage.detach?.(), undefined));
    this.attachedStages.clear();
    this.stageLayers.clear();
  }

  private loadDocument(doc: ITimelineDocument): void {
    const saved: IHostState = { doc: this.doc, bindings: new Map(this.bindings), prepared: this.prepared };
    const savedReports = this.reporter.save();
    this.reporter.reset();
    this.attach();
    const layers = collectLayers(doc);
    this.releaseStale(layers);
    this.prepared = new Map();
    layers.forEach((layer) => this.bindLayer(layer));
    if (this.destroyed) {
      return;
    }
    this.doc = doc;
    this.refreshDerived();
    for (const stage of this.stages) {
      try {
        this.updateStage(stage, true);
      } catch (error) {
        this.rollback(saved, savedReports);
        throw error;
      }
      if (this.destroyed) {
        return;
      }
    }
  }

  private assertNotLoading(): void {
    this.assertAlive();
    if (this.loading) {
      throw new Error('A document is being loaded; load and refresh cannot be called meanwhile (e.g. from a stage).');
    }
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
      if (this.destroyed) {
        return;
      }
      this.attachedStages.add(stage);
      this.reporter.guard(stage.id, undefined, () => stage.attach?.(this.createContext(stage)), undefined);
      const subscribe = stage.targets?.subscribe;
      if (typeof subscribe === 'function' && !this.destroyed) {
        const onChange = (affected?: readonly LayerTarget[]): void => this.onTargetsChanged(stage, affected);
        const unsubscribe = this.reporter.guard(stage.id, undefined, () => subscribe.call(stage.targets, onChange), undefined);
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

  private onTargetsChanged(stage: IStage, affected?: unknown): void {
    const targets = toTargetList(affected);
    if (this.loading) {
      this.pendingRetries.set(stage, (this.pendingRetries.get(stage) ?? []).concat(targets));
      return;
    }
    if (!this.destroyed && this.doc !== null) {
      this.retry((binding) => binding.stage === stage, targets);
    }
  }

  /** Releases the bindings whose layer is gone or whose target changed. */
  private releaseStale(layers: readonly ILayer[]): void {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    for (const [id, binding] of Array.from(this.bindings)) {
      if (this.destroyed) {
        return;
      }
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
    if (target === undefined || this.destroyed) {
      return;
    }
    let binding = this.bindings.get(layer.id);
    if (binding === undefined) {
      // A throwing `accepts` counts as false for this document; it is routed again on the next one, not on refresh.
      const route = routeTarget(target, this.stages, (stage, t) => this.reporter.guard(stage.id, layer.id, () => stage.accepts(t) === true, false));
      if (route.kind !== 'stage') {
        this.reporter.unrouted(layer.id, route.kind === 'unknown-stage' ? route.stageId : undefined);
        return;
      }
      binding = this.resolve(layer.id, target, route.stage);
      this.bindings.set(layer.id, binding);
    }
    const stageId = binding.stage.id;
    this.prepared.set(layer.id, prepareStageLayer(layer, this.registry, (issue) => this.reporter.unknownProperty(stageId, issue)));
  }

  private resolve(layerId: string, target: LayerTarget, stage: IStage): IBinding {
    if (this.destroyed) {
      return { layerId, target, stage, object: null, resolved: false };
    }
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
    if (typeof stage.update !== 'function' || this.doc === null || this.destroyed) {
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

  /**
   * Back to `saved`: new objects released, released ones resolved again, then
   * `update` of every stage with the previous document, and `sync` and
   * `render` of the current time.
   */
  private rollback(saved: IHostState, savedReports: IStageReporterState): void {
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
    this.reporter.restore(savedReports);
    this.reapply(this.stages);
  }

  /** `update`, `sync` and `render` of `stages` at the current time. */
  private reapply(stages: Iterable<IStage>): void {
    if (this.doc === null) {
      return;
    }
    for (const stage of stages) {
      if (this.destroyed) {
        return;
      }
      this.updateStage(stage, false);
      const { time, state } = this.now();
      this.syncStage(stage, time, state);
      this.renderStage(stage, time);
    }
  }

  /**
   * Resolves again the failed bindings passing `filter`, and the resolved ones
   * on an `affected` target; re-applies the stages whose objects changed.
   */
  private retry(filter: (binding: IBinding) => boolean, affected: readonly LayerTarget[] = []): void {
    const changed = new Set<IStage>();
    for (const binding of Array.from(this.bindings.values())) {
      if (this.destroyed || !filter(binding)) {
        continue;
      }
      const next = binding.resolved ? this.reresolve(binding, affected) : this.resolve(binding.layerId, binding.target, binding.stage);
      if (this.destroyed) {
        // destroy() ran during resolve: the host forgets its bindings, so the new object goes back now.
        if (!binding.resolved) {
          this.release(next);
        }
        return;
      }
      if (next !== binding) {
        this.bindings.set(binding.layerId, next);
      }
      if (next !== binding && (next.resolved || binding.resolved)) {
        changed.add(binding.stage);
      }
    }
    if (changed.size === 0) {
      return;
    }
    this.refreshDerived();
    this.reapply(changed);
  }

  /**
   * `binding` when its target is not affected or still resolves to the same
   * object; otherwise the new binding, the old object being released.
   */
  private reresolve(binding: IBinding, affected: readonly LayerTarget[]): IBinding {
    if (!affected.some((target) => sameTarget(target, binding.target))) {
      return binding;
    }
    const next = this.resolve(binding.layerId, binding.target, binding.stage);
    if (this.destroyed) {
      // destroy() ran during resolve and already released `binding`: only the new object is left.
      this.release(next.resolved && next.object !== binding.object ? next : { ...next, resolved: false });
      return binding;
    }
    if (next.resolved && next.object === binding.object) {
      return binding;
    }
    this.release(binding);
    return next;
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
      const states = evaluateStageLayers(layers, time, doc.settings.totalFrames, this.registry, this.isEditorVisible);
      stage.render?.(time, states);
    }, undefined);
  }
}
