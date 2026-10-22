// packages/editor/src/core/store/index.ts
/**
 * Point d'entrée du module Store du noyau : le conteneur du document v2,
 * son erreur de validation et ses événements.
 */

export { Store } from './Store';
export { StoreError } from './StoreError';
export type { DocumentChangedEvent, DocumentLoadedEvent } from './storeEvents';
export type { DocumentChangeCause } from '../commands/documentChange';
