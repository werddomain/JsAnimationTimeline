// packages/editor/src/plugins/layout/playhead/PlayheadPlugin.ts
/**
 * Plugin : layout.playhead
 * Epic : layout
 * Dépend de : layout.shell, layout.ruler, layout.scrollSync
 * Écoute : playhead:changed, playback:pause, playback:complete, document:loaded, document:changed, layout:scrolled, zoom:changed
 * Émet : playhead:scrubStart, playhead:scrubEnd
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
 *   Le glisser est annoncé par `playhead:scrubStart` / `playhead:scrubEnd`
 *   (et lisible avec le service `layout.playhead`), par exemple pour régler
 *   l'aperçu pendant un glisser. `playhead:scrubStart` part avant le premier
 *   `seek`. Tout glisser se termine par `playhead:scrubEnd` : relâchement,
 *   `pointercancel`, capture perdue, mouvement sans bouton enfoncé
 *   (relâchement perdu hors de la fenêtre), perte du focus de la fenêtre et
 *   Échap. Seul un glisser coupé par la destruction de l'éditeur ne l'émet
 *   pas (aucun événement pendant la destruction) : les plugins qui en
 *   dépendent nettoient dans leur propre `destroy`.
 * - Le glisser capture le pointeur et ne suit que lui : un deuxième doigt est
 *   ignoré, et une capture perdue termine le glisser.
 * - Le repère est un curseur accessible (`role="slider"`) : flèches (une
 *   image), Page précédente / suivante (10 images), Début / Fin. Pendant la
 *   lecture, sa valeur n'est mise à jour qu'à l'arrêt (pause ou fin).
 * - Quand la tête sort de la partie visible (lecture, clavier, `seek` d'un
 *   autre plugin, focus au clavier), la zone des images défile pour la
 *   montrer ; pas pendant un glisser, qui suit le pointeur.
 * - Après un zoom (`zoom:changed`), la tête se replace à la nouvelle largeur.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYOUT_SLOTS } from '../shell/layoutSlots';
import { clampFrame, frameCenter, frameLeft } from '../ruler/frameGeometry';
import type { IRulerApi } from '../ruler/RulerPlugin';
// Import pour effet : rend `zoom:changed` visible ici (la tête l'écoute sans dépendre du zoom).
import '../zoom/zoomEvents';
import './Playhead.less';

/** Charge utile de `playhead:scrubStart` et `playhead:scrubEnd`. */
export interface PlayheadScrubEvent {
  /** Image visée au début ou à la fin du glisser (`ctx.playback.frame`). */
  readonly frame: number;
}

/** API publiée sous le service `layout.playhead`. */
export interface IPlayheadApi {
  /** Vrai pendant un glisser de la tête sur la règle. */
  readonly isScrubbing: () => boolean;
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'playhead:scrubStart': PlayheadScrubEvent;
    'playhead:scrubEnd': PlayheadScrubEvent;
  }
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layout.playhead': IPlayheadApi;
  }
}

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

