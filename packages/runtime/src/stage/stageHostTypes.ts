// packages/runtime/src/stage/stageHostTypes.ts
/**
 * Types de `StageHost` : options publiques, et états internes (liaison d'un
 * calque à sa scène, état sauvegardé pour annuler un document refusé).
 */

import type { ITimelineDocument } from '../model/document';
import type { ILayer } from '../model/layer';
import type { LayerTarget } from '../model/target';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { ITransportSyncState, ITransportTime } from '../transport/types';
import type { IStageReport } from './reports';
import type { StageErrorHandler } from './StageReporter';
import type { IStage } from './types';

/** Current position and play state, read when targets are refreshed. */
export interface IStageHostClock {
  readonly time: ITransportTime;
  readonly state: ITransportSyncState;
}

/** Options of `StageHost`. */
export interface IStageHostOptions {
  readonly stages: readonly IStage[];
  /** Registry handed to the stages and used to evaluate (already holds the stages' properties). */
  readonly registry: PropertyRegistry;
  /** Receives the errors thrown by the stages (first per stage and per layer). */
  readonly onError: StageErrorHandler;
  /** Called for every new report. */
  readonly onReport?: (report: IStageReport) => void;
  /** Current time and play state, to re-apply a stage after a refresh. */
  readonly now: () => IStageHostClock;
  /**
   * Eye of a layer in the editor, read on every `render` (`editorVisible` of
   * the layer states). Defaults to always true, the player behaviour.
   */
  readonly isEditorVisible?: (layerId: string) => boolean;
  /**
   * Called after a retry (`refresh`, or a stage's `targets.subscribe`)
   * changed the bindings, once `missingTargets` is updated and the stages
   * are re-applied. Not called by `load` (the owner knows the document changed).
   */
  readonly onTargetsChanged?: () => void;
}

/** A routed layer and its cached resolution (`object` null: resolution failed). */
export interface IBinding {
  readonly layerId: string;
  readonly target: LayerTarget;
  readonly stage: IStage;
  readonly object: unknown;
  readonly resolved: boolean;
}

/** What `load` changes, saved to roll back a refused document. */
export interface IHostState {
  readonly doc: ITimelineDocument | null;
  readonly bindings: ReadonlyMap<string, IBinding>;
  readonly prepared: ReadonlyMap<string, ILayer>;
}
