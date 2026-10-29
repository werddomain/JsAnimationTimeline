// packages/editor/src/plugins/layout/__tests__/layoutFixtures.ts
/**
 * Fixtures des tests de l'epic `layout` : conteneur hôte, ordonnanceur
 * d'images manuel, éléments qui défilent (jsdom ne calcule aucune mise en
 * page) et montage d'un éditeur avec l'epic seul.
 */

import { SCHEMA_VERSION, createManualClock } from '@kazo-ca/timeline-runtime';
import type { IManualClock, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createEditor } from '../../../core/editor/createEditor';
import type { IEditor } from '../../../core/editor/types';
import type { EditorPlugin } from '../../../core/context/IEditorContext';
import { LayoutPlugin } from '../LayoutPlugin';
import type { IFrameScheduler } from '../scrollSync/ScrollSyncPlugin';
import type { LayoutZone } from '../shell/layoutSlots';
import type { ZoomOptions } from '../zoom/ZoomPlugin';

/** Crée un conteneur hôte ajouté à `document.body`. */
export function createContainer(): HTMLElement {
  const container = document.createElement('section');
  document.body.appendChild(container);
  return container;
}

/** Éditeurs montés par `mountLayout`, détruits par `cleanBody`. */
const mountedEditors: IEditor[] = [];

/** Détruit les éditeurs montés (ceux d'un test qui s'arrête en plein glisser laissent sinon leurs écouteurs). */
export function destroyMountedEditors(): void {
  mountedEditors.splice(0).forEach((editor) => {
    if (!editor.isDestroyed) editor.destroy();
  });
}

/** Détruit les éditeurs montés puis retire tous les conteneurs hôtes (à appeler dans `afterEach`). */
export function cleanBody(): void {
  destroyMountedEditors();
  document.body.innerHTML = '';
}

/** Ordonnanceur manuel : les rappels attendent `flush()`. */
export interface IManualScheduler extends IFrameScheduler {
  /** Nombre de rappels en attente. */
  readonly pendingCount: () => number;
  /** Exécute les rappels en attente (une image d'affichage). */
  readonly flush: () => void;
}

export function createManualScheduler(): IManualScheduler {
  let next = 1;
  const callbacks = new Map<number, () => void>();
  return {
    request: (callback) => {
      const handle = next;
      next += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel: (handle) => void callbacks.delete(handle),
    pendingCount: () => callbacks.size,
    flush: () => {
      const queued = Array.from(callbacks.values());
      callbacks.clear();
      queued.forEach((callback) => callback());
    }
  };
}

/** Dimensions simulées d'un élément qui défile. */
export interface IBoxSize {
  readonly scrollWidth: number;
  readonly scrollHeight: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
  readonly offsetWidth?: number;
  readonly offsetHeight?: number;
}

function defineValue(element: HTMLElement, name: string, value: number): void {
  Object.defineProperty(element, name, { configurable: true, get: () => value });
}

/**
 * Donne à `element` des dimensions et un défilement borné, comme un
 * navigateur (jsdom laisse tout à 0).
 */
export function makeScrollable(element: HTMLElement, size: IBoxSize): void {
  let left = 0;
  let top = 0;
  const maxLeft = Math.max(0, size.scrollWidth - size.clientWidth);
  const maxTop = Math.max(0, size.scrollHeight - size.clientHeight);
  const clamp = (value: number, max: number): number => Math.min(max, Math.max(0, value));
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (value: number) => (left = clamp(value, maxLeft))
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => (top = clamp(value, maxTop))
  });
  defineValue(element, 'scrollWidth', size.scrollWidth);
  defineValue(element, 'scrollHeight', size.scrollHeight);
  defineValue(element, 'clientWidth', size.clientWidth);
  defineValue(element, 'clientHeight', size.clientHeight);
  defineValue(element, 'offsetWidth', size.offsetWidth ?? size.clientWidth);
  defineValue(element, 'offsetHeight', size.offsetHeight ?? size.clientHeight);
}

/** Éditeur monté avec l'epic `layout` seul. */
export interface IMountedLayout {
  readonly editor: IEditor;
  readonly container: HTMLElement;
  readonly scheduler: IManualScheduler;
  /** Horloge manuelle de la lecture de l'éditeur. */
  readonly clock: IManualClock;
  /** Élément de la zone `zone` (lève si elle est absente). */
  readonly zone: (zone: LayoutZone) => HTMLElement;
}

/** Options de `mountLayout`. */
export interface IMountOptions {
  readonly data?: ITimelineDocument;
  readonly frameWidth?: number;
  readonly zoom?: ZoomOptions;
}

/** Monte un éditeur avec l'epic `layout` (ordonnanceur et horloge manuels) puis `plugins`. */
export function mountLayout(plugins: readonly EditorPlugin[] = [], options: IMountOptions = {}): IMountedLayout {
  const container = createContainer();
  const scheduler = createManualScheduler();
  const clock = createManualClock();
  const editor = createEditor(container, {
    data: options.data,
    clock,
    defaultPlugins: [new LayoutPlugin({ scrollSync: { scheduler }, ruler: { frameWidth: options.frameWidth }, zoom: options.zoom })],
    plugins
  });
  mountedEditors.push(editor);
  const zone = (name: LayoutZone): HTMLElement => {
    const element = editor.container.querySelector<HTMLElement>(`[data-zone="${name}"]`);
    if (element === null) throw new Error(`Zone « ${name} » introuvable.`);
    return element;
  };
  return { editor, container, scheduler, clock, zone };
}

/** Document vide de `totalFrames` images à `fps` images par seconde. */
export function timelineDocument(totalFrames: number, fps = 24): ITimelineDocument {
  return { version: SCHEMA_VERSION, settings: { fps, totalFrames }, layers: [] };
}

/** Fait croire à jsdom que `element` commence à `left` pixels dans la fenêtre. */
export function placeAt(element: HTMLElement, left: number): void {
  element.getBoundingClientRect = () => ({
    x: left,
    y: 0,
    left,
    top: 0,
    right: left,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({})
  });
}
