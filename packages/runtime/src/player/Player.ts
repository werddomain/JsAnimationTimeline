// packages/runtime/src/player/Player.ts
/**
 * Lecteur sans interface : une `Animation` Web Animations par cible, toutes
 * calées sur un `Transport` sans DOM (temps, boucle, vitesse, fin, événements
 * `tick` et `frame`). À chaque saut de temps ou changement d'état du transport
 * (`onSync`), les animations sont réalignées : `currentTime`, `playbackRate`,
 * lecture ou pause.
 */

import type { ITimelineDocument } from '../model/document';
import { validateDocument } from '../model/validate';
import { collectLayers } from '../evaluate/evaluateDocument';
import { defaultPropertyRegistry } from '../properties/PropertyRegistry';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import { Transport } from '../transport/Transport';
import { assertValidSpeed, timelineDuration } from '../transport/time';
import type { ITransportTime } from '../transport/types';
import { createBrowserClock } from './clock';
import { buildLayerKeyframes } from './keyframes';
import { resolveTarget } from './targets';
import type { IPlayer, IPlayerOptions, PlayerEventName, PlayerListener } from './types';

function assertValidDocument(doc: ITimelineDocument): void {
  const issues = validateDocument(doc);
  if (issues.length > 0) {
    const [first] = issues;
    throw new Error(`Invalid timeline document (${issues.length} issue(s)); first at ${first.path}: ${first.message}`);
  }
}

/** Animations built for a document, and the layers whose target is missing. */
interface IAnimationSet {
  readonly animations: Animation[];
  readonly missing: string[];
}

/** Rethrows outside the player's call stack, so playback keeps going. */
function reportAsync(error: unknown): void {
  setTimeout(() => {
    throw error;
  }, 0);
}

/** See `IPlayer`. Created by `createPlayer`. */
export class Player implements IPlayer {
  private doc: ITimelineDocument;
  private readonly root: ParentNode;
  private readonly registry: PropertyRegistry;
  private readonly transport: Transport;
  private animations: Animation[] = [];
  private missing: string[] = [];
  private destroyed = false;

  constructor(doc: ITimelineDocument, options: IPlayerOptions = {}) {
    assertValidSpeed(options.speed ?? 1);
    assertValidDocument(doc);
    this.root = options.root ?? document;
    this.registry = options.registry ?? defaultPropertyRegistry;
    this.transport = new Transport({
      fps: doc.settings.fps,
      totalFrames: doc.settings.totalFrames,
      clock: options.clock ?? createBrowserClock(),
      loop: options.loop,
      speed: options.speed,
      onSync: () => this.syncAnimations(),
      onListenerError: options.onListenerError ?? reportAsync
    });
    this.doc = doc;
    const built = this.buildAnimations(doc);
    this.animations = built.animations;
    this.missing = built.missing;
    this.syncAnimations();
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
    return this.missing;
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
    const built = this.buildAnimations(doc);
    this.cancelAnimations();
    this.doc = doc;
    this.animations = built.animations;
    this.missing = built.missing;
    this.transport.setTimeline(doc.settings);
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
    this.cancelAnimations();
    this.destroyed = true;
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error('The player was destroyed.');
    }
  }

  /**
   * Creates the animations of `doc` (paused at 0). All or nothing: when a
   * target fails, the animations already created are cancelled.
   */
  private buildAnimations(doc: ITimelineDocument): IAnimationSet {
    const animations: Animation[] = [];
    const missing: string[] = [];
    const duration = timelineDuration(doc.settings);
    try {
      for (const layer of collectLayers(doc)) {
        const keyframes = buildLayerKeyframes(layer, doc.settings, this.registry);
        if (keyframes === null) {
          continue;
        }
        const target = resolveTarget(layer, this.root);
        if (target === null) {
          missing.push(layer.id);
          continue;
        }
        if (typeof target.animate !== 'function') {
          throw new Error('The Web Animations API (Element.animate) is not available.');
        }
        const animation = target.animate(keyframes, { duration, fill: 'both', easing: 'linear' });
        animation.pause();
        animations.push(animation);
      }
    } catch (error) {
      animations.forEach((animation) => animation.cancel());
      throw error;
    }
    return { animations, missing };
  }

  /** Aligns every animation on the transport's time, rate and play state. */
  private syncAnimations(): void {
    const time = this.transport.timeMs;
    const speed = this.transport.speed;
    const running = this.transport.playing && time < this.transport.duration;
    this.animations.forEach((animation) => {
      animation.playbackRate = speed;
      if (running) {
        animation.currentTime = time;
        animation.play();
      } else {
        // Pause first: setting currentTime then completes the pause at exactly this time.
        animation.pause();
        animation.currentTime = time;
      }
    });
  }

  private cancelAnimations(): void {
    this.animations.forEach((animation) => animation.cancel());
    this.animations = [];
  }
}

/** Creates a player for `doc`; see `IPlayerOptions`. Throws for an invalid document. */
export function createPlayer(doc: ITimelineDocument, options: IPlayerOptions = {}): IPlayer {
  return new Player(doc, options);
}
