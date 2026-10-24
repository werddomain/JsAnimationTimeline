// packages/editor/src/model/spans/layerAccess.ts
/**
 * Accès aux calques pour les opérations de plage : lecture d'un calque
 * modifiable (refus s'il est verrouillé, lui ou un dossier parent),
 * remplacement immuable d'un calque dans l'arbre, contrôle des numéros
 * d'image, ids de nouvelles plages et valeurs évaluées à une image.
 */

import {
  evaluateLayer,
  findNodeById,
  flattenLayers,
  isFolder,
  isLayer,
  resolveLocked,
  walkLayers
} from '@werddomain/timeline-runtime';
import type {
  ILayer,
  ITimelineDocument,
  LayerNode,
  PropertyRegistry,
  PropertyValues
} from '@werddomain/timeline-runtime';
import { SpanOperationCodes, SpanOperationError } from './SpanOperationError';

/** Calque `layerId` ; refuse un id inconnu, un dossier ou un calque verrouillé. */
export function requireEditableLayer(doc: ITimelineDocument, layerId: string): ILayer {
  const visit = flattenLayers(doc.layers).find(({ node }) => node.id === layerId);
  if (visit === undefined || !isLayer(visit.node)) {
    throw new SpanOperationError(SpanOperationCodes.LAYER_NOT_FOUND, `Le calque « ${layerId} » est introuvable.`);
  }
  const layer = visit.node;
  const lockedFolder = visit.parentIds
    .map((id) => findNodeById(doc.layers, id))
    .find((folder) => folder !== undefined && resolveLocked(folder));
  if (resolveLocked(layer) || lockedFolder !== undefined) {
    throw new SpanOperationError(SpanOperationCodes.LAYER_LOCKED, `Le calque « ${layer.name} » est verrouillé.`);
  }
  return layer;
}

/** Calque `layerId`, verrouillé ou non ; `undefined` s'il est absent. */
export function findLayer(doc: ITimelineDocument, layerId: string): ILayer | undefined {
  const node = findNodeById(doc.layers, layerId);
  return node !== undefined && isLayer(node) ? node : undefined;
}

function replaceNode(node: LayerNode, layer: ILayer): LayerNode {
  if (node.id === layer.id) return layer;
  if (!isFolder(node)) return node;
  const children = replaceInNodes(node.children, layer);
  return children === node.children ? node : { ...node, children };
}

/** Même tableau (même référence) quand aucun nœud ne change. */
function replaceInNodes(nodes: readonly LayerNode[], layer: ILayer): readonly LayerNode[] {
  const next = nodes.map((node) => replaceNode(node, layer));
  return next.every((node, index) => node === nodes[index]) ? nodes : next;
}

/** Nouveau document où le calque de même id est remplacé par `layer`. */
export function replaceLayer(doc: ITimelineDocument, layer: ILayer): ITimelineDocument {
  const layers = replaceInNodes(doc.layers, layer);
  return layers === doc.layers ? doc : { ...doc, layers };
}

/** Refuse une image qui n'est pas un entier de 1 à `totalFrames`. */
export function assertFrame(doc: ITimelineDocument, frame: number): void {
  const { totalFrames } = doc.settings;
  if (!Number.isInteger(frame) || frame < 1 || frame > totalFrames) {
    throw new SpanOperationError(
      SpanOperationCodes.INVALID_FRAME,
      `L'image ${String(frame)} n'existe pas (images de 1 à ${totalFrames}).`
    );
  }
}

/**
 * Fabrique d'ids de plages uniques dans le document (`<calque>-k<n>`). Elle
 * est déterministe : rétablir une commande redonne les mêmes ids.
 */
export function createSpanIdFactory(doc: ITimelineDocument, layerId: string): () => string {
  const used = new Set<string>();
  walkLayers(doc.layers, ({ node }) => {
    used.add(node.id);
    if (isLayer(node)) node.spans.forEach((span) => used.add(span.id));
  });
  let counter = 0;
  return () => {
    let id: string;
    do {
      counter += 1;
      id = `${layerId}-k${counter}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };
}

/**
 * Valeurs de toutes les propriétés du calque à `frame`, par l'évaluation du
 * runtime (accélération comprise) ; un échec devient un refus.
 */
export function evaluateValues(layer: ILayer, frame: number, registry: PropertyRegistry): PropertyValues {
  try {
    return evaluateLayer(layer, frame, { registry }).values;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SpanOperationError(
      SpanOperationCodes.EVALUATION_FAILED,
      `Impossible de calculer les valeurs du calque « ${layer.name} » à l'image ${frame} : ${detail}`
    );
  }
}
