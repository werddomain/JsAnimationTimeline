// packages/editor/src/model/properties/targetProperties.ts
import { sameTarget } from '@kazo-ca/timeline-runtime';
import type { ITargetInfo, ITargetPropertyInfo, LayerTarget, PropertyRegistry } from '@kazo-ca/timeline-runtime';

/** Runtime metadata queries shared by property commands and property controls. */
export interface ITargetPropertyQuery {
  readonly describe?: (target: LayerTarget) => ITargetInfo | undefined;
  readonly listTargets?: () => readonly ITargetInfo[];
}

/** Property edits use the editor registry and current stage metadata. */
export interface IPropertyEditContext extends ITargetPropertyQuery {
  readonly registry: PropertyRegistry;
}

/**
 * An explicit target property list restricts edits, including an empty list.
 * Missing metadata allows registry properties (HTML and stage-free editors).
 * Query on every use: permissions must follow target and metadata changes.
 */
export function getTargetProperties(
  target: LayerTarget | undefined,
  context: IPropertyEditContext
): ITargetInfo['properties'] {
  let properties: ITargetInfo['properties'];
  if (target !== undefined) {
    properties = context.describe?.(target)?.properties;
    if (properties === undefined) {
      properties = context.listTargets?.().find((info) => sameTarget(info.target, target))?.properties;
    }
  }
  return properties;
}

/** Reads one rich capability while keeping absent metadata unrestricted. */
export function getTargetPropertyInfo(target: LayerTarget | undefined, name: string, context: IPropertyEditContext): ITargetPropertyInfo | undefined {
  const property = getTargetProperties(target, context)?.find((entry) => (typeof entry === 'string' ? entry : entry.name) === name);
  return typeof property === 'string' ? { name: property } : property;
}

/** Numeric legacy edits exclude explicitly disabled capabilities. */
export function getTargetPropertyNames(target: LayerTarget | undefined, context: IPropertyEditContext): readonly string[] {
  const properties = getTargetProperties(target, context);
  if (properties === undefined) return context.registry.list().map(({ name }) => name);
  const names = properties.filter((property) => typeof property === 'string' || property.editable !== false)
    .map((property) => typeof property === 'string' ? property : property.name);
  return [...new Set(names.filter((name) => context.registry.has(name)))];
}
