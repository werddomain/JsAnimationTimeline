// packages/editor/src/plugins/layout/playhead/PlayheadPlugin.ts
/**
 * Plugin : layout.playhead
 * Epic : layout
 * Dépend de : layout.ruler, layout.scrollSync
 * Écoute : playhead:changed, document:loaded, document:changed, layout:scrolled
 * Émet : —
 *
 * Tête de lecture, reprise de `legacy/ui/TimeRuler.ts` (déplacement) : un
 * repère sur la règle et une ligne verticale dans la zone des images, au
 * milieu de l'image affichée.
 *
 * La tête ne fait que lire et déplacer la lecture de l'éditeur
 * (`ctx.playback`) : elle suit `playhead:changed` et appelle
 * `ctx.playback.seek(n)` quand on clique ou glisse sur la règle, ou au
 * clavier. Elle n'appelle jamais de lecteur et ne touche à aucune cible
 * animée : c'est la lecture, puis la scène du développeur, qui appliquent
 * les valeurs. Elle ne dessine que dans les zones de la timeline.
 *
 * - Cliquer ou glisser sur la règle (bouton principal) place la tête ; la
 *   lecture en cours est mise en pause au début du glisser, comme dans Flash.
 * - Le repère est un curseur accessible (`role="slider"`) : flèches (une
 *   image), Page précédente / suivante (10 images), Début / Fin.
 * - Pendant la lecture, la zone des images défile pour garder la tête visible.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYOUT_SLOTS } from '../shell/layoutSlots';
import { clampFrame, frameCenter, frameLeft } from '../ruler/frameGeometry';
import type { IRulerApi } from '../ruler/RulerPlugin';
import './Playhead.less';

/** Classe du repère de la tête, sur la règle. */
export const PLAYHEAD_HEAD_CLASS = 'jt-playhead__head';
/** Classe de la ligne de la tête, dans la zone des images. */
export const PLAYHEAD_LINE_CLASS = 'jt-playhead__line';
/** Classe ajoutée au repère pendant un glisser. */
export const PLAYHEAD_DRAGGING_CLASS = 'jt-playhead--dragging';

/** Images parcourues par Page précédente / Page suivante. */
export const PAGE_STEP_FRAMES = 10;
/** Images laissées visibles à gauche de la tête quand la zone des images la suit. */
export const FOLLOW_MARGIN_FRAMES = 2;

/** Bouton principal de la souris (`MouseEvent.button`). */
const PRIMARY_BUTTON = 0;

/** Éléments de la tête, créés au rendu. */
interface IPlayheadElements {
  readonly ruler: HTMLElement;
  readonly head: HTMLElement;
  readonly line: HTMLElement;
}

/** Image visée par une touche du curseur, ou `undefined` pour une autre touche. */
function keyTarget(key: string, frame: number, totalFrames: number): number | undefined {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return frame - 1;
    case 'ArrowRight':
    case 'ArrowUp':
      return frame + 1;
    case 'PageDown':
      return frame - PAGE_STEP_FRAMES;
    case 'PageUp':
      return frame + PAGE_STEP_FRAMES;
    case 'Home':
      return 1;
    case 'End':
      return totalFrames;
    default:
      return undefined;
  }
}

/** Tête de lecture : repère sur la règle, ligne dans les images, glisser et clavier. */
export class PlayheadPlugin implements EditorPlugin {
  readonly id = 'layout.playhead';
  readonly dependencies: readonly string[] = ['layout.ruler', 'layout.scrollSync'];
  readonly slot = LAYOUT_SLOTS.ruler;

