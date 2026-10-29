// packages/editor/src/core/stage/propertyEditContext.ts
import type { IStage, PropertyRegistry } from '@kazo-ca/timeline-runtime';
import { PropertyOperationError } from '../../model/properties/propertyValue';
import type { IPropertyEditContext } from '../../model/properties/targetProperties';
import { readTargetInfo } from './targetInfo';

/** Creates the strict metadata query used by property editing services. */
export function createStagePropertyEditContext(
  registry: PropertyRegistry, stages: readonly IStage[]
): IPropertyEditContext {
  return {
    registry,
    describe: (target) => {
      try { return readTargetInfo(stages, target); }
      catch { throw new PropertyOperationError('Les propriétés de la cible sont indisponibles.'); }
    }
  };
}
