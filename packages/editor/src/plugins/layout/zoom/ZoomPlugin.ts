// packages/editor/src/plugins/layout/zoom/ZoomPlugin.ts
/**
 * Plugin : layout.zoom
 * Epic : layout
 * Dépend de : layout.shell, layout.ruler, layout.scrollSync
 * Écoute : —
 * Émet : zoom:changed
 *
 * Zoom horizontal de la timeline : largeur d'image variable. Le zoom est un
 * facteur appliqué à la largeur de base (celle de `layout.ruler` au
 * démarrage) ; la règle reste la seule propriétaire de la largeur et la
 * reçoit par `setFrameWidth`. C'est un réglage de vue : il ne touche pas au
 * document et ne passe donc pas par l'historique.
 *
 * Changer le zoom, dans l'ordre :
 * 1. la règle se redessine à la nouvelle largeur ;
 * 2. `zoom:changed` est émis (la grille, la tête de lecture... se replacent) ;
 * 3. la zone des images défile pour garder immobile le point d'ancrage : le
 *    pointeur pour Ctrl + molette, sinon la tête de lecture si elle est
 *    visible, sinon le milieu de la vue.
 *
 * Contrat des écouteurs de `zoom:changed` : redimensionner leur contenu tout
 * de suite (dans l'écouteur, pas à l'image suivante), sinon le navigateur
 * borne le défilement de l'étape 3 et le point d'ancrage glisse ; ne pas
 * faire défiler ni rezoomer (un `setZoom` pendant l'annonce est ignoré).
 *
 * Ctrl (ou Cmd) + molette au-dessus de la règle ou des images zoome d'un
 * palier par cran ; les petits mouvements en pixels (pincement d'un pavé
 * tactile) sont cumulés jusqu'à `WHEEL_STEP_PX`. Le pincement de Safari
 * (`gesture*`) zoome en continu. `layout.scrollSync` laisse ces gestes au zoom.
 *
 * Paliers et bornes : zoom avant / arrière et molette vont de palier en
 * palier et s'arrêtent au premier et au dernier (`levels()`, 25 % à 400 %
 * par défaut) ; `setZoom` et le pincement acceptent toute la plage
 * (`range()`, 10 % à 800 % par défaut), par exemple pour l'ajustement à la
 * fenêtre. Le service `layout.zoom` sert à la commande de zoom de la barre
 * d'outils (T4), qui construit son curseur avec `range()` et sa liste avec
 * `levels()`.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { frameCenter } from '../ruler/frameGeometry';
import type { IRulerApi } from '../ruler/RulerPlugin';
import type { IScrollSyncApi } from '../scrollSync/ScrollSyncPlugin';
import { LAYOUT_SLOTS } from '../shell/layoutSlots';
import {
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  DEFAULT_ZOOM_LEVELS,
  anchoredScrollLeft,
  clampZoom,
  isValidZoom,
  stepZoom
} from './zoomLevels';
import type { IZoomRange } from './zoomLevels';
import './zoomEvents';

/** Mouvement de molette en pixels (Ctrl / Cmd) qui fait un palier : un cran de souris usuel. */
export const WHEEL_STEP_PX = 50;
/** Pause après laquelle le mouvement de molette cumulé est oublié, en millisecondes. */
export const WHEEL_IDLE_MS = 300;
/** Lignes d'un cran de molette usuel (Firefox : 3 lignes). */
export const WHEEL_NOTCH_LINES = 3;
/** Pages d'un cran de molette en mode page. */
export const WHEEL_NOTCH_PAGES = 1;
/** `WheelEvent.DOM_DELTA_PIXEL`. */
const WHEEL_DELTA_PIXEL = 0;
/** `WheelEvent.DOM_DELTA_LINE`. */
const WHEEL_DELTA_LINE = 1;
/** Marge d'arrondi sur un cumul de fractions (8 × 0,375 ligne = 3 lignes). */
const EPSILON_WHEEL = 1e-9;

/** Taille d'un cran en lignes ou en pages, dans l'unité `deltaMode`. */
function wheelNotch(deltaMode: number): number {
  return deltaMode === WHEEL_DELTA_LINE ? WHEEL_NOTCH_LINES : WHEEL_NOTCH_PAGES;
}
/** Événements du pincement de Safari. */
const GESTURE_EVENTS: readonly string[] = ['gesturestart', 'gesturechange', 'gestureend'];

/** Ce que l'on lit d'un `GestureEvent` de Safari (absent des types du DOM). */
interface IGestureLike {
  readonly scale?: number;
  readonly clientX?: number;
}

