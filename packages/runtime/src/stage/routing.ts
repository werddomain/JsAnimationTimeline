// packages/runtime/src/stage/routing.ts
/**
 * Routage d'un calque vers une scène :
 * - une cible avec `stage` ne consulte que la scène de cet id (id inconnu :
 *   `unknown-stage`) ;
 * - sans `stage`, la première scène du tableau dont `accepts` renvoie true ;
 * - aucune : `unrouted`.
 * Plus la vérification des scènes à la création et l'aide `refStage`.
 */

import { isElementTarget, isRefTarget, isSelectorTarget } from '../model/guards';
import type { LayerTarget } from '../model/target';
import type { IStage } from './types';

/** Options of `refStage`. */
export interface IRefStageOptions {
  /** Also accept `{ ref }` targets without `stage`. Defaults to `false`. */
  readonly unscoped?: boolean;
}

/**
 * `accepts` for a stage of id `id`: `{ ref, stage: id }` targets, plus
 * `{ ref }` without `stage` when `unscoped`.
 */
export function refStage(id: string, options: IRefStageOptions = {}): (target: LayerTarget) => boolean {
  const unscoped = options.unscoped === true;
  return (target) => isRefTarget(target) && (target.stage === id || (unscoped && target.stage === undefined));
}

/** True when two targets designate the same object (same key and value). */
export function sameTarget(a: LayerTarget | undefined, b: LayerTarget | undefined): boolean {
  if (a === b) {
    return true;
  }
  if (isSelectorTarget(a) && isSelectorTarget(b)) {
    return a.selector === b.selector;
  }
  if (isRefTarget(a) && isRefTarget(b)) {
    return a.ref === b.ref && a.stage === b.stage;
  }
  if (isElementTarget(a) && isElementTarget(b)) {
    return a.element === b.element;
  }
  return false;
}

/** Targets named by a stage's `subscribe` notification; anything but an array of objects counts as none. */
export function toTargetList(value: unknown): LayerTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (value as unknown[]).filter((item): item is LayerTarget => typeof item === 'object' && item !== null);
}

function assertValidStage(stage: IStage, index: number): void {
  if (typeof stage !== 'object' || stage === null) {
    throw new Error(`Stage #${index} must be an object.`);
  }
  if (typeof stage.id !== 'string' || stage.id.length === 0) {
    throw new Error(`Stage #${index} needs a non-empty string id.`);
  }
  if (typeof stage.accepts !== 'function' || typeof stage.resolve !== 'function') {
    throw new Error(`Stage "${stage.id}" must implement accepts and resolve.`);
  }
  if (typeof stage.sync !== 'function' && typeof stage.render !== 'function') {
    throw new Error(`Stage "${stage.id}" must implement sync, render or both.`);
  }
}

/** Throws for a malformed stage or two stages with the same id. */
export function assertValidStages(stages: readonly IStage[]): void {
  const ids = new Set<string>();
  stages.forEach((stage, index) => {
    assertValidStage(stage, index);
    if (ids.has(stage.id)) {
      throw new Error(`Two stages have the id "${stage.id}".`);
    }
    ids.add(stage.id);
  });
}

/** Result of routing one target. */
export type RouteResult =
  | { readonly kind: 'stage'; readonly stage: IStage }
  | { readonly kind: 'unknown-stage'; readonly stageId: string }
  | { readonly kind: 'unrouted' };

/**
 * Stage of `target`. `accepts` is guarded by `safeAccepts` (a throwing
 * `accepts` counts as false and is reported by the caller).
 */
export function routeTarget(
  target: LayerTarget,
  stages: readonly IStage[],
  safeAccepts: (stage: IStage, target: LayerTarget) => boolean
): RouteResult {
  if (isRefTarget(target) && target.stage !== undefined) {
    const named = stages.find((stage) => stage.id === target.stage);
    if (named === undefined) {
      return { kind: 'unknown-stage', stageId: target.stage };
    }
    return safeAccepts(named, target) ? { kind: 'stage', stage: named } : { kind: 'unrouted' };
  }
  const stage = stages.find((candidate) => safeAccepts(candidate, target));
  return stage === undefined ? { kind: 'unrouted' } : { kind: 'stage', stage };
}
