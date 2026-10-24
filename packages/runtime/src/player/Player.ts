// packages/runtime/src/player/Player.ts
/**
 * Lecteur sans interface : un `Transport` sans DOM tient le temps (boucle,
 * vitesse, fin, événements `tick` et `frame`) et un `StageHost` mène les
 * scènes. À chaque saut de temps ou changement d'état du transport
 * (`onSync`), les scènes reçoivent `sync` ; à chaque `tick`, celles qui
 * implémentent `render` reçoivent les valeurs de leurs calques. Sans option
 * `stage`, la scène est `createHtmlStage({ root, mode: 'waapi' })`.
 */

import type { ITimelineDocument } from '../model/document';
import { validateDocument } from '../model/validate';
import { defaultPropertyRegistry } from '../properties/PropertyRegistry';
import { createHtmlStage } from '../stage/html/createHtmlStage';
import { buildStageRegistry } from '../stage/registry';
import type { IStageReport } from '../stage/reports';
import { StageHost } from '../stage/StageHost';
import type { IStage } from '../stage/types';
import { Transport } from '../transport/Transport';
import { assertValidSpeed } from '../transport/time';
import type { ITransportTime } from '../transport/types';
import { createBrowserClock } from './clock';
import type { IPlayer, IPlayerOptions, PlayerEventName, PlayerListener } from './types';

function assertValidDocument(doc: ITimelineDocument): void {
  const issues = validateDocument(doc);
  if (issues.length > 0) {
    const [first] = issues;
    throw new Error(`Invalid timeline document (${issues.length} issue(s)); first at ${first.path}: ${first.message}`);
  }
}

/** Rethrows outside the player's call stack, so playback keeps going. */
function reportAsync(error: unknown): void {
  setTimeout(() => {
    throw error;
  }, 0);
}

/** Stages of the options: the given ones, or the default HTML stage on `root`. */
function resolveStages(options: IPlayerOptions): readonly IStage[] {
  if (options.stage !== undefined) {
    if (options.root !== undefined) {
      throw new Error('Pass either root or stage to createPlayer, not both.');
    }
    const stages = Array.isArray(options.stage) ? options.stage : [options.stage as IStage];
    if (stages.length === 0) {
      throw new Error('The stage option needs at least one stage.');
    }
    return stages;
  }
  return [createHtmlStage({ root: options.root ?? document, mode: 'waapi' })];
}

/** See `IPlayer`. Created by `createPlayer`. */
export class Player implements IPlayer {
  private doc: ITimelineDocument;
  private readonly transport: Transport;
  private readonly host: StageHost;
  private destroyed = false;

  constructor(doc: ITimelineDocument, options: IPlayerOptions = {}) {
    assertValidSpeed(options.speed ?? 1);
    assertValidDocument(doc);
    const stages = resolveStages(options);
    const onListenerError = options.onListenerError ?? reportAsync;
    this.host = new StageHost({
      stages,
      registry: buildStageRegistry(options.registry ?? defaultPropertyRegistry, stages),
      onError: onListenerError,
      now: () => ({ time: this.transport.time, state: { playing: this.transport.playing, speed: this.transport.speed } })
    });
    this.transport = new Transport({
      fps: doc.settings.fps,
      totalFrames: doc.settings.totalFrames,
      clock: options.clock ?? createBrowserClock(),
      loop: options.loop,
      speed: options.speed,
      onSync: (time, state) => this.host.sync(time, state),
      onListenerError
    });
    this.transport.on('tick', (time) => this.host.render(time));
    this.doc = doc;
    try {
      this.host.load(doc);
    } catch (error) {
      this.transport.destroy();
      this.host.destroy();
      throw error;
    }
    this.applyCurrentFrame();
    if (options.autoplay === true) {
      this.play();
    }
  }

  get totalFrames(): number {
    return this.doc.settings.totalFrames;
  }

  get fps(): number {
    return this.doc.settings.fps;
  }

  get duration(): number {
    return this.transport.duration;
  }

  get frame(): number {
    return this.transport.frame;
  }

  get time(): ITransportTime {
    return this.transport.time;
  }

  get playing(): boolean {
    return this.transport.playing;
  }

  get missingTargets(): readonly string[] {
    return this.host.missingTargets;
  }

  get warnings(): readonly IStageReport[] {
    return this.host.warnings;
  }

  get loop(): boolean {
    return this.transport.loop;
  }

  set loop(value: boolean) {
    this.assertAlive();
    this.transport.loop = value;
  }

  get speed(): number {
    return this.transport.speed;
  }

  set speed(value: number) {
    this.assertAlive();
    this.transport.speed = value;
  }

  play(): void {
    this.assertAlive();
    this.transport.play();
  }

  pause(): void {
    this.assertAlive();
    this.transport.pause();
  }

  seek(frame: number): void {
    this.assertAlive();
    this.transport.seek(frame);
  }

  update(doc: ITimelineDocument): void {
    this.assertAlive();
    assertValidDocument(doc);
    this.host.load(doc);
    if (this.destroyed) {
      // onListenerError destroyed the player while the stages loaded the document.
      return;
    }
    this.doc = doc;
    this.transport.setTimeline(doc.settings);
  }

  refreshTargets(layerId?: string): void {
    this.assertAlive();
    this.host.refresh(layerId);
  }

  on<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): () => void {
    this.assertAlive();
    return this.transport.on(event, listener);
  }

  off<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): void {
    this.transport.off(event, listener);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.transport.destroy();
    this.host.destroy();
    this.destroyed = true;
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error('The player was destroyed.');
    }
  }

  /** `sync` then `render` of the current time (the transport only emits them on changes). */
  private applyCurrentFrame(): void {
    const time = this.transport.time;
    this.host.sync(time, { playing: this.transport.playing, speed: this.transport.speed });
    this.host.render(time);
  }
}

/** Creates a player for `doc`; see `IPlayerOptions`. Throws for an invalid document. */
export function createPlayer(doc: ITimelineDocument, options: IPlayerOptions = {}): IPlayer {
  return new Player(doc, options);
}
