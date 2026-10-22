// packages/runtime/src/player/index.ts
/**
 * Point d'entrée du lecteur Web Animations.
 */

export { createPlayer, Player } from './Player';
export { buildLayerKeyframes, frameToOffset } from './keyframes';
export { resolveTarget } from './targets';
export { createBrowserClock } from './clock';
export { EventEmitter } from './EventEmitter';
export type { ListenerErrorHandler } from './EventEmitter';
export type {
  IFrameEvent,
  IPlayer,
  IPlayerClock,
  IPlayerEventMap,
  IPlayerOptions,
  PlayerEventName,
  PlayerListener
} from './types';
