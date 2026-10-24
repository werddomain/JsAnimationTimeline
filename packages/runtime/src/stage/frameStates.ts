// packages/runtime/src/stage/frameStates.ts
/**
 * Valeurs des calques d'une scène à un instant, par l'évaluation fusionnée
 * (R2). Les pistes inconnues sont retirées une fois par document
 * (`prepareStageLayer`, politique `skip`), pas à chaque image.
 */

import { applyUnknownPropertyPolicy } from '../evaluate/unknownProperties';
import type { EvaluateIssueListener } from '../evaluate/unknownProperties';
import { evaluateLayer } from '../evaluate/evaluateLayer';
import type { ILayer } from '../model/layer';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { ITransportTime } from '../transport/types';
import type { IStageLayer, IStageLayerState } from './types';

/** `layer` without its tracks unknown to `registry`, each one reported to `onIssue`. */
export function prepareStageLayer(layer: ILayer, registry: PropertyRegistry, onIssue: EvaluateIssueListener): ILayer {
  return applyUnknownPropertyPolicy(layer, registry, 'skip', onIssue);
}

/** Frame evaluated at `time`: the fractional frame clamped to 1..totalFrames (the end holds the last frame). */
export function renderFrame(time: ITransportTime, totalFrames: number): number {
  return Math.min(totalFrames, Math.max(1, time.frame));
}

/** State of every layer of a stage at `time` (layers already prepared). */
export function evaluateStageLayers<T>(
  layers: readonly IStageLayer<T>[],
  time: ITransportTime,
  totalFrames: number,
  registry: PropertyRegistry
): IStageLayerState<T>[] {
  const frame = renderFrame(time, totalFrames);
  return layers.map(({ layerId, layer, target, object }) => {
    const state = evaluateLayer(layer, frame, { registry });
    return {
      layerId,
      target,
      object,
      values: state.values,
      spanId: state.spanId,
      active: state.visible,
      editorVisible: true
    };
  });
}
