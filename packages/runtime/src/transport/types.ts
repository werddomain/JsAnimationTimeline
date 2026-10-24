// packages/runtime/src/transport/types.ts
/**
 * Contrat du transport sans DOM : horloge injectable, position dans le temps
 * (millisecondes, image fractionnaire, image entière), options et événements.
 */

import type { ListenerErrorHandler } from './EventEmitter';

/** Time source and frame scheduler (injectable for tests, games or audio). */
export interface IPlayerClock {
  /** Milliseconds, monotonic. */
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
}

/** A position on the timeline, in every unit at once. */
export interface ITransportTime {
  /** Milliseconds from the start, 0..duration. */
  timeMs: number;
  /**
   * Fractional frame: `1 + timeMs * fps / 1000`, from 1 to `totalFrames + 1`
   * (the very end of the last frame).
   */
  frame: number;
  /** Displayed frame, 1..totalFrames. */
  integerFrame: number;
}

/** Frame rate and length of the timeline driven by a transport. */
export interface ITransportTimeline {
  /** Frames per second, > 0. */
  readonly fps: number;
  /** Number of frames, integer ≥ 1. */
  readonly totalFrames: number;
}

/** Play state handed to `onSync` with the time. */
export interface ITransportSyncState {
  readonly playing: boolean;
  readonly speed: number;
}

/** Options of `createTransport`. */
export interface ITransportOptions extends ITransportTimeline {
  readonly clock: IPlayerClock;
  /** Restarts at frame 1 after the last frame. Defaults to `false`. */
  readonly loop?: boolean;
  /** Playback rate, > 0. Defaults to 1. */
  readonly speed?: number;
  /**
   * Called synchronously, before any event, whenever the time jumps or the play
   * state or speed changes (play, pause, seek, speed, loop, complete, timeline).
   * Its errors are not caught.
   */
  readonly onSync?: (time: ITransportTime, state: ITransportSyncState) => void;
  /** Receives errors thrown by event listeners. Defaults to rethrowing them asynchronously. */
  readonly onListenerError?: ListenerErrorHandler;
}

/** Payload of the `frame` event. */
export interface IFrameEvent {
  /** Current frame, 1..totalFrames. */
  readonly frame: number;
}

/** Events of the transport (and of the player) and their payloads. */
export interface ITransportEventMap {
  /**
   * The time moved: on every clock frame while playing, and after `seek`,
   * a timeline change, a loop or the end. Carries the fractional time.
   */
  tick: ITransportTime;
  /** The displayed frame changed (during playback, or after `seek`/`update`). */
  frame: IFrameEvent;
  play: Record<string, never>;
  pause: Record<string, never>;
  /** The last frame was reached without `loop`; playback stopped. */
  complete: Record<string, never>;
  /** The last frame was reached with `loop`; playback restarted at frame 1. */
  loop: Record<string, never>;
}

export type TransportEventName = keyof ITransportEventMap;

export type TransportListener<K extends TransportEventName> = (event: ITransportEventMap[K]) => void;
