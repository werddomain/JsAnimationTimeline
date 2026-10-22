// packages/runtime/src/properties/compose.ts
/**
 * Passage des valeurs numériques au style CSS : chaîne `transform` complète
 * à ordre fixe, plus une entrée par propriété de style.
 */

import type { PropertyRegistry } from './PropertyRegistry';
import type { PropertyValues } from './types';
import { formatCssValue } from './values';

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
    .map((d) => `${d.cssName}(${formatCssValue(d, values[d.name] ?? d.defaultValue)})`)
    .join(' ');
}

/**
 * CSS declarations for `values`. `transform` is present only when at least one
 * transform property is in `values`; style properties only when they are.
 * Throws for a name unknown to the registry.
 */
export function computeCssDeclarations(values: PropertyValues, registry: PropertyRegistry): CssDeclarations {
  const declarations: Record<string, string> = {};
  let hasTransform = false;
  for (const [name, value] of Object.entries(values)) {
    const descriptor = registry.require(name);
    if (descriptor.kind === 'transform') {
      hasTransform = true;
    } else {
      declarations[descriptor.cssName] = formatCssValue(descriptor, value);
    }
  }
  return hasTransform ? { transform: composeTransform(values, registry), ...declarations } : declarations;
}

/** `border-radius` → `borderRadius` (Web Animations keyframe keys). */
export function cssNameToCamelCase(cssName: string): string {
  return cssName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