  private ctx: IEditorContext | undefined;
  private elements: IPlayheadElements | undefined;
  private stopDrag: (() => void) | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.cleanups = [
      ctx.events.on('playhead:changed', (event) => {
        this.place(event.frame);
        if (this.stopDrag === undefined) this.follow(event.frame);
      }),
      ctx.events.on('document:loaded', () => this.place(ctx.playback.frame)),
      ctx.events.on('document:changed', () => this.place(ctx.playback.frame)),
      ctx.events.on('layout:scrolled', (state) => this.alignLine(state.scrollTop))
    ];
  };

  render(ruler: HTMLElement): void {
    const ctx = this.requireContext();
    const frames = ctx.services.require('layout.shell').zone('frames');
    if (frames === undefined) throw new Error('layout.playhead : la zone « frames » de layout.shell est introuvable.');
    const doc = ruler.ownerDocument;
    const head = doc.createElement('div');
    head.classList.add(PLAYHEAD_HEAD_CLASS);
    head.tabIndex = 0;
    head.setAttribute('role', 'slider');
    head.setAttribute('aria-label', 'Tête de lecture');
    head.setAttribute('aria-valuemin', '1');
    const line = doc.createElement('div');
    line.classList.add(PLAYHEAD_LINE_CLASS);
    line.setAttribute('aria-hidden', 'true');
    ruler.appendChild(head);
    frames.appendChild(line);
    this.elements = { ruler, head, line };
    this.listen(this.elements);
    this.place(ctx.playback.frame);
  }

  destroy(): void {
    this.stopDrag?.();
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.elements?.head.remove();
    this.elements?.line.remove();
    this.elements = undefined;
    this.ctx = undefined;
  }

  private listen(elements: IPlayheadElements): void {
    const onPointerDown = (event: PointerEvent): void => this.startDrag(event);
    const onKeyDown = (event: KeyboardEvent): void => this.onKey(event);
    elements.ruler.addEventListener('pointerdown', onPointerDown);
    elements.head.addEventListener('keydown', onKeyDown);
    this.cleanups.push(() => {
      elements.ruler.removeEventListener('pointerdown', onPointerDown);
      elements.head.removeEventListener('keydown', onKeyDown);
    });
  }

  /** Place le repère et la ligne sur l'image `frame` et met à jour le curseur accessible. */
  private place(frame: number): void {
    const elements = this.elements;
    const ctx = this.ctx;
    if (elements === undefined || ctx === undefined) return;
    const width = this.ruler().frameWidth();
    const totalFrames = ctx.playback.totalFrames;
    elements.head.style.left = `${frameLeft(frame, width)}px`;
    elements.head.style.width = `${width}px`;
    elements.line.style.left = `${frameCenter(frame, width)}px`;
    elements.head.setAttribute('aria-valuemax', String(totalFrames));
    elements.head.setAttribute('aria-valuenow', String(frame));
    elements.head.setAttribute('aria-valuetext', `Image ${frame} sur ${totalFrames}`);
  }

  /** Garde la ligne sur toute la hauteur visible quand la zone des images défile verticalement. */
  private alignLine(scrollTop: number): void {
    if (this.elements !== undefined) this.elements.line.style.transform = `translateY(${scrollTop}px)`;
  }

  /** Fait défiler la zone des images si l'image `frame` en sort pendant la lecture. */
  private follow(frame: number): void {
    const ctx = this.ctx;
    if (ctx === undefined || !ctx.playback.playing) return;
    const scroll = ctx.services.get('layout.scrollSync');
    if (scroll === undefined) return;
    const state = scroll.getScroll();
    if (state.viewportWidth <= 0) return;
    const width = this.ruler().frameWidth();
    const left = frameLeft(frame, width);
    if (left >= state.scrollLeft && left + width <= state.scrollLeft + state.viewportWidth) return;
    scroll.scrollTo({ left: Math.max(0, left - FOLLOW_MARGIN_FRAMES * width) });
  }

  private seek(frame: number): void {
    const ctx = this.ctx;
    if (ctx !== undefined) ctx.playback.seek(clampFrame(frame, ctx.playback.totalFrames));
  }

  /** Clic ou début de glisser sur la règle : met en pause, place la tête et suit le pointeur. */
  private startDrag(event: PointerEvent): void {
    const ctx = this.ctx;
    const elements = this.elements;
    if (ctx === undefined || elements === undefined || event.button !== PRIMARY_BUTTON) return;
    event.preventDefault();
    this.stopDrag?.();
    if (ctx.playback.playing) ctx.playback.pause();
    elements.head.focus({ preventScroll: true });
    this.seek(this.ruler().frameAtClientX(event.clientX));
    const doc = elements.ruler.ownerDocument;
    const onMove = (move: PointerEvent): void => this.seek(this.ruler().frameAtClientX(move.clientX));
    const onEnd = (): void => this.stopDrag?.();
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onEnd);
    doc.addEventListener('pointercancel', onEnd);
    elements.head.classList.add(PLAYHEAD_DRAGGING_CLASS);
    this.stopDrag = () => {
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onEnd);
      doc.removeEventListener('pointercancel', onEnd);
      elements.head.classList.remove(PLAYHEAD_DRAGGING_CLASS);
      this.stopDrag = undefined;
    };
  }

  /** Clavier du curseur. */
  private onKey(event: KeyboardEvent): void {
    const ctx = this.ctx;
    if (ctx === undefined) return;
    const target = keyTarget(event.key, ctx.playback.frame, ctx.playback.totalFrames);
    if (target === undefined) return;
    event.preventDefault();
    this.seek(target);
  }

  private ruler(): IRulerApi {
    return this.requireContext().services.require('layout.ruler');
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layout.playhead : render appelé avant init.');
    return this.ctx;
  }
}
