// packages/editor/src/core/stage/index.ts
/**
 * Point d'entrée des scènes de l'éditeur : option `stage`, façade
 * `IEditorStage` sur le `StageHost` du runtime et événement `stage:report`.
 */

export { EditorStageHost } from './EditorStageHost';
export type { IEditorStageHostOptions } from './EditorStageHost';
export { createEditorHtmlStage } from './editorHtmlStage';
export type { IEditorHtmlStageOptions } from './editorHtmlStage';
export { resolveUserStages } from './resolveStages';
export { StageReportFeed, reportKey } from './reportFeed';
export type { IStageChoice } from './resolveStages';
export { createStageFacade } from './stageFacade';
export type { StageReportEvent, StageTargetsChangedEvent } from './stageEvents';
export type { EditorStageOption, IEditorStage, IStageHold, StageErrorHandler } from './types';
