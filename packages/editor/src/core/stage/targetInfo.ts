// packages/editor/src/core/stage/targetInfo.ts
import { isRefTarget, sameTarget } from '@werddomain/timeline-runtime';
import type { IStage, ITargetInfo, LayerTarget } from '@werddomain/timeline-runtime';

/** Internal routing query. Errors propagate to the caller's reporting policy. */
export function routeOf(stages: readonly IStage[], target: LayerTarget): IStage | undefined {
  if (isRefTarget(target) && target.stage !== undefined) return stages.find((stage) => stage.id === target.stage);
  return stages.find((stage) => stage.accepts(target));
}

/**
 * Reads fresh metadata from only the routed stage, without resolving an object.
 * Scoped and unscoped refs alias each other only inside that chosen stage.
 */
export function readTargetInfo(stages: readonly IStage[], target: LayerTarget): ITargetInfo | undefined {
  const stage = routeOf(stages, target);
  if (stage === undefined) return undefined;
  const description = stage.targets?.describe?.(target);
  if (description?.properties !== undefined) return description;
  const targets = stage.targets?.list() ?? [];
  const listed = targets.find(({ target: candidate }) => {
    if (sameTarget(candidate, target)) return true;
    return isRefTarget(candidate) && isRefTarget(target) && candidate.ref === target.ref &&
      (candidate.stage ?? stage.id) === (target.stage ?? stage.id);
  });
  if (description === undefined) return listed;
  return listed?.properties === undefined ? description : { ...description, properties: listed.properties };
}
