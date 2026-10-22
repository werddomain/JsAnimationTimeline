// packages/runtime/src/evaluate/evaluateDocument.ts
/**
 * Évaluation de tous les calques d'un document à l'image N.
 */

import type { ITimelineDocument } from '../model/document';
import { isLayer } from '../model/guards';
import type { ILayer } from '../model/layer';
import { walkLayers } from '../model/traverse';
import { evaluateLayer } from './evaluateLayer';
import type { IEvaluateOptions, ILayerFrameState } from './evaluateLayer';

/** Every layer of the document (folders skipped), in display order. */
export function collectLayers(doc: ITimelineDocument): ILayer[] {
  const layers: ILayer[] = [];
  walkLayers(doc.layers, ({ node }) => {
    if (isLayer(node)) {
      layers.push(node);
    }
  });
  return layers;
}

/** `frame` clamped to the document's frames [1, totalFrames]. */
export function clampFrame(doc: ITimelineDocument, frame: number): number {
  return Math.min(doc.settings.totalFrames, Math.max(1, frame));
}

/**
 * State of every layer at `frame`, clamped to [1, totalFrames]. Folders are
 * skipped; layers come in display order.
 */
export function evaluateDocument(
  doc: ITimelineDocument,
  frame: number,
  options: IEvaluateOptions = {}
): ILayerFrameState[] {
  if (!Number.isFinite(frame)) {
    throw new Error(`Frame must be a finite number (got ${frame}).`);
  }
  const at = clampFrame(doc, frame);
  return collectLayers(doc).map((layer) => evaluateLayer(layer, at, options));
}
