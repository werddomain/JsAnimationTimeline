// packages/runtime/src/stage/html/waapi.ts
/**
 * Mode `waapi` de la scène HTML (le code du lecteur R3) : une `Animation`
 * Web Animations par calque qui change quelque chose en CSS, couvrant toute
 * la timeline, en pause à 0 et réalignée à chaque `sync` (`currentTime`,
 * `playbackRate`, lecture ou pause).
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

/** The animations of the current document. */
export class WaapiAnimations {
  private animations: Animation[] = [];
  private duration = 0;
  private source: { readonly doc: ITimelineDocument; readonly layers: readonly IStageLayer<Element>[] } | null = null;

  /**
   * Replaces the animations by those of `doc`. All or nothing: when a target
   * fails, the new animations are cancelled and the old ones kept; a target
   * without `Element.animate` throws a `StageDocumentError`. Nothing is
   * rebuilt for the same document, layers and elements (e.g. the document
   * given back after a refused one): the next `sync` realigns them.
   */
  rebuild(doc: ITimelineDocument, layers: readonly IStageLayer<Element>[], registry: PropertyRegistry): void {
    if (this.isSameSource(doc, layers)) {
      return;
    }
    const duration = timelineDuration(doc.settings);
    const created: Animation[] = [];
    try {
      for (const { layer, object } of layers) {
        const keyframes = buildLayerKeyframes(layer, doc.settings, registry);
        if (keyframes === null) {
          continue;
        }
        if (typeof object.animate !== 'function') {
          throw new StageDocumentError(WAAPI_MISSING_MESSAGE);
        }
        const animation = object.animate(keyframes, { duration, fill: 'both', easing: 'linear' });
        animation.pause();
        created.push(animation);
      }
    } catch (error) {
      created.forEach((animation) => animation.cancel());
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
    this.animations.forEach((animation) => {
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

  /** Cancels every animation (targets get their own styles back). */
  cancel(): void {
    this.animations.forEach((animation) => animation.cancel());
    this.animations = [];
    this.source = null;
  }
}
