// packages/editor/src/core/stage/EditorStageHost.ts
/**
 * Scènes de l'éditeur : enveloppe le `StageHost` du runtime (cycle de vie,
 * routage, cache des `resolve`, avertissements) et le branche sur le noyau.
 *
 * - Chaque document annoncé par le Store (commande, annuler / rétablir,
 *   `load`) est chargé tout de suite : calques supprimés ou dont la cible a
 *   changé relâchés (`release`), nouvelles cibles résolues, puis `update`.
 *   Les scènes sont rendues aussitôt à l'instant courant (une scène HTML en
 *   mode `frame` remet ses styles d'origine dans `update` : sans ce rendu, une
 *   commande lancée depuis une image d'animation laisserait peindre une image
 *   non animée). Le rendu regroupé de la lecture suit à la prochaine image.
 * - Une scène qui refuse un document de commande (`StageDocumentError`)
 *   garde le document précédent ; l'erreur va à `onError`, le Store garde le
 *   nouveau. Seul le document initial, refusé, fait échouer `createEditor()`.
 * - Un document annoncé pendant un chargement ou pendant le rendu qui le suit
 *   (une scène ou un gestionnaire de `stage:report` qui exécute une commande)
 *   est chargé juste après, même si `onError` lève ; seul le dernier compte.
 *   `refreshTargets` lève pendant un chargement.
 * - `IStageLayerState.editorVisible` suit l'œil du calque et de ses dossiers
 *   parents dans le document que montrent les scènes (`StageHost.document` :
 *   le précédent pendant le retour arrière d'un document refusé).
 * - `stage:report` n'émet que les avertissements absents du document
 *   précédent, y compris ceux relevés après son chargement (erreur de
 *   `render` ou de `sync`), et les erreurs de scène reportées jusqu'au
 *   prochain passage `sync` puis `render` (plusieurs documents dans une même
 *   image) ; ceux qui existent à `editor:ready` sont émis à ce moment-là
 *   (voir `StageReportFeed`).
 * - `stage:targetsChanged` est émis quand le contenu de `missingTargets`
 *   change : après un document (accepté ou refusé), et après une nouvelle
 *   tentative du `StageHost` (`refreshTargets`, `targets.subscribe` d'une
 *   scène, signalé par `onTargetsChanged`). Une annonce demandée pendant une
 *   annonce (un gestionnaire qui appelle `refreshTargets`) part juste après,
 *   pour que tous les gestionnaires reçoivent la même liste.
 * - Sans scène (`stage: false`), rien n'est routé : aucune cible manquante,
 *   aucun avertissement.
 * - `destroy` relâche chaque calque puis détache chaque scène, même si un
 *   désabonnement lève ; les objets restent au développeur.
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
import { isLayerEditorVisible } from '../playback/FrameSampler';
import type { IStageRenderer } from '../playback/PlaybackController';
import type { Store } from '../store/Store';
import { StageReportFeed } from './reportFeed';
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
  /** Position et état de lecture courants (rendu après un chargement, réapplication après `refreshTargets`). */
  readonly now: () => IStageHostClock;
}

const NO_REPORTS: readonly IStageReport[] = Object.freeze([]);
const NO_LAYERS: readonly string[] = Object.freeze([]);