/**
 * Point gardé immobile pendant un zoom : une position de la fenêtre
 * (`clientX`), la tête de lecture (`'playhead'`, le milieu de la vue si elle
 * est hors de vue) ou le milieu de la vue (`'center'`).
 */
export type ZoomAnchor = { readonly clientX: number } | 'playhead' | 'center';

/** API publiée sous le service `layout.zoom`. */
export interface IZoomApi {
  /** Facteur de zoom courant (1 = largeur de base). */
  readonly zoom: () => number;
  /** Largeur d'une image au zoom courant, en pixels. */
  readonly frameWidth: () => number;
  /** Largeur d'une image au zoom 1, en pixels. */
  readonly baseFrameWidth: () => number;
  /** Bornes du zoom. */
  readonly range: () => IZoomRange;
  /** Paliers du zoom avant / arrière, croissants. */
  readonly levels: () => readonly number[];
  /**
   * Règle le zoom (borné à `range`). Sans effet si la valeur ne change pas.
   *
   * @throws RangeError si `zoom` n'est pas un nombre fini > 0.
   */
  readonly setZoom: (zoom: number, anchor?: ZoomAnchor) => void;
  /** Zoom avant d'un palier. */
  readonly zoomIn: (anchor?: ZoomAnchor) => void;
  /** Zoom arrière d'un palier. */
  readonly zoomOut: (anchor?: ZoomAnchor) => void;
  /** Revient au zoom 1. */
  readonly reset: (anchor?: ZoomAnchor) => void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layout.zoom': IZoomApi;
  }
}

/** Options de `ZoomPlugin`. */
export interface ZoomOptions {
  /** Zoom au démarrage (1 par défaut), appliqué sans émettre `zoom:changed`. */
  readonly initialZoom?: number;
  /** Zoom minimal (`DEFAULT_MIN_ZOOM` par défaut). */
  readonly minZoom?: number;
  /** Zoom maximal (`DEFAULT_MAX_ZOOM` par défaut). */
  readonly maxZoom?: number;
  /** Paliers du zoom avant / arrière (`DEFAULT_ZOOM_LEVELS` par défaut). */
  readonly levels?: readonly number[];
  /**
   * Gestes de zoom au-dessus de la règle et des images (vrai par défaut) :
   * Ctrl / Cmd + molette (pincement d'un pavé tactile compris) et pincement
   * de Safari (`gesture*`). À faux, aucun des deux n'est intercepté : le
   * navigateur garde son propre zoom de la page.
   */
  readonly wheel?: boolean;
}

function assertZoom(value: number, name: string): void {
  if (!isValidZoom(value)) {
    throw new RangeError(`layout.zoom : ${name} invalide (${String(value)}) ; attendu un nombre > 0.`);
  }
}

/**
 * Paliers par défaut `inBounds` (déjà limités aux bornes et triés) complétés
 * par les bornes qui les coupent : `min` si un palier par défaut est sous
 * `min`, `max` si un palier est au-dessus de `max` ; les deux s'il resterait
 * moins de deux paliers.
 */
function withCutBounds(
  inBounds: readonly number[],
  defaults: readonly number[],
  min: number,
  max: number
): readonly number[] {
  const cutLow = defaults.some((level) => level < min);
  const cutHigh = defaults.some((level) => level > max);
  const levels = Array.from(new Set([...(cutLow ? [min] : []), ...inBounds, ...(cutHigh ? [max] : [])]));
  return levels.length < 2 ? Array.from(new Set([min, ...levels, max])) : levels;
}

/**
 * Options vérifiées : bornes cohérentes ; paliers triés et limités aux
 * bornes (`levels()` ne propose jamais une valeur que `setZoom` bornerait).
 * - Sans paliers donnés : une borne n'est ajoutée aux paliers par défaut que
 *   du côté où elle les coupe (`{ maxZoom: 2.5 }` donne [0,25 … 2, 2,5], sans 0,1) ; s'il
 *   reste moins de deux paliers, l'autre borne s'ajoute aussi, pour que la
 *   molette puisse encore bouger (`{ minZoom: 4 }` donne [4, 8]).
 * - Avec des paliers donnés : ceux hors des bornes sont écartés, sans borne
 *   ajoutée ; seule une liste entièrement hors des bornes lève une `RangeError`.
 */
