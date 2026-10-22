// packages/runtime/src/migrate/issues.ts
/**
 * Avertissements et erreurs de la migration v1 → v2. Un avertissement
 * signale une donnée corrigée ou ignorée ; une erreur signale un document
 * qu'on ne sait pas convertir du tout.
 */

/** Warning codes: something in the v1 input was fixed or dropped. */
export const MigrationWarningCodes = {
  /** `settings.frameRate` is missing, not an integer or outside 1..240; the fps was adjusted. */
  FPS_ADJUSTED: 'fps-adjusted',
  /** A layer entry is not an object, or a folder's `children` is not an array; it was dropped. */
  INVALID_NODE: 'invalid-node',
  /** The node `type` is missing or unknown; it was inferred from `children`. */
  NODE_TYPE_INFERRED: 'node-type-inferred',
  /** The id is missing, empty or already used; a new one was generated. */
  ID_GENERATED: 'id-generated',
  /** The name is missing or not a string; the id is used instead. */
  NAME_DEFAULTED: 'name-defaulted',
  /** A folder has keyframes or tweens; they were ignored. */
  FOLDER_CONTENT_IGNORED: 'folder-content-ignored',
  /** A keyframe is not an object, or its frame is not an integer in 1..totalFrames; it was dropped. */
  INVALID_KEYFRAME: 'invalid-keyframe',
  /** Several keyframes share a frame; one was kept (a solid one when there is one). */
  DUPLICATE_KEYFRAME: 'duplicate-keyframe',
  /** A tween is not an object, or its frames are invalid; it was dropped. */
  INVALID_TWEEN: 'invalid-tween',
  /** A tween ends after the last frame; it now ends at the last frame. */
  TWEEN_TRUNCATED: 'tween-truncated',
  /** A tween starts or ends where there is no keyframe; a solid keyframe was added. */
  TWEEN_KEYFRAME_ADDED: 'tween-keyframe-added',
  /** A hollow keyframe lies inside a tween; its span stays blank. */
  TWEEN_ON_BLANK_KEYFRAME: 'tween-on-blank-keyframe',
  /** The tween `type` is not a known easing; the default easing is used. */
  UNKNOWN_EASING: 'unknown-easing'
} as const;

export type MigrationWarningCode = (typeof MigrationWarningCodes)[keyof typeof MigrationWarningCodes];

/** One fix applied to the v1 input. */
export interface IMigrationWarning {
  /** JSON-pointer-like path in the v1 input, e.g. `/layers/0/tweens/1/type`. */
  readonly path: string;
  readonly code: MigrationWarningCode;
  readonly message: string;
}

/** Error codes: the input cannot be converted. */
export const MigrationErrorCodes = {
  /** The input is not a JSON object. */
  NOT_AN_OBJECT: 'not-an-object',
  /** `version` is missing or its major is neither 1 nor 2. */
  UNSUPPORTED_VERSION: 'unsupported-version',
  /** `settings` is missing or `settings.totalFrames` is not a positive safe integer. */
  INVALID_SETTINGS: 'invalid-settings',
  /** `layers` is not an array. */
  INVALID_LAYERS: 'invalid-layers',
  /** Folders are nested deeper than `MAX_FOLDER_DEPTH`. */
  TOO_DEEP: 'too-deep'
} as const;

export type MigrationErrorCode = (typeof MigrationErrorCodes)[keyof typeof MigrationErrorCodes];

/** Thrown when a document cannot be converted. */
export class MigrationError extends Error {
  readonly code: MigrationErrorCode;

  constructor(code: MigrationErrorCode, message: string) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
  }
}
