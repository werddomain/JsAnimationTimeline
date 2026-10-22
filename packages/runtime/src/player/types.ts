// packages/runtime/src/player/types.ts
/**
 * Contrat public du lecteur : options, événements et API.
 */

import type { ITimelineDocument } from '../model/document';
import type { PropertyRegistry } from '../properties/PropertyRegistry';

/** Time source and frame scheduler (injectable for tests). */
export interface IPlayerClock {
  /** Milliseconds, monotonic. */
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
}

/** Options of `createPlayer`. */
export interface IPlayerOptions {
  /** Where layer selectors are resolved. Defaults to `document`. */
  readonly root?: ParentNode;
  /** Starts playing right away. Defaults to `false`. */
  readonly autoplay?: boolean;
  /** Restarts at frame 1 after the last frame. Defaults to `false`. */
  readonly loop?: boolean;
  /** Playback rate, > 0. Defaults to 1. */
  readonly speed?: number;
  /** Defaults to `defaultPropertyRegistry`. */
  readonly registry?: PropertyRegistry;
  /** Defaults to `performance.now` and `requestAnimationFrame`. */
  readonly clock?: IPlayerClock;
  /**
   * Receives errors thrown by event listeners (playback goes on). Defaults to
   * rethrowing them asynchronously, so they reach the console.
   */
  readonly onListenerError?: (error: unknown) => void;
}

/** Payload of the `frame` event. */
export interface IFrameEvent {
  /** Current frame, 1..totalFrames. */
  readonly frame: number;
}

/** Events of the player and their payloads. */
export interface IPlayerEventMap {
  /** The displayed frame changed (during playback, or after `seek`/`update`). */
  frame: IFrameEvent;
  play: Record<string, never>;
  pause: Record<string, never>;
  /** The last frame was reached without `loop`; playback stopped. */
  complete: Record<string, never>;
  /** The last frame was reached with `loop`; playback restarted at frame 1. */
  loop: Record<string, never>;
}

export type PlayerEventName = keyof IPlayerEventMap;

export type PlayerListener<K extends PlayerEventName> = (event: IPlayerEventMap[K]) => void;

/** Headless player of a timeline document, built on the Web Animations API. */
export interface IPlayer {
  /** Current frame, 1..totalFrames. */
  readonly frame: number;
  readonly totalFrames: number;
  readonly fps: number;
  /** Length in milliseconds: totalFrames / fps. */
  readonly duration: number;
  readonly playing: boolean;
  loop: boolean;
  /** Playback rate, > 0 (no reverse playback). */
  speed: number;
  /** Ids of the layers whose target was not found in `root`. */
  readonly missingTargets: readonly string[];
  play(): void;
  pause(): void;
  /** Goes to a frame (clamped to 1..totalFrames), playing or not. */
  seek(frame: number): void;
  /** Replaces the document, keeping the current time and play state. */
  update(doc: ITimelineDocument): void;
  /** Adds a listener; returns a function that removes it. */
  on<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): () => void;
  off<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): void;
  /** Stops, removes every animation (targets get their own styles back) and listeners. */
  destroy(): void;
}
