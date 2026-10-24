// packages/editor/src/core/stage/EditorStageHost.ts
/**
 * Scènes de l'éditeur : enveloppe le `StageHost` du runtime (cycle de vie,
 * routage, cache des `resolve`, avertissements) et le branche sur le noyau.
 *
 * - Chaque document annoncé par le Store (commande, annuler / rétablir,
 *   `load`) est chargé tout de suite : calques supprimés ou dont la cible a
 *   changé relâchés (`release`), nouvelles cibles résolues, puis `update`.
 *   Le rendu (`sync` et `render`) suit à la prochaine image d'affichage, par
 *   la lecture (`PlaybackController.attachStage`).
 * - Une scène qui refuse un document de commande (`StageDocumentError`)
 *   garde le document précédent ; l'erreur va à `onError`, le Store garde le
 *   nouveau. Seul le document initial, refusé, fait échouer `createEditor()`.
 * - Un document annoncé pendant un chargement (une scène ou un gestionnaire de
 *   `stage:report` qui exécute une commande) est chargé juste après celui en
 *   cours ; seul le dernier compte. `refreshTargets` lève pendant un chargement.
 * - Chaque avertissement nouveau est émis par `stage:report` ; ceux du
 *   document initial, relevés avant l'abonnement des plugins, sont émis de
 *   nouveau juste avant `editor:ready` (dans son premier gestionnaire).
 * - `destroy` relâche chaque calque puis détache chaque scène ; les objets
 *   restent au développeur.
 */

import { isRefTarget, StageHost } from '@werddomain/timeline-runtime';
import type {
  IStage,
  IStageHostClock,
  IStageReport,
  ITargetInfo,
  ITimelineDocument,
  ITransportSyncState,
  ITransportTime,
  LayerTarget,
  PropertyRegistry
} from '@werddomain/timeline-runtime';
import type { EventBus } from '../events/EventBus';
import type { IStageRenderer } from '../playback/PlaybackController';
import type { Store } from '../store/Store';
// Import pour effet : garde l'augmentation de TimelineEventMap visible ici.
import './stageEvents';
import type { StageErrorHandler } from './types';

/** Pièces dont les scènes ont besoin. */
export interface IEditorStageHostOptions {
  readonly bus: EventBus;
  readonly store: Store;
  readonly stages: readonly IStage[];
  /** Registre figé de l'éditeur (propriétés des scènes comprises). */
  readonly registry: PropertyRegistry;
  readonly onError: StageErrorHandler;
  /** Position et état de lecture courants (réapplication après `refreshTargets`). */
  readonly now: () => IStageHostClock;
}

/** Scène qui anime `target` : celle nommée par `target.stage`, sinon la première qui l'accepte. */
function routeOf(stages: readonly IStage[], target: LayerTarget): IStage | undefined {
  if (isRefTarget(target) && target.stage !== undefined) {
    return stages.find((stage) => stage.id === target.stage);
  }
  return stages.find((stage) => stage.accepts(target));
}

/** Scènes branchées sur le noyau de l'éditeur ; interne (les plugins voient `IEditorStage`). */
export class EditorStageHost implements IStageRenderer {
  readonly stages: readonly IStage[];
  private readonly host: StageHost;
  private readonly onError: StageErrorHandler;
  private readonly unsubscribes: (() => void)[];
  private destroyed = false;
  private loading = false;
  /** Dernier document annoncé pendant un chargement, chargé ensuite. */
  private queued: ITimelineDocument | null = null;

  /** Charge le document courant du Store ; lève l'erreur d'une scène qui le refuse (après avoir tout relâché). */
  constructor(options: IEditorStageHostOptions) {
    const { bus, store } = options;
    this.stages = Object.freeze(options.stages.slice());
    this.onError = options.onError;
    this.host = new StageHost({
      stages: this.stages,
      registry: options.registry,
      onError: options.onError,
      onReport: (report) => bus.emit('stage:report', report),
      now: options.now
    });
    this.unsubscribes = [
      bus.on('document:changed', ({ document }) => this.load(document)),
      bus.on('document:loaded', ({ document }) => this.load(document)),
      bus.once('editor:ready', () => this.host.warnings.forEach((report) => bus.emit('stage:report', report)))
    ];
    try {
      this.loadNow(store.document);
    } catch (error) {
      this.destroy();
      throw error;
    }
    this.flushQueued();
  }

  get missingTargets(): readonly string[] {
    return this.host.missingTargets;
  }

  get warnings(): readonly IStageReport[] {
    return this.host.warnings;
  }

  sync(time: ITransportTime, state: ITransportSyncState): void {
    if (!this.destroyed) this.host.sync(time, state);
  }

  render(time: ITransportTime): void {
    if (!this.destroyed) this.host.render(time);
  }

  refreshTargets(layerId?: string): void {
    this.host.refresh(layerId);
  }

  listTargets(): readonly ITargetInfo[] {
    return Object.freeze(this.stages.flatMap((stage) => this.guard(() => stage.targets?.list() ?? [], [])));
  }

  describe(target: LayerTarget): ITargetInfo | undefined {
    return this.guard(() => routeOf(this.stages, target)?.targets?.describe?.(target), undefined);
  }

  /** Relâche chaque calque, détache chaque scène et se désabonne. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    this.host.destroy();
  }

  private load(doc: ITimelineDocument): void {
    if (this.destroyed) return;
    if (this.loading) {
      this.queued = doc;
      return;
    }
    try {
      this.loadNow(doc);
    } catch (error) {
      this.onError(error);
    }
    this.flushQueued();
  }

  private loadNow(doc: ITimelineDocument): void {
    this.loading = true;
    try {
      this.host.load(doc);
    } finally {
      this.loading = false;
    }
  }

  private flushQueued(): void {
    const next = this.queued;
    this.queued = null;
    if (next !== null) this.load(next);
  }

  /** Exécute une méthode de scène hors cycle de vie ; son erreur va à `onError`. */
  private guard<R>(action: () => R, fallback: R): R {
    try {
      return action();
    } catch (error) {
      this.onError(error);
      return fallback;
    }
  }
}