/** Capture `pointerId` sur `element` si possible (absent de jsdom, refusé pour un pointeur inactif). */
function capturePointer(element: HTMLElement, pointerId: number): boolean {
  if (typeof element.setPointerCapture !== 'function') return false;
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

/** Tête de lecture : repère sur la règle, ligne dans les images, glisser et clavier. */
export class PlayheadPlugin implements EditorPlugin {
  readonly id = 'layout.playhead';
  readonly dependencies: readonly string[] = ['layout.shell', 'layout.ruler', 'layout.scrollSync'];
  readonly slot = LAYOUT_SLOTS.ruler;

  private ctx: IEditorContext | undefined;
  private elements: IPlayheadElements | undefined;
  /** Termine le glisser en cours ; `announce` à faux pendant la destruction (aucun événement). */
  private stopDrag: ((announce?: boolean) => void) | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    const replace = (): void => this.place(ctx.playback.frame);
    this.cleanups = [
      ctx.services.provide('layout.playhead', { isScrubbing: () => this.stopDrag !== undefined }),
      ctx.events.on('playhead:changed', (event) => {
        // Lecture de la mise en page (défilement) avant les écritures de `place`.
        if (this.stopDrag === undefined) this.follow(event.frame);
        this.place(event.frame);
      }),
      ctx.events.on('playback:pause', replace),
      ctx.events.on('playback:complete', replace),
      ctx.events.on('document:loaded', replace),
      ctx.events.on('document:changed', replace),
      ctx.events.on('zoom:changed', replace),
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
    this.alignLine(ctx.services.get('layout.scrollSync')?.getScroll().scrollTop ?? 0);
  }

  destroy(): void {
    this.stopDrag?.(false);
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
    const onFocus = (): void => this.onFocus();
    elements.ruler.addEventListener('pointerdown', onPointerDown);
    elements.head.addEventListener('keydown', onKeyDown);
    elements.head.addEventListener('focus', onFocus);
    this.cleanups.push(() => {
      elements.ruler.removeEventListener('pointerdown', onPointerDown);
      elements.head.removeEventListener('keydown', onKeyDown);
      elements.head.removeEventListener('focus', onFocus);
    });
  }

  /** Place le repère et la ligne sur l'image `frame` ; met à jour le curseur accessible hors lecture. */
  private place(frame: number): void {
    const elements = this.elements;
    const ctx = this.ctx;
    if (elements === undefined || ctx === undefined) return;
    const width = this.ruler().frameWidth();
    const totalFrames = ctx.playback.totalFrames;
    elements.head.style.left = `${frameLeft(frame, width)}px`;
    elements.head.style.width = `${width}px`;
    elements.line.style.left = `${frameCenter(frame, width)}px`;
    if (ctx.playback.playing) return;
    elements.head.setAttribute('aria-valuemax', String(totalFrames));
    elements.head.setAttribute('aria-valuenow', String(frame));
    elements.head.setAttribute('aria-valuetext', `Image ${frame} sur ${totalFrames}`);
  }

  /** Garde la ligne sur toute la hauteur visible quand la zone des images défile verticalement. */
  private alignLine(scrollTop: number): void {
    if (this.elements !== undefined) this.elements.line.style.transform = `translateY(${scrollTop}px)`;
  }

  /** Fait défiler la zone des images si l'image `frame` sort de la partie visible. */
  private follow(frame: number): void {
    const ctx = this.ctx;
    if (ctx === undefined) return;
    const scroll = ctx.services.get('layout.scrollSync');
    if (scroll === undefined) return;
    const state = scroll.getScroll();
    if (state.viewportWidth <= 0) return;
    const width = this.ruler().frameWidth();
    const left = frameLeft(frame, width);
    if (left >= state.scrollLeft && left + width <= state.scrollLeft + state.viewportWidth) return;
    scroll.scrollTo({ left: Math.max(0, left - FOLLOW_MARGIN_FRAMES * width) });
  }

  /**
   * Focus au clavier : le navigateur a pu faire défiler la règle (sans barre
   * de défilement) pour montrer le repère. On montre la tête dans la zone des
   * images, puis on recale la règle sur elle.
   */
  private onFocus(): void {
    const ctx = this.ctx;
    // Focus donné par un clic sur la règle : le glisser s'en occupe.
    if (ctx === undefined || this.stopDrag !== undefined) return;
    this.follow(ctx.playback.frame);
    ctx.services.get('layout.scrollSync')?.scrollTo({});
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
    // Un autre pointeur (deuxième doigt) pendant un glisser : ignoré.
    if (this.stopDrag !== undefined) return;
    event.preventDefault();
    if (ctx.playback.playing) ctx.playback.pause();
    // Image visée lue avant tout changement (focus, défilement).
    const target = this.ruler().frameAtClientX(event.clientX);
    const { ruler, head } = elements;
    const doc = ruler.ownerDocument;
    const pointerId = event.pointerId;
    const captured = capturePointer(ruler, pointerId);
    const view = doc.defaultView;
    const onMove = (move: PointerEvent): void => {
      if (move.pointerId !== pointerId) return;
      // Plus aucun bouton enfoncé : le relâchement a été perdu (hors de la fenêtre).
      if (move.buttons === 0) {
        this.stopDrag?.();
        return;
      }
      this.seek(this.ruler().frameAtClientX(move.clientX));
    };
    const onEnd = (end: PointerEvent): void => {
      if (end.pointerId === pointerId) this.stopDrag?.();
    };
    const onBlur = (): void => this.stopDrag?.();
    const onEscape = (escape: KeyboardEvent): void => {
      if (escape.key !== 'Escape') return;
      escape.preventDefault();
      this.stopDrag?.();
    };
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onEnd);
    doc.addEventListener('pointercancel', onEnd);
    doc.addEventListener('keydown', onEscape);
    view?.addEventListener('blur', onBlur);
    ruler.addEventListener('lostpointercapture', onEnd);
    head.classList.add(PLAYHEAD_DRAGGING_CLASS);
    this.stopDrag = (announce = true) => {
      this.stopDrag = undefined;
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onEnd);
      doc.removeEventListener('pointercancel', onEnd);
      doc.removeEventListener('keydown', onEscape);
      view?.removeEventListener('blur', onBlur);
      ruler.removeEventListener('lostpointercapture', onEnd);
      if (captured && ruler.hasPointerCapture(pointerId)) ruler.releasePointerCapture(pointerId);
      head.classList.remove(PLAYHEAD_DRAGGING_CLASS);
      if (announce) this.ctx?.events.emit('playhead:scrubEnd', { frame: this.ctx.playback.frame });
    };
    // Glisser installé avant le focus (`onFocus` l'ignore) et avant le premier `seek`.
    ctx.events.emit('playhead:scrubStart', { frame: clampFrame(target, ctx.playback.totalFrames) });
    head.focus({ preventScroll: true });
    this.seek(target);
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
