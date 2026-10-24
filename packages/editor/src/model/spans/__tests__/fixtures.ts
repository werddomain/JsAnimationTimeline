// packages/editor/src/model/spans/__tests__/fixtures.ts
/**
 * Fixtures des tests des opérations de plage : document figé en profondeur,
 * registre de test (créé ici, jamais le registre par défaut), accès aux
 * plages d'un calque et contrôle du document par `validateDocument`.
 */

import { createPropertyRegistry, findNodeById, isLayer, validateDocument } from '@werddomain/timeline-runtime';
import type { ILayer, ISpan, ITimelineDocument, LayerNode, PropertyRegistry } from '@werddomain/timeline-runtime';

/** Fige récursivement `value` (objets et tableaux) et le retourne. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}

/** Registre de test : propriétés intégrées. */
export function createRegistry(): PropertyRegistry {
  return createPropertyRegistry();
}

/** Document figé avec les nœuds donnés (24 images par défaut). */
export function createDoc(layers: readonly LayerNode[], totalFrames = 24): ITimelineDocument {
  return deepFreeze<ITimelineDocument>({ version: '2.0.0', settings: { fps: 24, totalFrames }, layers });
}

/** Calque `id` avec ses plages. */
export function layer(id: string, spans: readonly ISpan[], extra: Partial<ILayer> = {}): ILayer {
  return { id, type: 'layer', name: id, spans, ...extra };
}

/** Calque `id` du document (lève s'il manque). */
export function layerOf(doc: ITimelineDocument, id: string): ILayer {
  const node = findNodeById(doc.layers, id);
  if (node === undefined || !isLayer(node)) throw new Error(`Calque ${id} absent.`);
  return node;
}

/** Plages du calque `id`. */
export function spansOf(doc: ITimelineDocument, id: string): readonly ISpan[] {
  return layerOf(doc, id).spans;
}

/** Résumé `kind start-end` de chaque plage, pour des assertions lisibles. */
export function shapeOf(doc: ITimelineDocument, id: string): string[] {
  return spansOf(doc, id).map((span) => `${span.kind} ${span.start}-${span.end}`);
}

/** Vérifie que le document respecte les invariants du modèle. */
export function expectValid(doc: ITimelineDocument): void {
  expect(validateDocument(doc)).toEqual([]);
}

/** Interpolation x de 0 (image 1) à 100 (image 11), suivie d'une plage fixe 12-20. */
export function tweenDoc(): ITimelineDocument {
  return createDoc([
    layer('l1', [
      { id: 't1', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] } },
      { id: 's2', start: 12, end: 20, kind: 'static', tracks: { x: [{ frame: 12, value: 100 }] } }
    ])
  ]);
}
