// packages/runtime/src/playback/types.ts
import type { SerializableLayerTarget } from '../model/target';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { TimelinePropertyValues } from '../properties/timelineValues';
import type { ListenerErrorHandler } from '../transport/EventEmitter';
import type { IPlayerClock, ITransportTime, TransportEventName, TransportListener } from '../transport/types';

/** A source object remains distinct even when several HTML targets overlap. */
export interface IPlaybackObject {
  readonly name: string;
  readonly target?: SerializableLayerTarget;
}

/** A complete snapshot of the recorded properties, never all properties of the host object. */
export interface IPlaybackObjectState {
  readonly active: boolean;
  readonly values: TimelinePropertyValues;
}

export type IPlaybackFrame = Readonly<Record<string, IPlaybackObjectState>>;

/** Integer-frame samples; the editable document and its curves are saved separately. */
export interface IPlaybackDocument {
  readonly version: 1;
  readonly sampling: 'frames';
  readonly fps: number;
  readonly totalFrames: number;
  readonly objects: Readonly<Record<string, IPlaybackObject>>;
  readonly frames: Readonly<Record<string, IPlaybackFrame>>;
}

export interface IPlaybackDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly layerId?: string;
  readonly property?: string;
  readonly frame?: number;
}

export type PlaybackResult<T> =
  | { readonly status: 'exported'; readonly data: T; readonly diagnostics: readonly IPlaybackDiagnostic[] }
  | { readonly status: 'refused'; readonly diagnostics: readonly IPlaybackDiagnostic[] };

export interface ICompilePlaybackOptions {
  readonly registry?: PropertyRegistry;
  /** Lower the bounded compilation budget; cannot raise the runtime hard limit. */
  readonly maxCells?: number;
}

export interface IPlaybackPlayerOptions {
  /** Explicit clock: this generic reader never assumes a DOM or starts its own browser stage. */
  readonly clock: IPlayerClock;
  readonly render?: (snapshot: IPlaybackFrame, time: ITransportTime) => void;
  readonly speed?: number;
  readonly loop?: boolean;
  readonly onListenerError?: ListenerErrorHandler;
}

export interface IPlaybackPlayer {
  readonly fps: number;
  readonly totalFrames: number;
  readonly duration: number;
  readonly timeMs: number;
  readonly time: ITransportTime;
  readonly frame: number;
  readonly playing: boolean;
  speed: number;
  loop: boolean;
  play(): void;
  pause(): void;
  seek(frame: number): void;
  sample(frame?: number): IPlaybackFrame;
  on<K extends TransportEventName>(event: K, listener: TransportListener<K>): () => void;
  off<K extends TransportEventName>(event: K, listener: TransportListener<K>): void;
  destroy(): void;
}
