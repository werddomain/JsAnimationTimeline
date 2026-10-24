// packages/editor/src/core/playback/index.ts
/**
 * Point d'entrée de la lecture de l'éditeur : façade `IEditorPlayback` sur le
 * `Transport` du runtime, échantillons d'image et événements de rendu.
 */

export { createDefaultClock, createTimerClock } from './defaultClock';
export { FrameSampler } from './FrameSampler';
export { PlaybackController } from './PlaybackController';
export type { IPlaybackControllerOptions } from './PlaybackController';
export { createPlaybackFacade } from './playbackFacade';
export type { FrameRenderEvent, PlaybackStateEvent, PlayheadChangedEvent } from './playbackEvents';
export type { FrameListener, IEditorPlayback, IFrameSample, ILayerSample } from './types';
