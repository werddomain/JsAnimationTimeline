// packages/editor/src/core/stage/index.ts
/**
 * Point d'entrée des scènes de l'éditeur : option `stage`, façade
 * `IEditorStage` sur le `StageHost` du runtime et événement `stage:report`.
 */

export { EditorStageHost } from './EditorStageHost';
export type { IEditorStageHostOptions } from './EditorStageHost';
export { createDefaultHtmlStage, resolveUserStages } from './resolveStages';
export type { IStageChoice } from './resolveStages';
export { createStageFacade } from './stageFacade';
export type { StageReportEvent } from './stageEvents';
export type { EditorStageOption, IEditorStage, StageErrorHandler } from './types';
