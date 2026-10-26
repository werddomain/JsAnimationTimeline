// packages/editor/src/model/properties/targetProperties.ts
import { sameTarget } from '@werddomain/timeline-runtime';
import type { ITargetInfo, LayerTarget, PropertyRegistry } from '@werddomain/timeline-runtime';

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
export function getTargetPropertyNames(
  target: LayerTarget | undefined,
  context: IPropertyEditContext
): readonly string[] {
  let properties: ITargetInfo['properties'];
  if (target !== undefined) {
    properties = context.describe?.(target)?.properties;
    if (properties === undefined) {
      properties = context.listTargets?.().find((info) => sameTarget(info.target, target))?.properties;
    }
  }
  if (properties === undefined) return context.registry.list().map(({ name }) => name);
  const names = properties.map((property) => typeof property === 'string' ? property : property.name);
  return [...new Set(names.filter((name) => context.registry.has(name)))];
}