function resolveOptions(options: ZoomOptions): { range: IZoomRange; levels: readonly number[]; initial: number } {
  const min = options.minZoom ?? DEFAULT_MIN_ZOOM;
  const max = options.maxZoom ?? DEFAULT_MAX_ZOOM;
  const initial = options.initialZoom ?? 1;
  assertZoom(min, 'minZoom');
  assertZoom(max, 'maxZoom');
  assertZoom(initial, 'initialZoom');
  if (min > max) throw new RangeError(`layout.zoom : minZoom (${min}) dépasse maxZoom (${max}).`);
  const given = options.levels ?? DEFAULT_ZOOM_LEVELS;
  given.forEach((level) => assertZoom(level, 'palier'));
  const inBounds = given.filter((level) => level >= min && level <= max).sort((a, b) => a - b);
  if (inBounds.length === 0 && options.levels !== undefined) {
    throw new RangeError(`layout.zoom : aucun palier entre minZoom (${min}) et maxZoom (${max}).`);
  }
  const levels = options.levels === undefined ? withCutBounds(inBounds, given, min, max) : inBounds;
  const range = { min, max };
  return { range, levels: Object.freeze(levels), initial: clampZoom(initial, range) };
}

/** Zoom horizontal de la timeline. */
export class ZoomPlugin implements EditorPlugin {
  readonly id = 'layout.zoom';
  readonly dependencies: readonly string[] = ['layout.shell', 'layout.ruler', 'layout.scrollSync'];
  readonly slot = LAYOUT_SLOTS.frames;

  private ctx: IEditorContext | undefined;
  private frames: HTMLElement | undefined;
  private current = 1;
  private base = 1;
  private readonly range: IZoomRange;
  private readonly levels: readonly number[];
  private readonly initial: number;
  private readonly wheel: boolean;
  /** Vrai pendant l'émission de `zoom:changed`. */
  private announcing = false;
  /** Mouvement de molette cumulé (Ctrl / Cmd), dans l'unité `wheelMode`. */
  private wheelTotal = 0;
  /** Unité du mouvement cumulé (`WheelEvent.deltaMode`). */
  private wheelMode = WHEEL_DELTA_PIXEL;
  /** Horodatage du dernier mouvement de molette (Ctrl / Cmd). */
  private lastWheel = Number.NEGATIVE_INFINITY;
  /** Zoom au début d'un pincement Safari. */
  private gestureStart = 1;
  private cleanups: Array<() => void> = [];

