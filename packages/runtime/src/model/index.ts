// packages/runtime/src/model/index.ts
/**
 * Point d'entrée du modèle de document v2 (types, constantes et utilitaires).
 */

export { SCHEMA_VERSION } from './document';
export type { ITimelineDocument, ITimelineSettings } from './document';
export type { IFolder, ILayer, ILayerNodeBase, LayerNode, LayerNodeType } from './layer';
export { TARGET_KEYS } from './target';
export type { IElementTarget, IRefTarget, ISelectorTarget, LayerTarget, SerializableLayerTarget } from './target';
export { isValidPropertyName, PROPERTY_NAME_PATTERN, RESERVED_PROPERTY_NAMES } from './names';
export type { IPropertyKeyframe, ISpan, PropertyTracks, SpanKind } from './span';
export {
  CUBIC_BEZIER_PATTERN,
  DEFAULT_EASING,
  EASING_PRESETS,
  isEasingPreset,
  parseEasing
} from './easing';
export type { CubicBezierEasing, Easing, EasingPreset, ICubicBezier } from './easing';
export { isElementTarget, isFolder, isLayer, isRefTarget, isSelectorTarget } from './guards';
export { findNodeById, flattenLayers, walkLayers } from './traverse';
export type { ILayerNodeVisit, LayerVisitor } from './traverse';
export {
  DEFAULT_COLLAPSED,
  DEFAULT_LOCKED,
  DEFAULT_VISIBLE,
  resolveCollapsed,
  resolveEasing,
  resolveLocked,
  resolveTracks,
  resolveVisible
} from './defaults';
export { validateDocument, ValidationCodes } from './validate';
export type { IValidateOptions, IValidationIssue, ValidationCode } from './validate';
export { checkDocumentShape } from './shape';
export type { IShapeOptions } from './shape';
