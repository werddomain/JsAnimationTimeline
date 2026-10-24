// packages/runtime/src/player/types.ts
/**
 * Contrat public du lecteur : options, événements et API.
 */

import type { ITimelineDocument } from '../model/document';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { IStageReport } from '../stage/reports';
import type { IStage } from '../stage/types';
import type { IPlayerClock, ITransportEventMap, ITransportTime } from '../transport/types';

export type { IFrameEvent, IPlayerClock } from '../transport/types';

/** Options of `createPlayer`. */
export interface IPlayerOptions {
  /**
   * Where the default HTML stage resolves layer selectors. Defaults to
   * `document`. Not allowed together with `stage`.
   */
  readonly root?: ParentNode;
  /**
   * Stage(s) animating the layers, in routing order (see `IStage`). Defaults
   * to `createHtmlStage({ root, mode: 'waapi' })`. Their `properties` are
   * added to a copy of `registry`. The player never destroys a stage's objects.
   */
  readonly stage?: IStage | readonly IStage[];
  /** Starts playing right away. Defaults to `false`. */
  readonly autoplay?: boolean;
  /** Restarts at frame 1 after the last frame. Defaults to `false`. */
  readonly loop?: boolean;
  /** Playback rate, > 0. Defaults to 1. */
  readonly speed?: number;
  /** Defaults to `defaultPropertyRegistry` (copied and extended when a stage has `properties`). */
  readonly registry?: PropertyRegistry;
  /** Defaults to `performance.now` and `requestAnimationFrame`. */
  readonly clock?: IPlayerClock;
  /**
   * Receives errors thrown by event listeners and by the stages (only the
   * first one per stage and per layer until the next document); playback
   * goes on. Defaults to
   * rethrowing them asynchronously, so they reach the console.
   */
  readonly onListenerError?: (error: unknown) => void;
}

/**
 * Events of the player and their payloads: those of the transport (`frame`,
 * `tick` with the fractional time, `play`, `pause`, `complete`, `loop`).
 */
export type IPlayerEventMap = ITransportEventMap;

export type PlayerEventName = keyof IPlayerEventMap;

export type PlayerListener<K extends PlayerEventName> = (event: IPlayerEventMap[K]) => void;

/** Headless player of a timeline document, rendered by stages (Web Animations by default). */
export interface IPlayer {
  /** Current frame, 1..totalFrames. */
  readonly frame: number;
  /** Current position: milliseconds, fractional frame and integer frame. */
  readonly time: ITransportTime;
  readonly totalFrames: number;
  readonly fps: number;
  /** Length in milliseconds: totalFrames / fps. */
  readonly duration: number;
  readonly playing: boolean;
  loop: boolean;
  /** Playback rate, > 0 (no reverse playback). */
  speed: number;
  /**
   * Ids of the layers without an animated object: no target, unknown stage,
   * accepted by no stage, or not resolved by their stage (e.g. a selector that
   * matches nothing or is invalid).
   */
  readonly missingTargets: readonly string[];
  /** Warnings of the stages for the current document (reset by `update`). */
  readonly warnings: readonly IStageReport[];
  play(): void;
  pause(): void;
  /** Goes to a frame (clamped to 1..totalFrames), playing or not; emits `tick` and `frame` right away. */
  seek(frame: number): void;
  /** Replaces the document, keeping the current time and play state; emits `tick` and `frame` right away. */
  update(doc: ITimelineDocument): void;
  /** Adds a listener; returns a function that removes it. */
  on<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): () => void;
  off<K extends PlayerEventName>(event: K, listener: PlayerListener<K>): void;
  /**
   * Retries the failed target resolutions (only that layer's when given), for
   * objects created after the document was loaded.
   */
  refreshTargets(layerId?: string): void;
  /** Stops, releases every layer then detaches the stages (targets get their own styles back), removes listeners. */
  destroy(): void;
}
