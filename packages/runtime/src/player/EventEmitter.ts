// packages/runtime/src/player/EventEmitter.ts
/**
 * L'émetteur d'événements vit désormais dans `transport/` (sans DOM) ; ce
 * module le réexporte pour les imports existants.
 */

export { EventEmitter } from '../transport/EventEmitter';
export type { ListenerErrorHandler } from '../transport/EventEmitter';
