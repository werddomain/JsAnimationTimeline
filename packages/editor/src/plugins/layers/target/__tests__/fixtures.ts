// packages/editor/src/plugins/layers/target/__tests__/fixtures.ts
/**
 * Fixtures des tests de `layers.target` : Store et pile de commandes seuls
 * (tests du modèle), fausse scène avec `list`, `describe` et un `pick`
 * contrôlable (promesse en attente, signal d'abandon enregistré), et montage
 * d'un éditeur complet sur cette scène.
 */

import { createManualClock, isRefTarget, refStage } from '@kazo-ca/timeline-runtime';
import type {
  IManualClock,
  IStage,
  IStageAbortSignal,
  ITargetInfo,
  ITimelineDocument,
  LayerTarget
} from '@kazo-ca/timeline-runtime';
import type { CommandStack } from '../../../../core/commands/CommandStack';
import { createEditor } from '../../../../core/editor/createEditor';
import type { EditorOptions, IEditor } from '../../../../core/editor/types';
import { EventBus } from '../../../../core/events/EventBus';
import { Store } from '../../../../core/store/Store';
import type { ILayerTargetService } from '../TargetPlugin';

/** Pile de commandes sur `doc`, sans éditeur. */
export function createCommandStackHarness(doc: ITimelineDocument): { stack: CommandStack; read: () => ITimelineDocument } {
  const store = new Store(new EventBus(), doc);
  const stack = store.createCommandStack();
  return { stack, read: () => store.document };
}

/** `pick` en attente : le test le résout, et lit le signal reçu. */
export interface IPendingPick {
  readonly signal: IStageAbortSignal | undefined;
  resolve(target: LayerTarget | null): void;
  reject(error: unknown): void;
}

/** Fausse scène `canvas` : objets `hero`, `tree`, `sun` ; `pick` contrôlable si demandé. */
export interface IFakeStage extends IStage<string> {
  readonly objects: Set<string>;
  readonly picks: IPendingPick[];
  notifyTargets(): void;
}

/** Crée la fausse scène (avec `pick` si `withPick`). */
export function createFakeStage(id = 'canvas', withPick = true): IFakeStage {
  const objects = new Set(['hero', 'tree', 'sun']);
  const picks: IPendingPick[] = [];
  const listeners = new Set<() => void>();
  const pick = (signal?: IStageAbortSignal): Promise<LayerTarget | null> =>
    new Promise((resolve, reject) => picks.push({ signal, resolve, reject }));
  return {
    id,
    objects,
    picks,
    targets: {
      list: (): readonly ITargetInfo[] =>
        Array.from(objects).map((ref) => ({ target: { ref, stage: id }, label: ref, group: 'Canvas' })),
      describe: (target) =>
        (isRefTarget(target) && objects.has(target.ref) ? { target, label: `Objet ${target.ref}` } : undefined),
      subscribe: (onChange) => {
        listeners.add(onChange);
        return () => void listeners.delete(onChange);
      },
      ...(withPick ? { pick } : {})
    },
    accepts: refStage(id, { unscoped: true }),
    resolve: (target) => (isRefTarget(target) && objects.has(target.ref) ? target.ref : null),
    render: () => undefined,
    notifyTargets: () => Array.from(listeners).forEach((listener) => listener())
  };
}

/** Document : calque `hero` ciblé sur la fausse scène, calque `bare` sans cible, dossier `f`. */
export function createTargetDocument(): ITimelineDocument {
  return {
    version: '2.0.0',
    settings: { fps: 24, totalFrames: 24 },
    layers: [
      { id: 'hero', type: 'layer', name: 'Héros', target: { ref: 'hero', stage: 'canvas' }, spans: [] },
      { id: 'bare', type: 'layer', name: 'Nu', spans: [] },
      { id: 'f', type: 'folder', name: 'Dossier', children: [] }
    ]
  };
}

/** Éditeur monté avec les plugins par défaut. */
export interface ITargetHarness {
  readonly editor: IEditor;
  readonly host: HTMLElement;
  readonly clock: IManualClock;
  readonly service: ILayerTargetService;
}

const editors: IEditor[] = [];

/** Monte un éditeur (plugins par défaut) sur `data` et `options.stage` (la fausse scène par défaut). */
export function mountTarget(options: EditorOptions = {}, data: ITimelineDocument = createTargetDocument()): ITargetHarness {
  const host = document.createElement('section');
  document.body.appendChild(host);
  const clock = createManualClock();
  const editor = createEditor(host, { data, clock, stage: createFakeStage(), ...options });
  editors.push(editor);
  const service = editor.getService('layers.target');
  if (service === undefined) throw new Error('service layers.target absent');
  return { editor, host, clock, service };
}

/** Détruit les éditeurs montés et vide le corps du document. */
export function unmountTargets(): void {
  editors.splice(0).forEach((editor) => {
    if (!editor.isDestroyed) editor.destroy();
  });
  document.body.innerHTML = '';
}

/** Bouton de cible de la ligne `id`. */
export function targetButton(host: HTMLElement, id: string): HTMLButtonElement {
  const button = host.querySelector(`[data-row-id="${id}"] .jt-layer-target`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`pas de bouton de cible sur ${id}`);
  return button;
}

/** Fenêtre de choix ouverte, ou `null`. */
export function popup(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>('.jt-target-popup');
}

/** Envoie une touche à `element` (bulle, annulable). */
export function press(element: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  element.dispatchEvent(event);
  return event;
}

/** Laisse passer les promesses en attente (résultat de `pick`). */
export async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
