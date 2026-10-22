// packages/runtime/src/properties/index.ts
/**
 * Point d'entrée du registre de propriétés (types, propriétés intégrées,
 * interpolation et composition CSS).
 */

export { TRANSFORM_STEPS } from './types';
export type {
  IStylePropertyDescriptor,
  ITransformPropertyDescriptor,
  PropertyDescriptor,
  PropertyInterpolator,
  PropertyKind,
  PropertyValues,
  TransformStep
} from './types';
export { BUILTIN_PROPERTIES, BUILTIN_PROPERTY_NAMES } from './builtins';
export {
  assertValidDescriptor,
  createPropertyRegistry,
  defaultPropertyRegistry,
  PropertyRegistry,
  registerProperty
} from './PropertyRegistry';
export { clampValue, CSS_VALUE_PRECISION, formatCssValue, interpolateValue, lerp, roundCssNumber } from './values';
export { composeTransform, computeCssDeclarations, cssNameToCamelCase } from './compose';
export type { CssDeclarations } from './compose';
