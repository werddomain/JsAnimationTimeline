// packages/editor/src/plugins/layout/scrollSync/ScrollSyncPlugin.ts
/**
 * Plugin : layout.scrollSync
 * Epic : layout
 * Dépend de : layout.shell
 * Écoute : document:loaded, document:changed
 * Émet : layout:scrolled
 *
 * Synchronise le défilement de la coquille, repris de
 * `legacy/JsTimeLine.ts` (`setupScrollSync`) : la zone des images est la
 * seule à défiler ; sa position horizontale est recopiée dans la règle et sa
 * position verticale dans les calques, une fois par image d'affichage.
 *
 * Différences avec le legacy :
 * - la règle et les calques défilent par `scrollLeft` / `scrollTop` (et non
 *   par `transform`) : les plugins qui y dessinent gardent des coordonnées
 *   simples ;
 * - la molette au-dessus de la règle ou des calques fait défiler la zone des
 *   images ;
 * - l'épaisseur des barres de défilement de la zone des images est publiée
 *   dans `--jt-scrollbar-x` / `--jt-scrollbar-y` sur la coquille, pour que la
 *   règle et les calques restent alignés jusqu'au bout ;
 * - `layout:scrolled` est émis une fois par image d'affichage quand la
 *   position ou la taille visible change (le legacy l'émettait avec un
 *   délai), pour que la grille puisse ne dessiner que la partie visible.
 *
 * Service `layout.scrollSync` : lire l'état, faire défiler, demander une
 * nouvelle mesure après un changement de contenu.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { ILayoutShellApi } from '../shell/LayoutShellPlugin';
import { LAYOUT_SLOTS } from '../shell/layoutSlots';
import {
  layersDelta,
  readScrollState,
  rulerDelta,
  scrollStateChanged,
  scrollbarSizes,
  wheelToPixels
} from './scrollGeometry';
import type { IScrollDelta, IScrollState } from './scrollGeometry';

/** Position demandée à `scrollTo` (un axe omis ne bouge pas). */
export interface IScrollPosition {
  readonly left?: number;
  readonly top?: number;
}

/** API publiée sous le service `layout.scrollSync`. */
export interface IScrollSyncApi {
  /** État courant de la zone des images (position et taille visible). */
  readonly getScroll: () => IScrollState;
  /** Fait défiler la zone des images, puis synchronise la règle et les calques tout de suite. */
  readonly scrollTo: (position: IScrollPosition) => void;
  /**
   * Demande une nouvelle mesure à la prochaine image d'affichage (après un
   * changement de taille du contenu, par exemple un zoom).
   */
  readonly refresh: () => void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layout.scrollSync': IScrollSyncApi;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'layout:scrolled': IScrollState;
  }
}

/** Ordonnanceur d'images d'affichage (par défaut `requestAnimationFrame` de la fenêtre). */
export interface IFrameScheduler {
  readonly request: (callback: () => void) => number;
  readonly cancel: (handle: number) => void;
}

/** Options de `ScrollSyncPlugin`. */
export interface ScrollSyncOptions {
  /** Ordonnanceur à utiliser (tests, environnements sans `requestAnimationFrame`). */
  readonly scheduler?: IFrameScheduler;
}

/** Éléments synchronisés, résolus au rendu. */
interface ISyncedElements {
  readonly shell: HTMLElement;
  readonly frames: HTMLElement;
  readonly ruler: HTMLElement;
  readonly layers: HTMLElement;
}

/** Ordonnanceur de la fenêtre de `element` ; à défaut, un appel immédiat différé. */
function windowScheduler(element: HTMLElement): IFrameScheduler {
  const view = element.ownerDocument.defaultView;
  if (view !== null && typeof view.requestAnimationFrame === 'function') {
    return {
      request: (callback) => view.requestAnimationFrame(() => callback()),
      cancel: (handle) => view.cancelAnimationFrame(handle)
    };
  }
  return {
    request: (callback) => Number(setTimeout(callback, 0)),
    cancel: (handle) => clearTimeout(handle)
  };
}

function requireZone(shell: ILayoutShellApi, zone: 'ruler' | 'layers'): HTMLElement {
  const element = shell.zone(zone);
  if (element === undefined) {
    throw new Error(`layout.scrollSync : la zone « ${zone} » de layout.shell est introuvable.`);
  }
  return element;
}

/** Synchronise le défilement de la règle et des calques sur la zone des images. */
export class ScrollSyncPlugin implements EditorPlugin {
  readonly id = 'layout.scrollSync';
  readonly dependencies = ['layout.shell'];
  readonly slot = LAYOUT_SLOTS.frames;

  private ctx: IEditorContext | undefined;
  private elements: ISyncedElements | undefined;
  private scheduler: IFrameScheduler | undefined;
  private pending: number | undefined;
  private last: IScrollState | undefined;
  private cleanups: Array<() => void> = [];

