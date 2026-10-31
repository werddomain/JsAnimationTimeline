// packages/runtime/src/stage/html/index.ts
/**
 * Point d'entrée de la scène HTML (modes `waapi` et `frame`).
 */

export { createHtmlStage, HTML_STAGE_ID } from './createHtmlStage';
export type { HtmlStageMode, IHtmlStage, IHtmlStageOptions } from './createHtmlStage';
export { TARGET_ATTRIBUTE } from './elements';
export type { HtmlStageRefs } from './elements';
export type { IHtmlAnimationContext, IHtmlConflictResolution, IHtmlResolutionDiagnostic,
  IHtmlResolutionPlan, IHtmlResolvedLayer, IHtmlResolvedElementState, IHtmlResolvedProperty,
  HtmlResolvedSample, HtmlBeforeFirstPolicy } from './animationTypes';
export type { HtmlPropertyBinding, IHtmlGradientDefinition, IHtmlGradientStop,
  IHtmlResolvedBinding, HtmlTransformValues, HtmlTransformComponent } from './cssTypes';
export type { IHtmlPropertyInspection, IHtmlInspectPropertyOptions } from './propertyInspection';
export { cloneHtmlAnimationContext } from './animationContext';
export { prepareHtmlResolution } from './resolution';
export { resolveHtmlConflict, removeHtmlConflictResolution } from './conflicts';
export { resolveHtmlBinding } from './cssBindings';
export { readHtmlPropertyBase, captureHtmlTransformBase } from './cssBaseline';
export { composeHtmlDeclarations } from './cssCompose';
export { withPreparedHtmlExport } from './exportPreparation';
export type { IPrepareHtmlExportOptions, IPreparedHtmlExport } from './exportPreparation';
export type { IHtmlResolvedTrajectory, IHtmlResolvedElementTrajectories } from './animationTypes';