  constructor(options: ZoomOptions = {}) {
    const resolved = resolveOptions(options);
    this.range = resolved.range;
    this.levels = resolved.levels;
    this.initial = resolved.initial;
    this.wheel = options.wheel ?? true;
  }

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    const ruler = ctx.services.require('layout.ruler');
    this.base = ruler.frameWidth();
    this.current = this.initial;
    if (this.initial !== 1) ruler.setFrameWidth(this.base * this.initial);
    this.cleanups = [
      ctx.services.provide('layout.zoom', {
        zoom: () => this.current,
        frameWidth: () => this.base * this.current,
        baseFrameWidth: () => this.base,
        range: () => this.range,
        levels: () => this.levels,
        setZoom: (zoom, anchor) => this.setZoom(zoom, anchor),
        zoomIn: (anchor) => this.setZoom(stepZoom(this.current, 1, this.levels, this.range), anchor),
        zoomOut: (anchor) => this.setZoom(stepZoom(this.current, -1, this.levels, this.range), anchor),
        reset: (anchor) => this.setZoom(1, anchor)
      })
    ];
  };

  render(frames: HTMLElement): void {
    const ctx = this.requireContext();
    this.frames = frames;
    if (!this.wheel) return;
    const ruler = ctx.services.get('layout.shell')?.zone('ruler');
    const onWheel = (event: WheelEvent): void => this.onWheel(event);
    const onGesture = (event: Event): void => this.onGesture(event);
    const targets = ruler === undefined ? [frames] : [frames, ruler];
    targets.forEach((target) => {
      target.addEventListener('wheel', onWheel, { passive: false });
      GESTURE_EVENTS.forEach((name) => target.addEventListener(name, onGesture, { passive: false }));
    });
    this.cleanups.push(() =>
      targets.forEach((target) => {
        target.removeEventListener('wheel', onWheel);
        GESTURE_EVENTS.forEach((name) => target.removeEventListener(name, onGesture));
      })
    );
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.frames = undefined;
    this.ctx = undefined;
  }

  private setZoom(zoom: number, anchor: ZoomAnchor = 'playhead'): void {
    assertZoom(zoom, 'zoom');
    const ctx = this.ctx;
    if (ctx === undefined) return;
    const next = clampZoom(zoom, this.range);
    // Un écouteur de `zoom:changed` qui rezoome est ignoré (voir le contrat en tête).
    if (next === this.current || this.announcing) return;
    const ruler = ctx.services.require('layout.ruler');
    const scroll = ctx.services.require('layout.scrollSync');
    const before = scroll.getScroll();
    const offset = this.anchorOffset(anchor, ruler, scroll);
    const previousZoom = this.current;
    const previousFrameWidth = ruler.frameWidth();
    this.current = next;
    ruler.setFrameWidth(this.base * next);
    const frameWidth = ruler.frameWidth();
    this.announcing = true;
    try {
      ctx.events.emit('zoom:changed', { zoom: next, frameWidth, previousZoom, previousFrameWidth });
    } finally {
      this.announcing = false;
    }
    scroll.scrollTo({ left: anchoredScrollLeft(offset, before.scrollLeft, previousFrameWidth, frameWidth) });
  }

  /** Distance du point d'ancrage au bord gauche de la zone des images, en pixels. */
  private anchorOffset(anchor: ZoomAnchor, ruler: IRulerApi, scroll: IScrollSyncApi): number {
    const state = scroll.getScroll();
    const middle = state.viewportWidth / 2;
    if (anchor === 'center') return middle;
    if (anchor === 'playhead') {
      const frame = this.ctx?.playback.frame ?? 1;
      const offset = frameCenter(frame, ruler.frameWidth()) - state.scrollLeft;
      return offset >= 0 && offset <= state.viewportWidth ? offset : middle;
    }
    const left = this.frames?.getBoundingClientRect().left ?? 0;
    return Math.min(state.viewportWidth, Math.max(0, anchor.clientX - left));
  }

  /**
   * Ctrl / Cmd + molette, ancré sous le pointeur.
   * - En lignes ou en pages (cran de souris) : le premier événement d'un cran
   *   fait un palier tout de suite ; la suite du cran est ignorée jusqu'à un
   *   cran entier (`WHEEL_NOTCH_LINES` ou `WHEEL_NOTCH_PAGES`) ou jusqu'à une
   *   pause de `WHEEL_IDLE_MS`. Un cran fait donc un palier, en un événement
   *   (3 lignes dans Firefox) ou en morceaux (1,5 + 1,5 ; 8 × 0,375). Une
   *   roue fine qui donne moins d'un cran entier par cran (8 × 0,125 ligne)
   *   fait un palier par geste séparé d'une pause, et un toutes les 3 lignes
   *   quand on la fait tourner sans pause.
   * - En pixels : un palier par `WHEEL_STEP_PX` cumulés (pincement d'un pavé
   *   tactile), pas avant.
   * Un changement de sens ou d'unité commence toujours un nouveau cran.
   */
  private onWheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return;
    event.preventDefault();
    const idle = event.timeStamp - this.lastWheel > WHEEL_IDLE_MS;
    this.lastWheel = event.timeStamp;
    const direction = event.deltaY < 0 ? 1 : -1;
    const sameRun =
      !idle && event.deltaMode === this.wheelMode && Math.sign(event.deltaY) === Math.sign(this.wheelTotal);
    this.wheelMode = event.deltaMode;
    if (event.deltaMode === WHEEL_DELTA_PIXEL) {
      this.wheelTotal = (sameRun ? this.wheelTotal : 0) + event.deltaY;
      if (Math.abs(this.wheelTotal) < WHEEL_STEP_PX - EPSILON_WHEEL) return;
      this.wheelTotal = 0;
      this.step(direction, event.clientX);
      return;
    }
    // Lignes ou pages : un palier au début de chaque cran, le reste du cran est ignoré.
    const notchDone = Math.abs(this.wheelTotal) >= wheelNotch(event.deltaMode) - EPSILON_WHEEL;
    if (sameRun && !notchDone) {
      this.wheelTotal += event.deltaY;
      return;
    }
    this.wheelTotal = event.deltaY;
    this.step(direction, event.clientX);
  }

  private step(direction: 1 | -1, clientX: number): void {
    this.setZoom(stepZoom(this.current, direction, this.levels, this.range), { clientX });
  }

  /**
   * Pincement de Safari (`gesturestart` / `gesturechange` / `gestureend`, qui
   * ne passe pas par la molette) : zoom continu, borné à `range`, ancré sous
   * le pointeur ; la page n'est pas zoomée.
   */
  private onGesture(event: Event & IGestureLike): void {
    event.preventDefault();
    if (event.type === 'gesturestart') this.gestureStart = this.current;
    if (event.type !== 'gesturechange' || event.scale === undefined || !isValidZoom(event.scale)) return;
    const anchor: ZoomAnchor = event.clientX === undefined ? 'playhead' : { clientX: event.clientX };
    this.setZoom(clampZoom(this.gestureStart * event.scale, this.range), anchor);
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layout.zoom : render appelé avant init.');
    return this.ctx;
  }
}
