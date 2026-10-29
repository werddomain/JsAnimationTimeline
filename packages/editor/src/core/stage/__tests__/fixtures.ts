// packages/editor/src/core/stage/__tests__/fixtures.ts
/**
 * Fixtures des tests des scènes de l'éditeur : fausse scène qui consigne
 * chaque appel (`attach`, `resolve`, `update`, `sync`, `render`, `release`,
 * `detach`), document à deux calques `{ ref }`, commandes pures (changer la
 * cible d'un calque, supprimer un calque) et éditeur sur horloge manuelle.
 */

import { createManualClock, isRefTarget, refStage } from '@kazo-ca/timeline-runtime';
import type {
  IManualClock,
  IStage,
  IStageLayerState,
  ITargetInfo,
  ITimelineDocument,
  LayerTarget,
  PropertyDescriptor
} from '@kazo-ca/timeline-runtime';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import { createCommand } from '../../commands/createCommand';
import type { ICommand } from '../../commands/ICommand';
import { createEditor } from '../../editor/createEditor';
import type { EditorOptions, IEditor } from '../../editor/types';
import { createContainer } from '../../editor/__tests__/fixtures';

/** Objet animé par la fausse scène. */
export interface IFakeObject {
  readonly name: string;
}

/** Fausse scène : `log` consigne les appels, `objects` sert `resolve` (par ref). */
export interface IFakeStage extends IStage<IFakeObject> {
  readonly log: string[];
  readonly objects: Map<string, IFakeObject>;
  /** Derniers états reçus par `render`. */
  lastStates: readonly IStageLayerState<IFakeObject>[];
  /** Appelle les abonnés de `targets.subscribe`. */
  notifyTargets(): void;
}

/** Options de la fausse scène. */
export interface IFakeStageOptions {
  readonly id?: string;
  readonly properties?: readonly PropertyDescriptor[];
  /** Prend aussi les `{ ref }` sans `stage`. */
  readonly unscoped?: boolean;
  /** Refs à ne pas résoudre au départ (absentes de `objects`). */
  readonly missing?: readonly string[];
  /** `update` lève ce que retourne cette fonction pour un document (rien si `undefined`). */
  readonly updateError?: (doc: ITimelineDocument) => unknown;
}

function refOf(target: LayerTarget): string {
  return isRefTarget(target) ? target.ref : '?';
}

/** Crée une fausse scène qui anime les refs `hero`, `tree` et `sun` (sauf `missing`). */
export function createFakeStage(options: IFakeStageOptions = {}): IFakeStage {
  const id = options.id ?? 'fake';
  const log: string[] = [];
  const objects = new Map<string, IFakeObject>();
  ['hero', 'tree', 'sun'].filter((ref) => !(options.missing ?? []).includes(ref))
    .forEach((ref) => objects.set(ref, { name: ref }));
  const listeners = new Set<() => void>();
  const stage: IFakeStage = {
    id,
    log,
    objects,
    lastStates: [],
    properties: options.properties,
    targets: {
      list: (): readonly ITargetInfo[] =>
        Array.from(objects.keys()).map((ref) => ({ target: { ref, stage: id }, label: ref.toUpperCase() })),
      describe: (target) =>
        (isRefTarget(target) && objects.has(target.ref) ? { target, label: target.ref.toUpperCase() } : undefined),
      subscribe: (onChange) => {
        listeners.add(onChange);
        return () => void listeners.delete(onChange);
      }
    },
    accepts: refStage(id, { unscoped: options.unscoped }),
    resolve(target) {
      log.push(`resolve:${refOf(target)}`);
      return objects.get(refOf(target)) ?? null;
    },
    attach: () => void log.push('attach'),
    update(doc, layers) {
      log.push(`update:${layers.map((layer) => layer.layerId).join(',')}`);
      const error = options.updateError?.(doc);
      if (error !== undefined) throw error;
    },
    sync: (time, state) => void log.push(`sync:${time.integerFrame}:${state.playing ? 'play' : 'pause'}`),
    render(time, states) {
      stage.lastStates = states;
      log.push(`render:${time.integerFrame}`);
    },
    release: (layerId, object) => void log.push(`release:${layerId}:${object.name}`),
    detach: () => void log.push('detach'),
    notifyTargets: () => Array.from(listeners).forEach((listener) => listener())
  };
  return stage;
}

/** Document à deux calques animés par la fausse scène (`hero` : x de 0 à 90 sur 10 images ; `tree` statique). */
export function createStageDocument(stageId = 'fake'): ITimelineDocument {
  return deepFreeze<ITimelineDocument>({
    version: '2.0.0',
    settings: { fps: 10, totalFrames: 10 },
    layers: [
      {
        id: 'l-hero', type: 'layer', name: 'Héros', target: { ref: 'hero', stage: stageId },
        spans: [{
          id: 's-hero', start: 1, end: 10, kind: 'tween', easing: 'linear',
          tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] }
        }]
      },
      {
        id: 'l-tree', type: 'layer', name: 'Arbre', target: { ref: 'tree', stage: stageId },
        spans: [{ id: 's-tree', start: 1, end: 10, kind: 'static', tracks: { y: [{ frame: 1, value: 5 }] } }]
      }
    ]
  });
}

function withTarget(doc: ITimelineDocument, layerId: string, target: LayerTarget): ITimelineDocument {
  return {
    ...doc,
    layers: doc.layers.map((node) => (node.id === layerId && node.type === 'layer' ? { ...node, target } : node))
  };
}

/** Commande pure : change la cible d'un calque de premier niveau (undo remet `previous`). */
export function setTarget(layerId: string, target: LayerTarget, previous: LayerTarget): ICommand {
  return createCommand(
    `Cible de ${layerId}`,
    (doc) => withTarget(doc, layerId, target),
    (doc) => withTarget(doc, layerId, previous)
  );
}

/** Commande pure : supprime un calque de premier niveau (undo le remet à son index). */
export function deleteLayer(layerId: string, original: ITimelineDocument): ICommand {
  const index = original.layers.findIndex((node) => node.id === layerId);
  const node = original.layers[index];
  return createCommand(
    `Supprimer ${layerId}`,
    (doc) => ({ ...doc, layers: doc.layers.filter((candidate) => candidate.id !== layerId) }),
    (doc) => ({ ...doc, layers: [...doc.layers.slice(0, index), node, ...doc.layers.slice(index)] })
  );
}

/** Durée d'une image d'affichage simulée (millisecondes). */
export const DISPLAY_FRAME_MS = 16;

/** Éditeur sans plugin sur horloge manuelle, avec la fausse scène. */
export interface IStageHarness {
  readonly editor: IEditor;
  readonly clock: IManualClock;
  readonly stage: IFakeStage;
}

/** Crée un éditeur sur la fausse scène, sans plugin, sur horloge manuelle. */
export function createStageEditor(options: EditorOptions = {}, stage: IFakeStage = createFakeStage()): IStageHarness {
  const clock = createManualClock();
  const editor = createEditor(createContainer(), {
    data: createStageDocument(stage.id),
    defaultPlugins: false,
    clock,
    stage,
    ...options
  });
  return { editor, clock, stage };
}
