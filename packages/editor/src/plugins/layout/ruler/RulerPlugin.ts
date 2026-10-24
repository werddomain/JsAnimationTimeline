// packages/editor/src/plugins/layout/ruler/RulerPlugin.ts
/**
 * Plugin : layout.ruler
 * Epic : layout
 * Dépend de : layout.shell, layout.scrollSync
 * Écoute : document:loaded, document:changed
 * Émet : —
 *
 * Règle des images, reprise de `legacy/ui/TimeRuler.ts` (rendu) : une
 * graduation par image, une plus haute sur les images 5, 10, 15..., une
 * étiquette sur l'image 1 puis à chaque pas (`labelStep`, plus espacé quand
 * les images sont étroites). Les graduations sont un fond CSS répété et
 * seules les étiquettes sont des éléments : la règle reste légère sur une
 * longue timeline.
 *
 * Elle dessine dans la zone `ruler` de la coquille, que `layout.scrollSync`
 * fait défiler avec la zone des images.
 *
 * La règle est la seule propriétaire de la largeur d'une image : elle la
 * publie dans `--jt-frame-width` sur la coquille (pour la grille et les
 * graduations) et dans le service `layout.ruler` (largeur, position d'une
 * image, image sous un point). `setFrameWidth` est réservé à `layout.zoom`,
 * qui annonce ensuite `zoom:changed` : les autres plugins passent par le zoom.
 *
 * Le déplacement de la tête de lecture est l'affaire de `layout.playhead`.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { DEFAULT_FRAME_WIDTH } from '../../../model/rows/rowMetrics';
import { LAYOUT_SLOTS } from '../shell/layoutSlots';
import { frameAtX, frameLeft, isValidFrameWidth, labelStep, labelledFrames, timelineWidth } from './frameGeometry';
import './Ruler.less';

/** API publiée sous le service `layout.ruler`. */
export interface IRulerApi {
  /** Largeur d'une image, en pixels. */
  readonly frameWidth: () => number;
  /** Bord gauche de l'image `frame`, en pixels depuis le début de la timeline. */
  readonly frameLeft: (frame: number) => number;
  /**
   * Image sous la position horizontale `clientX` (coordonnées de la fenêtre,
   * défilement de la zone des images compris), bornée à 1..`totalFrames`.
   */
  readonly frameAtClientX: (clientX: number) => number;
  /**
   * Change la largeur d'une image et redessine la règle. Réservé à
   * `layout.zoom`, qui émet ensuite `zoom:changed`.
   *
   * @throws RangeError si `width` n'est pas un nombre fini > 0.
   */
  readonly setFrameWidth: (width: number) => void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layout.ruler': IRulerApi;
  }
}

/** Options de `RulerPlugin`. */
export interface RulerOptions {
  /** Largeur initiale d'une image, en pixels (`DEFAULT_FRAME_WIDTH` par défaut). */
  readonly frameWidth?: number;
}

/** Classe de l'élément de la règle. */
export const RULER_CLASS = 'jt-ruler';
/** Classe d'une étiquette de la règle. */
export const RULER_LABEL_CLASS = 'jt-ruler__label';
/** Variable CSS de la largeur d'une image, posée sur la coquille. */
export const FRAME_WIDTH_VAR = '--jt-frame-width';

/** Ce qui a servi au dernier rendu (pour ne redessiner que si nécessaire). */
interface IRulerDrawn {
  readonly totalFrames: number;
  readonly frameWidth: number;
}

function assertFrameWidth(width: number): void {
  if (!isValidFrameWidth(width)) {
    throw new RangeError(`layout.ruler : largeur d'image invalide (${String(width)}) ; attendu un nombre > 0.`);
  }
}

/** Règle des images de la timeline. */
export class RulerPlugin implements EditorPlugin {
  readonly id = 'layout.ruler';
  readonly dependencies: readonly string[] = ['layout.shell', 'layout.scrollSync'];
  readonly slot = LAYOUT_SLOTS.ruler;

  private ctx: IEditorContext | undefined;
  private zone: HTMLElement | undefined;
  private element: HTMLElement | undefined;
  private drawn: IRulerDrawn | undefined;
  private width: number;
  private cleanups: Array<() => void> = [];

  constructor(options: RulerOptions = {}) {
    const width = options.frameWidth ?? DEFAULT_FRAME_WIDTH;
    assertFrameWidth(width);
    this.width = width;
  }

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.cleanups = [
      ctx.services.provide('layout.ruler', {
        frameWidth: () => this.width,
        frameLeft: (frame) => frameLeft(frame, this.width),
        frameAtClientX: (clientX) => this.frameAtClientX(clientX),
        setFrameWidth: (width) => this.setFrameWidth(width)
      }),
      ctx.events.on('document:loaded', () => this.draw()),
      ctx.events.on('document:changed', () => this.draw())
    ];
  };

  render(zone: HTMLElement): void {
    this.requireContext();
    const element = zone.ownerDocument.createElement('div');
    element.classList.add(RULER_CLASS);
    element.setAttribute('aria-hidden', 'true');
    zone.appendChild(element);
    this.zone = zone;
    this.element = element;
    this.publishWidth();
    this.draw();
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.ctx?.services.get('layout.shell')?.element()?.style.removeProperty(FRAME_WIDTH_VAR);
    this.element?.remove();
    this.element = undefined;
    this.zone = undefined;
    this.drawn = undefined;
    this.ctx = undefined;
  }

  private setFrameWidth(width: number): void {
    assertFrameWidth(width);
    if (width === this.width) return;
    this.width = width;
    this.publishWidth();
    this.draw();
    this.ctx?.services.get('layout.scrollSync')?.refresh();
  }

  /** Publie la largeur d'une image sur la coquille (seul endroit où elle est posée). */
  private publishWidth(): void {
    this.ctx?.services.get('layout.shell')?.element()?.style.setProperty(FRAME_WIDTH_VAR, `${this.width}px`);
  }

  private frameAtClientX(clientX: number): number {
    const ctx = this.ctx;
    const zone = this.zone;
    if (ctx === undefined || zone === undefined) return 1;
    const scrollLeft = ctx.services.get('layout.scrollSync')?.getScroll().scrollLeft ?? 0;
    const x = clientX - zone.getBoundingClientRect().left + scrollLeft;
    return frameAtX(x, this.width, ctx.playback.totalFrames);
  }

  /** Redessine la règle si la durée ou la largeur d'image a changé depuis le dernier rendu. */
  private draw(): void {
    const element = this.element;
    const ctx = this.ctx;
    if (element === undefined || ctx === undefined) return;
    const totalFrames = ctx.playback.totalFrames;
    if (this.drawn?.totalFrames === totalFrames && this.drawn.frameWidth === this.width) return;
    element.style.width = `${timelineWidth(totalFrames, this.width)}px`;
    element.replaceChildren(...this.labels(element.ownerDocument, totalFrames));
    this.drawn = { totalFrames, frameWidth: this.width };
  }

  private labels(doc: Document, totalFrames: number): HTMLElement[] {
    return labelledFrames(totalFrames, labelStep(this.width), this.width).map((frame) => {
      const label = doc.createElement('span');
      label.classList.add(RULER_LABEL_CLASS);
      label.style.left = `${frameLeft(frame, this.width)}px`;
      label.textContent = String(frame);
      return label;
    });
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layout.ruler : render appelé avant init.');
    return this.ctx;
  }
}
