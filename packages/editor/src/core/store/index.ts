// packages/editor/src/core/store/index.ts
/**
 * Point d'entrée du module Store du noyau : le conteneur du document v2,
 * son erreur de validation, ses avertissements et ses événements.
 */

export { Store } from './Store';
export type { StoreOptions, StoreWarningHandler } from './Store';
export { StoreError } from './StoreError';
export { UNKNOWN_PROPERTY, findUnknownTracks } from './unknownTracks';
export type { IUnknownPropertyIssue, StoreIssue } from './unknownTracks';
export type { DocumentChangedEvent, DocumentLoadedEvent } from './storeEvents';
export type { DocumentChangeCause } from '../commands/documentChange';
