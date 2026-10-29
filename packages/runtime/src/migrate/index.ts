// packages/runtime/src/migrate/index.ts
/**
 * Point d'entrée du migrateur de documents v1 → v2.
 */

export { isV1Document, migrateToV2, migrateV1, V1_DEFAULT_FPS } from './migrate-v1';
export type { IMigrationResult } from './migrate-v1';
export { MAX_FOLDER_DEPTH } from './layers';
export { MigrationError, MigrationErrorCodes, MigrationWarningCodes } from './issues';
export type { IMigrationWarning, MigrationErrorCode, MigrationWarningCode } from './issues';
export type { IV1Keyframe, IV1Layer, IV1Settings, IV1TimelineDocument, IV1Tween } from './v1-types';
