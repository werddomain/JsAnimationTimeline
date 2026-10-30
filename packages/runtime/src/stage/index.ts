// packages/runtime/src/stage/index.ts
/**
 * Point d'entrée des scènes : contrat `IStage`, routage, cycle de vie
 * (`StageHost`, sans DOM), avertissements et scène HTML par défaut.
 */

export type {
  IStage,
  IStageAbortSignal,
  IStageContext,
  IStageLayer,
  IStageLayerState,
  IStageSyncState,
  IStageTargets,
  ITargetInfo,
  ITargetPropertyInfo,
  ITargetPropertyDiagnostic
} from './types';
export { isStageDocumentError, StageDocumentError, StageReportCodes } from './reports';
export type { IStageReport, IStageReportInput, StageReportCode } from './reports';
export { refStage, sameTarget } from './routing';
export type { IRefStageOptions } from './routing';
export { StageHost } from './StageHost';
export type { IStageHostClock, IStageHostOptions } from './StageHost';
export { buildStageRegistry } from './registry';
export * from './html';
export * from './object';
