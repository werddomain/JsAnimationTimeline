// packages/runtime/src/player/Player.ts
/**
 * Lecteur sans interface : une `Animation` Web Animations par cible, toutes
 * calées sur une horloge commune. `seek` règle `currentTime`, `speed` règle
 * `playbackRate`, et une boucle `requestAnimationFrame` légère émet `frame`
 * et gère la fin (arrêt + `complete`, ou retour à l'image 1 avec `loop`).
 */

import type { ITimelineDocument } from '../model/document';
import { validateDocument } from '../model/validate';
import { collectLayers } from '../evaluate/evaluateDocument';
import { defaultPropertyRegistry } from '../properties/PropertyRegistry';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import { createBrowserClock } from './clock';
import { EventEmitter } from './EventEmitter';
import { buildLayerKeyframes } from './keyframes';
import { resolveTarget } from './targets';
import type {
  IPlayer,
  IPlayerClock,
  IPlayerEventMap,
  IPlayerOptions,
  PlayerEventName,
  PlayerListener
} from './types';

const NO_PAYLOAD: Record<string, never> = Object.freeze({});
/** Tolerance when converting a time to a frame (float noise at frame starts). */
const FRAME_EPSILON = 1e-6;

function assertValidSpeed(speed: number): void {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`Speed must be a finite number above 0 (got ${speed}).`);
  }
}

function assertValidDocument(doc: ITimelineDocument): void {
  const issues = validateDocument(doc);
  if (issues.length > 0) {
    const [first] = issues;
    throw new Error(`Invalid timeline document (${issues.length} issue(s)); first at ${first.path}: ${first.message}`);
  }
}

