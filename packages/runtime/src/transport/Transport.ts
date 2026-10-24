// packages/runtime/src/transport/Transport.ts
/**
 * Transport sans DOM : tient le temps de la timeline (ancrage sur une
 * horloge), play/pause/seek, vitesse, boucle et fin. Une boucle d'images
 * légère (`IPlayerClock.requestFrame`) émet `tick` à chaque image d'horloge
 * et `frame` quand l'image entière change ; à la fin, elle s'arrête (`complete`)
 * ou repart à l'image 1 (`loop`). `onSync` prévient le propriétaire (lecteur,
 * scène) de chaque saut de temps ou changement d'état, avant les événements.
 */

import { EventEmitter } from './EventEmitter';
import type { ListenerErrorHandler } from './EventEmitter';
import {
  assertValidSpeed,
  assertValidTimeline,
  frameToTime,
  timelineDuration,
  toTransportTime
} from './time';
import type {
  IPlayerClock,
  ITransportEventMap,
  ITransportOptions,
  ITransportSyncState,
  ITransportTime,
  ITransportTimeline,
  TransportEventName,
  TransportListener
} from './types';

const NO_PAYLOAD: Record<string, never> = Object.freeze({});

/** The timer every JavaScript host provides (typed here without the DOM or Node libs). */
interface ITimerHost {
  setTimeout(callback: () => void, delayMs: number): unknown;
}

/** Rethrows outside the transport's call stack, so playback keeps going. */
const rethrowAsync: ListenerErrorHandler = (error) => {
  (globalThis as unknown as ITimerHost).setTimeout(() => {
    throw error;
  }, 0);
};

/** See `ITransportOptions`. Created by `createTransport`. */
export class Transport {
  private timeline: ITransportTimeline;
  private readonly clock: IPlayerClock;
  private readonly events: EventEmitter<ITransportEventMap>;
  private readonly onSync: ((time: ITransportTime, state: ITransportSyncState) => void) | undefined;
  /** Time (ms) at `anchorNow`; the current time while paused. */
  private anchorTime = 0;
  private anchorNow = 0;
  private isPlaying = false;
  private frameHandle: number | null = null;
  private lastFrame = 1;
  private speedValue: number;
  private loopValue: boolean;
  private destroyed = false;

  constructor(options: ITransportOptions) {
    const speed = options.speed ?? 1;
    assertValidSpeed(speed);
    assertValidTimeline(options);
    this.timeline = { fps: options.fps, totalFrames: options.totalFrames };
    this.clock = options.clock;
    this.speedValue = speed;
    this.loopValue = options.loop ?? false;
    this.onSync = options.onSync;
    this.events = new EventEmitter<ITransportEventMap>(options.onListenerError ?? rethrowAsync);
  }

  get fps(): number {
    return this.timeline.fps;
  }

  get totalFrames(): number {
    return this.timeline.totalFrames;
  }

  /** Length in milliseconds: totalFrames / fps. */
  get duration(): number {
    return timelineDuration(this.timeline);
  }

  /** Current time in milliseconds, 0..duration. */
  get timeMs(): number {
    return Math.min(this.currentTime(), this.duration);
  }

  /** Current position in milliseconds, fractional frame and integer frame. */
  get time(): ITransportTime {
    return toTransportTime(this.timeMs, this.timeline);
  }

  /** Current frame, 1..totalFrames. */
  get frame(): number {
    return toTransportTime(this.currentTime(), this.timeline).integerFrame;
  }

  get playing(): boolean {
    return this.isPlaying;
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

  /** Changes the rate from the current time on. */
  set speed(value: number) {
    this.assertAlive();
    assertValidSpeed(value);
    this.reanchor();
    this.speedValue = value;
    this.sync();
  }

  /** Plays from the current time (from frame 1 when at the end). */
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
    this.sync();
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
    this.sync();
    this.events.emit('pause', NO_PAYLOAD);
  }

  /** Goes to the start of a frame (clamped to 1..totalFrames), playing or not; emits `tick` and `frame` right away. */
  seek(frame: number): void {
    this.assertAlive();
    if (!Number.isFinite(frame)) {
      throw new Error(`Frame must be a finite number (got ${frame}).`);
    }
    const clamped = Math.min(this.totalFrames, Math.max(1, frame));
    this.moveTo(frameToTime(clamped, this.fps));
  }

  /**
   * Replaces fps and totalFrames, keeping the current time in milliseconds
   * (clamped to the new duration) and the play state; emits `tick` and `frame` right away.
   */
  setTimeline(timeline: ITransportTimeline): void {
    this.assertAlive();
    assertValidTimeline(timeline);
    const time = Math.min(this.currentTime(), timelineDuration(timeline));
    this.timeline = { fps: timeline.fps, totalFrames: timeline.totalFrames };
    this.moveTo(time);
  }

  /** Adds a listener; returns a function that removes it. */
  on<K extends TransportEventName>(event: K, listener: TransportListener<K>): () => void {
    this.assertAlive();
    return this.events.on(event, listener);
  }

  off<K extends TransportEventName>(event: K, listener: TransportListener<K>): void {
    this.events.off(event, listener);
  }

  /** Stops the frame loop and removes the listeners. Idempotent. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.cancelTick();
    this.isPlaying = false;
    this.events.clear();
    this.destroyed = true;
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error('The transport was destroyed.');
    }
  }

  /** Unclamped: may run past the end until the frame loop notices. */
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

  private moveTo(time: number): void {
    this.anchorTime = time;
    this.anchorNow = this.clock.now();
    this.sync();
    this.emitTick();
    this.emitFrame(true);
  }

  private sync(): void {
    this.onSync?.(this.time, { playing: this.isPlaying, speed: this.speedValue });
  }

  private emitTick(): void {
    this.events.emit('tick', this.time);
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

  /** Runs once per clock frame while playing; listeners may pause or seek. */
  private readonly tick = (): void => {
    this.frameHandle = null;
    if (!this.isPlaying) {
      return;
    }
    const time = this.currentTime();
    const duration = this.duration;
    if (time < duration) {
      this.scheduleTick();
      this.emitTick();
      this.emitFrame(false);
      return;
    }
    if (this.loopValue) {
      this.anchorTime = (time - duration) % duration;
      this.anchorNow = this.clock.now();
      this.sync();
      this.scheduleTick();
      this.events.emit('loop', NO_PAYLOAD);
      this.emitTick();
      this.emitFrame(true);
      return;
    }
    this.anchorTime = duration;
    this.isPlaying = false;
    this.sync();
    this.emitTick();
    this.emitFrame(false);
    this.events.emit('complete', NO_PAYLOAD);
  };
}

/** Creates a DOM-free transport; see `ITransportOptions`. */
export function createTransport(options: ITransportOptions): Transport {
  return new Transport(options);
}