  constructor(private readonly options: ScrollSyncOptions = {}) {}

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.cleanups = [
      ctx.services.provide('layout.scrollSync', {
        getScroll: () => this.getScroll(),
        scrollTo: (position) => this.scrollTo(position),
        refresh: () => this.schedule()
      }),
      ctx.events.on('document:loaded', () => this.schedule()),
      ctx.events.on('document:changed', () => this.schedule())
    ];
  };

  render(frames: HTMLElement): void {
    const ctx = this.requireContext();
    const shellApi = ctx.services.require('layout.shell');
    const shell = shellApi.element();
    if (shell === undefined) throw new Error('layout.scrollSync : la coquille layout.shell n\'est pas rendue.');
    const elements: ISyncedElements = {
      shell,
      frames,
      ruler: requireZone(shellApi, 'ruler'),
      layers: requireZone(shellApi, 'layers')
    };
    this.elements = elements;
    this.scheduler = this.options.scheduler ?? windowScheduler(frames);
    this.listen(elements);
    this.sync(false);
  }

  destroy(): void {
    if (this.pending !== undefined) this.scheduler?.cancel(this.pending);
    this.pending = undefined;
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.elements?.shell.style.removeProperty('--jt-scrollbar-x');
    this.elements?.shell.style.removeProperty('--jt-scrollbar-y');
    this.elements = undefined;
    this.last = undefined;
    this.ctx = undefined;
  }

  /** Abonnements DOM : défilement des images, molette sur la règle et les calques, redimensionnement. */
  private listen(elements: ISyncedElements): void {
    const onScroll = (): void => this.schedule();
    const onRulerWheel = (event: WheelEvent): void => this.forwardWheel(event, rulerDelta(this.pixels(event)));
    const onLayersWheel = (event: WheelEvent): void =>
      this.forwardWheel(event, layersDelta(this.pixels(event), event.shiftKey));
    elements.frames.addEventListener('scroll', onScroll, { passive: true });
    elements.ruler.addEventListener('wheel', onRulerWheel, { passive: false });
    elements.layers.addEventListener('wheel', onLayersWheel, { passive: false });
    this.cleanups.push(() => {
      elements.frames.removeEventListener('scroll', onScroll);
      elements.ruler.removeEventListener('wheel', onRulerWheel);
      elements.layers.removeEventListener('wheel', onLayersWheel);
    });
    const view = elements.frames.ownerDocument.defaultView;
    if (view !== null && typeof view.ResizeObserver === 'function') {
      const observer = new view.ResizeObserver(() => this.schedule());
      observer.observe(elements.frames);
      this.cleanups.push(() => observer.disconnect());
    }
  }

  private pixels(event: WheelEvent): IScrollDelta {
    const frames = this.elements?.frames;
    return wheelToPixels(event, { dx: frames?.clientWidth ?? 0, dy: frames?.clientHeight ?? 0 });
  }

  /** Applique la molette à la zone des images ; bloque le défilement de la page si elle a bougé. */
  private forwardWheel(event: WheelEvent, delta: IScrollDelta): void {
    const frames = this.elements?.frames;
    if (frames === undefined || (delta.dx === 0 && delta.dy === 0)) return;
    const before = readScrollState(frames);
    frames.scrollLeft = before.scrollLeft + delta.dx;
    frames.scrollTop = before.scrollTop + delta.dy;
    const after = readScrollState(frames);
    if (after.scrollLeft === before.scrollLeft && after.scrollTop === before.scrollTop) return;
    event.preventDefault();
    this.sync(true);
  }

  private getScroll(): IScrollState {
    const frames = this.elements?.frames;
    return frames === undefined
      ? { scrollLeft: 0, scrollTop: 0, viewportWidth: 0, viewportHeight: 0 }
      : readScrollState(frames);
  }

  private scrollTo(position: IScrollPosition): void {
    const frames = this.elements?.frames;
    if (frames === undefined) return;
    if (position.left !== undefined) frames.scrollLeft = position.left;
    if (position.top !== undefined) frames.scrollTop = position.top;
    this.sync(true);
  }

  /** Programme une synchronisation à la prochaine image d'affichage (une seule à la fois). */
  private schedule(): void {
    if (this.pending !== undefined || this.scheduler === undefined || this.elements === undefined) return;
    this.pending = this.scheduler.request(() => {
      this.pending = undefined;
      this.sync(true);
    });
  }

  /**
   * Recopie la position des images dans la règle et les calques, publie
   * l'épaisseur des barres de défilement et, si `announce`, émet
   * `layout:scrolled` quand l'état a changé.
   */
  private sync(announce: boolean): void {
    const elements = this.elements;
    if (elements === undefined) return;
    const state = readScrollState(elements.frames);
    elements.ruler.scrollLeft = state.scrollLeft;
    elements.layers.scrollTop = state.scrollTop;
    const bars = scrollbarSizes(elements.frames);
    elements.shell.style.setProperty('--jt-scrollbar-x', `${bars.x}px`);
    elements.shell.style.setProperty('--jt-scrollbar-y', `${bars.y}px`);
    const changed = scrollStateChanged(this.last, state);
    this.last = state;
    if (announce && changed) this.ctx?.events.emit('layout:scrolled', state);
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layout.scrollSync : render appelé avant init.');
    return this.ctx;
  }
}
