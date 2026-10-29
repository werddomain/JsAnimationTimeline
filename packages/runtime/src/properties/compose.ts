// packages/runtime/src/properties/compose.ts
/**
 * Passage des valeurs numériques au style CSS : chaîne `transform` complète
 * à ordre fixe, plus une entrée par propriété de style.
 */

import type { PropertyRegistry } from './PropertyRegistry';
import type { PropertyValues } from './types';
import { formatCssValue } from './values';

function hasValue(values: PropertyValues, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(values, name);
}

/** CSS declarations, kebab-case property name → CSS value. */
export type CssDeclarations = Readonly<Record<string, string>>;

/**
 * Full `transform` string in fixed order (translate → rotate → scale → skew).
 * Every transform property of the registry is written, with its default when
 * absent from `values`, so that two strings always interpolate cleanly.
 */
export function composeTransform(values: PropertyValues, registry: PropertyRegistry): string {
  return registry
    .transformProperties()
    .map((d) => `${d.cssName}(${formatCssValue(d, hasValue(values, d.name) ? values[d.name] : d.defaultValue)})`)
    .join(' ');
}

/**
 * CSS declarations for `values`. `transform` is present only when at least one
 * transform property is in `values`, first; style properties only when they
 * are, in registry order. `value` properties are ignored (no CSS name).
 * Throws for a name unknown to the registry.
 */
export function computeCssDeclarations(values: PropertyValues, registry: PropertyRegistry): CssDeclarations {
  const descriptors = Object.keys(values).map((name) => registry.require(name));
  const declarations: Record<string, string> = {};
  if (descriptors.some((d) => d.kind === 'transform')) {
    declarations.transform = composeTransform(values, registry);
  }
  for (const descriptor of registry.list()) {
    if (descriptor.kind === 'style' && hasValue(values, descriptor.name)) {
      declarations[descriptor.cssName] = formatCssValue(descriptor, values[descriptor.name]);
    }
  }
  return declarations;
}

/** `border-radius` → `borderRadius` (Web Animations keyframe keys). */
export function cssNameToCamelCase(cssName: string): string {
  return cssName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
