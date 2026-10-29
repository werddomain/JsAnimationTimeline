// demo/runtime/src/objectStage/hook.ts
/**
 * Point d'accès de test de la page : `window.__objectStageDemo`. Il donne aux
 * tests Playwright le lecteur, l'horloge manuelle, les valeurs reçues par les
 * scènes, l'état réel du sprite et de la piste audio, et de quoi calculer les
 * valeurs attendues avec `evaluateDocument`.
 */

import { evaluateDocument } from '@kazo-ca/timeline-runtime';
import type { IManualClock, IPlayer, ITimelineDocument, PropertyRegistry, PropertyValues } from '@kazo-ca/timeline-runtime';
import type { AudioTrack } from './audioStage';
import type { ISprite } from './canvasStage';
import type { ReceivedLog } from './received';

/** What the page exposes on `window.__objectStageDemo`. */
export interface IObjectStageDemoHook {
  readonly player: IPlayer;
  /** The manual clock; `null` with the browser clock. */
  readonly clock: IManualClock | null;
  readonly document: ITimelineDocument;
  /** Values received by each object stage, one entry per rendered frame. */
  readonly received: ReceivedLog;
  /** The sprite drawn by the canvas stage (what `apply` really set). */
  readonly sprite: ISprite;
  /** The audio track (its `volume` is what `apply` really set). */
  readonly track: AudioTrack;
  /**
   * Moves the manual clock so that the player renders the (possibly
   * fractional) `frame`, then pauses there. Throws without the manual clock
   * or when `frame` is before the current time.
   */
  advanceToFrame(frame: number): void;
  /** Values of every layer at `frame`, by layer id, from `evaluateDocument`. */
  expected(frame: number): Record<string, PropertyValues>;
}

declare global {
  interface Window {
    __objectStageDemo?: IObjectStageDemoHook;
  }
}

/** Builds the hook for a player driven by `clock` (or by the browser clock when `null`). */
export function createDemoHook(
  player: IPlayer,
  clock: IManualClock | null,
  document: ITimelineDocument,
  received: ReceivedLog,
  registry: PropertyRegistry,
  sprite: ISprite,
  track: AudioTrack
): IObjectStageDemoHook {
  return {
    player,
    clock,
    document,
    received,
    sprite,
    track,
    advanceToFrame(frame) {
      if (clock === null) {
        throw new Error('advanceToFrame needs the manual clock (?clock=manual).');
      }
      const delta = ((frame - 1) * 1000) / player.fps - player.time.timeMs;
      if (delta < 0) {
        throw new Error(`Frame ${frame} is before the current time.`);
      }
      const wasPlaying = player.playing;
      player.play();
      clock.advance(delta);
      if (!wasPlaying) {
        player.pause();
      }
    },
    expected(frame) {
      const result: Record<string, PropertyValues> = {};
      evaluateDocument(document, frame, { registry }).forEach((state) => {
        result[state.layerId] = state.values;
      });
      return result;
    }
  };
}
