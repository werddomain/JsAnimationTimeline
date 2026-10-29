// packages/runtime/src/stage/registry.ts
/**
 * Registre de propriétés d'un lecteur à plusieurs scènes : le registre de
 * base, plus les `properties` de chaque scène. Sans propriété de scène, le
 * registre de base est gardé tel quel ; sinon une copie est étendue (le
 * registre de base n'est jamais modifié).
 */

import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { IStage } from './types';

/** An error keeping the original one as `cause` (ES2022 `ErrorOptions` is not in the target lib). */
function withCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'cause', { value: cause, configurable: true, writable: true });
  return error;
}

/** Registry holding `base` and every stage's `properties`; throws on a name conflict. */
export function buildStageRegistry(base: PropertyRegistry, stages: readonly IStage[]): PropertyRegistry {
  if (stages.every((stage) => (stage.properties ?? []).length === 0)) {
    return base;
  }
  const registry = base.clone();
  for (const stage of stages) {
    for (const descriptor of stage.properties ?? []) {
      if (registry.has(descriptor.name)) {
        throw new Error(`Stage "${stage.id}" declares the property "${descriptor.name}", which is already registered. Prefix it (e.g. "${stage.id}${descriptor.name.charAt(0).toUpperCase()}${descriptor.name.slice(1)}").`);
      }
      try {
        registry.register(descriptor);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw withCause(`Stage "${stage.id}": ${reason}`, error);
      }
    }
  }
  return registry;
}
