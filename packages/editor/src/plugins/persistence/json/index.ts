// packages/editor/src/plugins/persistence/json/index.ts
/**
 * Point d'entrée du plugin `persistence.json` : le plugin, sa fabrique, les
 * fonctions de lecture et d'écriture, son erreur et ses types publics.
 * L'import de `types` rend visibles l'augmentation de `EditorServiceMap` et
 * celle de `TimelineEventMap`.
 */

export {
  DEFAULT_JSON_FILE_NAME,
  PERSISTENCE_JSON_PLUGIN_ID,
  PersistenceJsonPlugin,
  createPersistenceJsonPlugin
} from './PersistenceJsonPlugin';
export { IMPORT_COMMAND_LABEL, createImportCommand } from './importCommand';
export { readDocument } from './readDocument';
export type { IReadResult } from './readDocument';
export { DEFAULT_JSON_SPACE, writeDocument } from './writeDocument';
export type { IWriteOptions } from './writeDocument';
export { PersistenceError } from './PersistenceError';
export type { PersistenceErrorCode } from './PersistenceError';
export type {
  IImportResult,
  IPersistenceJsonOptions,
  IPersistenceJsonService,
  PersistenceExportedEvent,
  PersistenceImportedEvent
} from './types';