function durationOf(doc: ITimelineDocument): number {
  return (doc.settings.totalFrames / doc.settings.fps) * 1000;
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
  private readonly clock: IPlayerClock;
  private readonly events: EventEmitter<IPlayerEventMap>;
  private animations: Animation[];
  private missing: string[];
  /** Time (ms) at `anchorNow`; the current time while paused. */
  private anchorTime = 0;
  private anchorNow = 0;
  private isPlaying = false;
  private frameHandle: number | null = null;
  private lastFrame = 1;
  private speedValue: number;
  private loopValue: boolean;
  private destroyed = false;

  constructor(doc: ITimelineDocument, options: IPlayerOptions = {}) {
    const speed = options.speed ?? 1;
    assertValidSpeed(speed);
    assertValidDocument(doc);
    this.speedValue = speed;
    this.loopValue = options.loop ?? false;
    this.root = options.root ?? document;
    this.registry = options.registry ?? defaultPropertyRegistry;
    this.clock = options.clock ?? createBrowserClock();
    this.events = new EventEmitter<IPlayerEventMap>(options.onListenerError ?? reportAsync);
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
    return durationOf(this.doc);
  }

  get frame(): number {
    return this.timeToFrame(this.currentTime());
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get missingTargets(): readonly string[] {
    return this.missing;
  }

  get loop(): boolean {
    return this.loopValue;
  }

  set loop(value: boolean) {
    this.assertAlive();
    this.loopValue = value;
  }

  get speed(): number {
    return this.speedValue;
  }

  set speed(value: number) {
    this.assertAlive();
    assertValidSpeed(value);
    this.reanchor();
    this.speedValue = value;
    this.animations.forEach((animation) => {
      animation.playbackRate = value;
    });
  }

  play(): void {
    this.assertAlive();
    if (this.isPlaying) {
      return;
    }
    if (this.anchorTime >= this.duration) {
      this.anchorTime = 0;
    }
    this.isPlaying = true;
    this.anchorNow = this.clock.now();
    this.syncAnimations();
    this.scheduleTick();
    this.events.emit('play', NO_PAYLOAD);
  }

  pause(): void {
    this.assertAlive();
    if (!this.isPlaying) {
      return;
    }
    this.reanchor();
    this.isPlaying = false;
    this.cancelTick();
    this.syncAnimations();
    this.events.emit('pause', NO_PAYLOAD);
  }

  seek(frame: number): void {
    this.assertAlive();
    if (!Number.isFinite(frame)) {
      throw new Error(`Frame must be a finite number (got ${frame}).`);
    }
    const clamped = Math.min(this.totalFrames, Math.max(1, frame));
    this.anchorTime = ((clamped - 1) / this.fps) * 1000;
    this.anchorNow = this.clock.now();
    this.syncAnimations();
    this.emitFrame(true);
  }

  update(doc: ITimelineDocument): void {
    this.assertAlive();
    assertValidDocument(doc);
    const built = this.buildAnimations(doc);
    const time = Math.min(this.currentTime(), durationOf(doc));
    this.cancelAnimations();
    this.doc = doc;
    this.animations = built.animations;
    this.missing = built.missing;
    this.anchorTime = time;
    this.anchorNow = this.clock.now();
    this.syncAnimations();
    this.emitFrame(true);
  }

  on<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): () => void {
    this.assertAlive();
    return this.events.on(event, listener);
  }

  off<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): void {
    this.events.off(event, listener);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.cancelTick();
    this.cancelAnimations();
    this.isPlaying = false;
    this.events.clear();
    this.destroyed = true;
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error('The player was destroyed.');
    }
  }

  private currentTime(): number {
    if (!this.isPlaying) {
      return this.anchorTime;
    }
    return this.anchorTime + (this.clock.now() - this.anchorNow) * this.speedValue;
  }

  /** Moves the anchor to now (never past the end), so changes apply from the current time. */
  private reanchor(): void {
    this.anchorTime = Math.min(this.currentTime(), this.duration);
    this.anchorNow = this.clock.now();
  }

  private timeToFrame(time: number): number {
    const frame = 1 + Math.floor((time * this.fps) / 1000 + FRAME_EPSILON);
    return Math.min(this.totalFrames, Math.max(1, frame));
  }

  /**
   * Creates the animations of `doc` (paused at 0). All or nothing: when a
   * target fails, the animations already created are cancelled.
   */
  private buildAnimations(doc: ITimelineDocument): IAnimationSet {
    const animations: Animation[] = [];
    const missing: string[] = [];
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
        const animation = target.animate(keyframes, { duration: durationOf(doc), fill: 'both', easing: 'linear' });
        animation.pause();
        animations.push(animation);
      }
    } catch (error) {
      animations.forEach((animation) => animation.cancel());
      throw error;
    }
    return { animations, missing };
  }

  /** Aligns every animation on the player's time, rate and play state. */
  private syncAnimations(): void {
    const time = this.currentTime();
    const running = this.isPlaying && time < this.duration;
    this.animations.forEach((animation) => {
      animation.playbackRate = this.speedValue;
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

  private emitFrame(force: boolean): void {
    const frame = this.frame;
    if (force || frame !== this.lastFrame) {
      this.lastFrame = frame;
      this.events.emit('frame', { frame });
    }
  }

  private scheduleTick(): void {
    if (this.frameHandle === null) {
      this.frameHandle = this.clock.requestFrame(this.tick);
    }
  }

  private cancelTick(): void {
    if (this.frameHandle !== null) {
      this.clock.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  /** Runs once per animation frame while playing; listeners may pause or seek. */
  private readonly tick = (): void => {
    this.frameHandle = null;
    if (!this.isPlaying) {
      return;
    }
    const time = this.currentTime();
    if (time < this.duration) {
      this.scheduleTick();
      this.emitFrame(false);
      return;
    }
    if (this.loopValue) {
      this.anchorTime = (time - this.duration) % this.duration;
      this.anchorNow = this.clock.now();
      this.syncAnimations();
      this.scheduleTick();
      this.events.emit('loop', NO_PAYLOAD);
      this.emitFrame(true);
      return;
    }
    this.anchorTime = this.duration;
    this.isPlaying = false;
    this.syncAnimations();
    this.emitFrame(false);
    this.events.emit('complete', NO_PAYLOAD);
  };
}

/** Creates a player for `doc`; see `IPlayerOptions`. Throws for an invalid document. */
export function createPlayer(doc: ITimelineDocument, options: IPlayerOptions = {}): IPlayer {
  return new Player(doc, options);
}
