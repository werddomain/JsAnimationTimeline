// packages/runtime/src/properties/builtins.ts
/**
 * Propriétés intégrées de la v1 : transformations (x, y, rotation, scaleX/Y,
 * skewX/Y) et opacité.
 */

import type { PropertyDescriptor } from './types';

const BUILTINS: PropertyDescriptor[] = [
  { name: 'x', kind: 'transform', step: 'translate', cssName: 'translateX', unit: 'px', defaultValue: 0 },
  { name: 'y', kind: 'transform', step: 'translate', cssName: 'translateY', unit: 'px', defaultValue: 0 },
  { name: 'rotation', kind: 'transform', step: 'rotate', cssName: 'rotate', unit: 'deg', defaultValue: 0 },
  { name: 'scaleX', kind: 'transform', step: 'scale', cssName: 'scaleX', unit: '', defaultValue: 1 },
  { name: 'scaleY', kind: 'transform', step: 'scale', cssName: 'scaleY', unit: '', defaultValue: 1 },
  { name: 'skewX', kind: 'transform', step: 'skew', cssName: 'skewX', unit: 'deg', defaultValue: 0 },
  { name: 'skewY', kind: 'transform', step: 'skew', cssName: 'skewY', unit: 'deg', defaultValue: 0 },
  { name: 'opacity', kind: 'style', cssName: 'opacity', unit: '', defaultValue: 1, min: 0, max: 1 }
];

/** Built-in properties, in transform composition order, then style properties. */
export const BUILTIN_PROPERTIES: readonly PropertyDescriptor[] = Object.freeze(
  BUILTINS.map((descriptor) => Object.freeze(descriptor))
);

/** Names of the built-in properties. */
export const BUILTIN_PROPERTY_NAMES: readonly string[] = Object.freeze(BUILTIN_PROPERTIES.map((d) => d.name));
