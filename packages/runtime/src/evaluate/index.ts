// packages/runtime/src/evaluate/index.ts
/**
 * Point d'entrée de l'évaluation : valeur de chaque propriété à l'image N.
 */

export { cubicBezierFunction, createEasingFunction } from './easingFunction';
export type { EasingFunction } from './easingFunction';
export { valueAtFrame, withImplicitStart } from './track';
export type { ISpanRange } from './track';
export { collectLayerProperties, evaluateLayer, findSpanAt } from './evaluateLayer';
export type { IEvaluateOptions, ILayerFrameState } from './evaluateLayer';
export { clampFrame, collectLayers, evaluateDocument } from './evaluateDocument';
export {
  applyUnknownPropertyPolicy,
  EvaluateIssueCodes,
  findUnknownProperties
} from './unknownProperties';
export type {
  EvaluateIssueCode,
  EvaluateIssueListener,
  IEvaluateIssue,
  UnknownPropertyPolicy
} from './unknownProperties';
