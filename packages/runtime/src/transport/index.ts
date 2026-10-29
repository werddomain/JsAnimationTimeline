// packages/runtime/src/transport/index.ts
/**
 * Point d'entrée du transport sans DOM (temps, images, boucle, vitesse) et de
 * l'horloge manuelle. `IPlayerClock`, `IFrameEvent` et `EventEmitter` sont
 * exportés par le lecteur (`player/`) sous leur nom historique.
 */

export { createTransport, Transport } from './Transport';
export { createManualClock } from './manualClock';
export type { IManualClock } from './manualClock';
export { frameToTime, timelineDuration, toTransportTime } from './time';
export type {
  ITransportEventMap,
  ITransportOptions,
  ITransportSyncState,
  ITransportTime,
  ITransportTimeline,
  TransportEventName,
  TransportListener
} from './types';