/** Scène qui anime `target` : celle nommée par `target.stage`, sinon la première qui l'accepte. */
function routeOf(stages: readonly IStage[], target: LayerTarget): IStage | undefined {
  if (isRefTarget(target) && target.stage !== undefined) {
    return stages.find((stage) => stage.id === target.stage);
  }
  return stages.find((stage) => stage.accepts(target));
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Scènes branchées sur le noyau de l'éditeur ; interne (les plugins voient `IEditorStage`). */
export class EditorStageHost implements IStageRenderer {
  readonly stages: readonly IStage[];
  /** `null` sans scène (`stage: false`). */
  private readonly host: StageHost | null;
  private readonly bus: EventBus;
  private readonly onError: StageErrorHandler;
  private readonly now: () => IStageHostClock;
  private readonly feed: StageReportFeed;
  private readonly unsubscribes: (() => void)[];
  private destroyed = false;
  private loading = false;
  /** Dernier document annoncé pendant un chargement, chargé ensuite. */
  private queued: ITimelineDocument | null = null;
  /** `missingTargets` à la dernière annonce (`stage:targetsChanged`). */
  private announcedMissing: readonly string[] = NO_LAYERS;
  private announcing = false;
  private announceAgain = false;
  /** Un `sync` a eu lieu depuis le dernier chargement (le `render` qui suit termine un passage complet). */
  private syncedSinceLoad = false;

  /** Charge le document courant du Store ; lève l'erreur d'une scène qui le refuse (après avoir tout relâché). */
  constructor(options: IEditorStageHostOptions) {
    const { bus, store } = options;
    this.bus = bus;
    this.stages = Object.freeze(options.stages.slice());
    this.onError = options.onError;
    this.now = options.now;
    this.feed = new StageReportFeed((report) => bus.emit('stage:report', report));
    this.host = this.stages.length === 0 ? null : new StageHost({
      stages: this.stages,
      registry: options.registry,
      onError: options.onError,
      onReport: (report) => this.feed.add(report),
      onTargetsChanged: () => this.announceMissing(),
      isEditorVisible: (layerId) => isLayerEditorVisible(this.host?.document ?? store.document, layerId),
      now: options.now
    });
    this.unsubscribes = [
      bus.on('document:changed', ({ document }) => this.load(document)),
      bus.on('document:loaded', ({ document }) => this.load(document)),
      bus.once('editor:ready', () => this.feed.start(this.warnings))
    ];
    try {
      this.loadNow(store.document);
    } catch (error) {
      this.destroy();
      throw error;
    }
    this.announcedMissing = this.missingTargets;
    this.flushQueued();
  }

  get missingTargets(): readonly string[] {
    return this.host?.missingTargets ?? NO_LAYERS;
  }

  get warnings(): readonly IStageReport[] {
    return this.host?.warnings ?? NO_REPORTS;
  }

  sync(time: ITransportTime, state: ITransportSyncState): void {
    if (this.destroyed) return;
    this.host?.sync(time, state);
    this.syncedSinceLoad = true;
  }

  render(time: ITransportTime): void {
    if (this.destroyed) return;
    this.host?.render(time);
    if (this.syncedSinceLoad) this.feed.completePass();
  }

  refreshTargets(layerId?: string): void {
    this.host?.refresh(layerId);
  }

  listTargets(): readonly ITargetInfo[] {
    return Object.freeze(this.stages.flatMap((stage) => this.guard(() => stage.targets?.list() ?? [], [])));
  }

  describe(target: LayerTarget): ITargetInfo | undefined {
    return this.guard(() => routeOf(this.stages, target)?.targets?.describe?.(target), undefined);
  }

  /** Se désabonne, puis relâche chaque calque et détache chaque scène, quoi qu'il arrive. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.unsubscribes.forEach((unsubscribe) => this.guard(unsubscribe, undefined));
    } finally {
      this.host?.destroy();
    }
  }

  private load(doc: ITimelineDocument): void {
    if (this.destroyed) return;
    if (this.loading) {
      this.queued = doc;
      return;
    }
    try {
      this.loadNow(doc);
      // Un document en attente sera chargé, puis rendu, juste après.
      if (this.queued === null) this.renderNow();
    } catch (error) {
      this.onError(error);
    } finally {
      // Un document refusé peut aussi changer les cibles manquantes (retour arrière).
      if (this.queued === null) this.announceMissing();
      this.flushQueued();
    }
  }

  /** Charge `doc` dans les scènes ; lève l'erreur d'une scène qui le refuse (elles gardent le précédent). */
  private loadNow(doc: ITimelineDocument): void {
    const host = this.host;
    if (host === null) return;
    this.loading = true;
    this.syncedSinceLoad = false;
    this.feed.beginLoad(host.warnings);
    try {
      host.load(doc);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Rendu des scènes à l'instant courant, juste après un chargement (pour les
   * scènes en mode `frame`, qui remettent leurs styles d'origine dans
   * `update`). Pas de `sync` : il suit avec le rendu regroupé de la lecture.
   * Un document annoncé pendant ce rendu est mis en attente comme pendant un
   * chargement.
   */
  private renderNow(): void {
    if (this.destroyed || this.host === null) return;
    this.loading = true;
    try {
      this.host.render(this.now().time);
    } finally {
      this.loading = false;
    }
  }

  /** Émet `stage:targetsChanged` si le contenu de `missingTargets` a changé depuis la dernière annonce. */
  private announceMissing(): void {
    // Pendant un chargement (nouvelles tentatives en fin de `load`), l'annonce part après, depuis `load` ou le constructeur.
    if (this.destroyed || this.loading) return;
    if (this.announcing) {
      this.announceAgain = true;
      return;
    }
    this.announcing = true;
    try {
      do {
        this.announceAgain = false;
        const current = this.missingTargets;
        if (!sameList(current, this.announcedMissing)) {
          this.announcedMissing = current;
          this.bus.emit('stage:targetsChanged', { missingTargets: current });
        }
      } while (this.announceAgain && !this.destroyed);
    } finally {
      this.announcing = false;
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
