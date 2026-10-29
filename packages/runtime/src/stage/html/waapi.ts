// packages/runtime/src/stage/html/waapi.ts
/**
 * Mode `waapi` de la scène HTML (le code du lecteur R3) : une `Animation`
 * Web Animations par calque qui change quelque chose en CSS, couvrant toute
 * la timeline, en pause à 0 et réalignée à chaque `sync` (`currentTime`,
 * `playbackRate`, lecture ou pause). `release` annule l'animation du calque
 * libéré (élément changé, ou premier document refusé).
 */

import type { ITimelineDocument } from '../../model/document';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import { timelineDuration } from '../../transport/time';
import type { ITransportSyncState, ITransportTime } from '../../transport/types';
import { StageDocumentError } from '../reports';
import type { IStageLayer } from '../types';
import { buildLayerKeyframes } from './keyframes';

/** Message of the error refusing a document when a target cannot animate. */
export const WAAPI_MISSING_MESSAGE = 'The Web Animations API (Element.animate) is not available.';

/** The animation of one layer, on the element it was built for. */
interface ILayerAnimation {
  readonly layerId: string;
  readonly element: Element;
  readonly animation: Animation;
}

/** The animations of the current document. */
export class WaapiAnimations {
  private animations: ILayerAnimation[] = [];
  private duration = 0;
  private source: { readonly doc: ITimelineDocument; readonly layers: readonly IStageLayer<Element>[] } | null = null;
  /** The last `rebuild` refused its document: the next one may be the previous document given back. */
  private refused = false;

  /**
   * Replaces the animations by those of `doc`. All or nothing: when a target
   * fails, the new animations are cancelled and the old ones kept; a target
   * without `Element.animate` throws a `StageDocumentError`. Only right
   * after a refused document, the previous document given back (same
   * document, layers and elements) keeps its animations; the next `sync`
   * realigns them. Every other call rebuilds (a document may change in place).
   */
  rebuild(doc: ITimelineDocument, layers: readonly IStageLayer<Element>[], registry: PropertyRegistry): void {
    const afterRefusal = this.refused;
    this.refused = false;
    if (afterRefusal && this.isSameSource(doc, layers)) {
      return;
    }
    const duration = timelineDuration(doc.settings);
    const created: ILayerAnimation[] = [];
    try {
      for (const { layerId, layer, object } of layers) {
        const keyframes = buildLayerKeyframes(layer, doc.settings, registry);
        if (keyframes === null) {
          continue;
        }
        if (typeof object.animate !== 'function') {
          throw new StageDocumentError(WAAPI_MISSING_MESSAGE);
        }
        const animation = object.animate(keyframes, { duration, fill: 'both', easing: 'linear' });
        animation.pause();
        created.push({ layerId, element: object, animation });
      }
    } catch (error) {
      created.forEach(({ animation }) => animation.cancel());
      this.refused = true;
      throw error;
    }
    this.cancel();
    this.animations = created;
    this.duration = duration;
    this.source = { doc, layers: layers.slice() };
  }

  private isSameSource(doc: ITimelineDocument, layers: readonly IStageLayer<Element>[]): boolean {
    const source = this.source;
    return source !== null && source.doc === doc && source.layers.length === layers.length &&
      source.layers.every((old, i) => old.layer === layers[i].layer && old.object === layers[i].object);
  }

  /** Aligns every animation on the time, rate and play state. */
  sync(time: ITransportTime, state: ITransportSyncState): void {
    const running = state.playing && time.timeMs < this.duration;
    this.animations.forEach(({ animation }) => {
      animation.playbackRate = state.speed;
      if (running) {
        animation.currentTime = time.timeMs;
        animation.play();
      } else {
        // Pause first: setting currentTime then completes the pause at exactly this time.
        animation.pause();
        animation.currentTime = time.timeMs;
      }
    });
  }

  /**
   * Cancels the animation of `layerId` on `element`. The next `rebuild`
   * then rebuilds, even for the document given back after a refusal.
   */
  release(layerId: string, element: Element): void {
    const released = this.animations.filter((entry) => entry.layerId === layerId && entry.element === element);
    if (released.length === 0) {
      return;
    }
    released.forEach(({ animation }) => animation.cancel());
    this.animations = this.animations.filter((entry) => !released.includes(entry));
    this.source = null;
  }

  /** Cancels every animation (targets get their own styles back). */
  cancel(): void {
    this.animations.forEach(({ animation }) => animation.cancel());
    this.animations = [];
    this.source = null;
  }
}
