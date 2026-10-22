// packages/editor/src/core/events/index.ts
/**
 * Point d'entrée du module d'événements du noyau : bus typé, carte
 * d'événements extensible et événements annulables.
 */

export { ERROR_PREFIX, EventBus } from './EventBus';
export type { CancellableHandler, EventBusOptions, EventHandler, EventName } from './EventBus';
export type { ICancellableEvent } from './CancellableEvent';
export type {
  EditorDestroyingEvent,
  EditorReadyEvent,
  TimelineEventMap
} from './TimelineEventMap';
