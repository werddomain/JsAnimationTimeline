// packages/runtime/src/stage/StageReporter.ts
/**
 * Avertissements et erreurs des scènes pour le document courant :
 * - un avertissement n'est ajouté qu'une fois (même code, scène, calque,
 *   propriété) ;
 * - une erreur de scène part dans `onError` la première fois par scène et par
 *   calque, puis elle est ignorée jusqu'au prochain document (`reset`) ;
 * - une erreur levée par `onError` lui-même est relancée en asynchrone.
 */

import type { IEvaluateIssue } from '../evaluate/unknownProperties';
import { StageReportCodes } from './reports';
import type { IStageReport } from './reports';

/** Receives the errors thrown by the stages. */
export type StageErrorHandler = (error: unknown) => void;

/** Saved state, to roll back a refused document. */
export interface IStageReporterState {
  readonly reports: readonly IStageReport[];
  readonly keys: ReadonlySet<string>;
  readonly muted: ReadonlySet<string>;
}

function reportKey(report: IStageReport): string {
  return [report.code, report.stageId ?? '', report.layerId ?? '', report.property ?? ''].join('\u0000');
}

function errorKey(stageId: string, layerId: string | undefined): string {
  return layerId === undefined ? stageId : `${stageId}\u0000${layerId}`;
}

/** The timer every JavaScript host provides (typed here without the DOM or Node libs). */
interface ITimerHost {
  setTimeout(callback: () => void, delayMs: number): unknown;
}

/** Rethrows outside the caller's stack. */
export function rethrowAsync(error: unknown): void {
  (globalThis as unknown as ITimerHost).setTimeout(() => {
    throw error;
  }, 0);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** See the module comment. */
export class StageReporter {
  private reports: IStageReport[] = [];
  private keys = new Set<string>();
  private muted = new Set<string>();

  constructor(
    private readonly onError: StageErrorHandler,
    private readonly onReport?: (report: IStageReport) => void
  ) {}

  /** Reports of the current document, in order of arrival. */
  get list(): readonly IStageReport[] {
    return Object.freeze(this.reports.slice());
  }

  /** New document: no report, every error reported again. */
  reset(): void {
    this.reports = [];
    this.keys = new Set();
    this.muted = new Set();
  }

  save(): IStageReporterState {
    return { reports: this.reports.slice(), keys: new Set(this.keys), muted: new Set(this.muted) };
  }

  restore(state: IStageReporterState): void {
    this.reports = state.reports.slice();
    this.keys = new Set(state.keys);
    this.muted = new Set(state.muted);
  }

  /** Adds `report` unless the same one is already there. */
  add(report: IStageReport): void {
    const key = reportKey(report);
    if (this.keys.has(key)) {
      return;
    }
    this.keys.add(key);
    const frozen = Object.freeze({ ...report });
    this.reports.push(frozen);
    try {
      this.onReport?.(frozen);
    } catch (handlerError) {
      rethrowAsync(handlerError);
    }
  }

  /** A track of a layer of `stageId` names a property unknown to the registry. */
  unknownProperty(stageId: string, issue: IEvaluateIssue): void {
    this.add({ code: StageReportCodes.UNKNOWN_PROPERTY, stageId, layerId: issue.layerId, property: issue.property, message: issue.message });
  }

  /** A layer naming the unknown stage `stageId`, or (without it) accepted by no stage. */
  unrouted(layerId: string, stageId: string | undefined): void {
    if (stageId !== undefined) {
      this.add({ code: StageReportCodes.UNKNOWN_STAGE, stageId, layerId, message: `Layer "${layerId}" names the unknown stage "${stageId}".` });
    } else {
      this.add({ code: StageReportCodes.UNROUTED, layerId, message: `No stage accepts the target of layer "${layerId}".` });
    }
  }

  /** An error thrown by a stage (or reported by it): the first per stage and layer goes to `onError`. */
  error(stageId: string, layerId: string | undefined, error: unknown): void {
    const key = errorKey(stageId, layerId);
    if (this.muted.has(key)) {
      return;
    }
    this.muted.add(key);
    const where = layerId === undefined ? '' : ` (layer "${layerId}")`;
    this.add({
      code: StageReportCodes.STAGE_ERROR,
      stageId,
      layerId,
      error,
      message: `Stage "${stageId}"${where} threw: ${describeError(error)}`
    });
    // A throwing handler must not leave a load or a destroy half done.
    try {
      this.onError(error);
    } catch (handlerError) {
      rethrowAsync(handlerError);
    }
  }

  /** Runs `action`; a thrown error is reported and `fallback` returned. */
  guard<R>(stageId: string, layerId: string | undefined, action: () => R, fallback: R): R {
    try {
      return action();
    } catch (error) {
      this.error(stageId, layerId, error);
      return fallback;
    }
  }
}
