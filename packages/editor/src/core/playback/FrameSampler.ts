// packages/editor/src/core/playback/FrameSampler.ts
/**
 * Échantillonnage d'un document à une position : valeurs de chaque calque
 * par l'évaluation du runtime (R2), avec le registre figé de l'éditeur.
 *
 * - Les pistes inconnues du registre sont sautées (`unknownProperties:
 *   'skip'`) : le Store les a déjà signalées au chargement, et une piste
 *   inconnue ne doit pas arrêter le rendu des autres.
 * - La liste des calques (ordre d'affichage, œil résolu avec les dossiers
 *   parents) est calculée une fois par document et mise en cache : les
 *   documents sont immuables, une nouvelle référence veut dire un nouveau
 *   document.
 * - L'échantillon rendu est figé.
 */

import {
  clampFrame,
  evaluateLayer,
  frameToTime,
  isFolder,
  isLayer,
  resolveVisible,
  toTransportTime,
  walkLayers
} from '@werddomain/timeline-runtime';
import type { ILayer, ITimelineDocument, ITransportTime, PropertyRegistry } from '@werddomain/timeline-runtime';
import type { IFrameSample, ILayerSample } from './types';

/** Calque du document et son œil résolu (dossiers parents compris). */
interface ILayerEntry {
  readonly layer: ILayer;
  readonly editorVisible: boolean;
}

function collectEntries(doc: ITimelineDocument): readonly ILayerEntry[] {
  const folderVisible = new Map<string, boolean>();
  const entries: ILayerEntry[] = [];
  walkLayers(doc.layers, ({ node, parentIds }) => {
    const parentId = parentIds[parentIds.length - 1];
    const parentVisible = parentId === undefined || folderVisible.get(parentId) === true;
    const visible = parentVisible && resolveVisible(node);
    if (isFolder(node)) folderVisible.set(node.id, visible);
    if (isLayer(node)) entries.push({ layer: node, editorVisible: visible });
  });
  return Object.freeze(entries);
}

function createSample(time: ITransportTime, layers: readonly ILayerSample[]): IFrameSample {
  let byId: ReadonlyMap<string, ILayerSample> | undefined;
  return Object.freeze<IFrameSample>({
    time: Object.freeze({ ...time }),
    layers: Object.freeze(layers),
    layer: (layerId) => {
      byId ??= new Map(layers.map((sample) => [sample.layerId, sample]));
      return byId.get(layerId);
    }
  });
}

/** Évalue les documents de l'éditeur avec un registre donné. */
export class FrameSampler {
  private readonly entries = new WeakMap<ITimelineDocument, readonly ILayerEntry[]>();

  constructor(private readonly registry: PropertyRegistry) {}

  /** Position (millisecondes, image fractionnaire, image entière) du début de l'image `frame`, bornée. */
  static timeAt(doc: ITimelineDocument, frame: number): ITransportTime {
    if (!Number.isFinite(frame)) {
      throw new Error(`sample : l'image doit être un nombre fini (reçu : ${frame}).`);
    }
    const at = clampFrame(doc, frame);
    return toTransportTime(frameToTime(at, doc.settings.fps), doc.settings);
  }

  /** Échantillon figé de `doc` à `time` (l'image fractionnaire est bornée à 1..totalFrames). */
  sample(doc: ITimelineDocument, time: ITransportTime): IFrameSample {
    const at = clampFrame(doc, time.frame);
    const options = { registry: this.registry, unknownProperties: 'skip' as const };
    const layers = this.layersOf(doc).map(({ layer, editorVisible }): ILayerSample => {
      const state = evaluateLayer(layer, at, options);
      return Object.freeze({
        layerId: layer.id,
        target: layer.target,
        values: Object.freeze({ ...state.values }),
        spanId: state.spanId,
        active: state.visible,
        editorVisible
      });
    });
    return createSample(time, layers);
  }

  private layersOf(doc: ITimelineDocument): readonly ILayerEntry[] {
    let entries = this.entries.get(doc);
    if (entries === undefined) {
      entries = collectEntries(doc);
      this.entries.set(doc, entries);
    }
    return entries;
  }
}
