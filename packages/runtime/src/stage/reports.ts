// packages/runtime/src/stage/reports.ts
/**
 * Avertissements des scènes (`player.warnings`, puis `stage:report` dans
 * l'éditeur) et erreur qui refuse un document. La liste est remise à zéro à
 * chaque document ; un même avertissement n'y figure qu'une fois.
 */

/** Codes of the stage reports. */
export const StageReportCodes = {
  /** The target names a `stage` that is not among the stages. */
  UNKNOWN_STAGE: 'unknown-stage',
  /** No stage accepts the target of the layer. */
  UNROUTED: 'unrouted',
  /** Several layers animate the same object of a stage. */
  DUPLICATE_TARGET: 'duplicate-target',
  /** A track names a property unknown to the registry; the track is skipped. */
  UNKNOWN_PROPERTY: 'unknown-property',
  /** A stage method threw (reported to `onListenerError` too). */
  STAGE_ERROR: 'stage-error'
} as const;

export type StageReportCode = (typeof StageReportCodes)[keyof typeof StageReportCodes];

/** A warning about the stages, for the current document. */
export interface IStageReport {
  readonly code: StageReportCode;
  readonly message: string;
  /** Stage concerned (absent for `unrouted`). */
  readonly stageId?: string;
  readonly layerId?: string;
  /** Skipped track, for `unknown-property`. */
  readonly property?: string;
  /** Thrown value, for `stage-error`. */
  readonly error?: unknown;
}

/** A report sent by a stage through `IStageContext.report` (its id is filled in). */
export type IStageReportInput = Omit<IStageReport, 'stageId'>;

/**
 * Thrown by `IStage.update` to refuse a document (e.g. Web Animations missing
 * on a target). The stage must then keep its previous state: the player
 * throws, keeps the previous document and calls `update` again with it on the
 * stages that had already accepted the new one.
 */
export class StageDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StageDocumentError';
    Object.setPrototypeOf(this, StageDocumentError.prototype);
  }
}

/** True for a `StageDocumentError`. */
export function isStageDocumentError(error: unknown): error is StageDocumentError {
  return error instanceof StageDocumentError;
}
