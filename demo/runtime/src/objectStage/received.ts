// demo/runtime/src/objectStage/received.ts
/**
 * Journal des valeurs reçues par chaque scène d'objets, image rendue par image
 * rendue : la page de démo l'expose aux tests Playwright, qui le comparent
 * à `evaluateDocument`.
 */

import type { ITransportTime, ObjectStageState } from '@kazo-ca/timeline-runtime';

/** Values received by one layer of a stage. */
export interface IReceivedLayer {
  readonly layerId: string;
  readonly active: boolean;
  readonly values: Readonly<Record<string, number>>;
}

/** What a stage received for one rendered frame. */
export interface IReceivedFrame {
  /** Fractional frame of the rendered time. */
  readonly frame: number;
  readonly layers: readonly IReceivedLayer[];
}

/** Received frames by stage id. */
export type ReceivedLog = Record<string, IReceivedFrame[]>;

/** Oldest frames are dropped beyond this size. */
export const MAX_RECEIVED_FRAMES = 500;

/** Appends what the stage received at `time` to `log`. */
export function recordFrame<T>(log: IReceivedFrame[], time: ITransportTime, states: readonly ObjectStageState<T>[]): void {
  log.push({
    frame: time.frame,
    layers: states.map((state) => ({ layerId: state.layerId, active: state.active, values: { ...state.values } }))
  });
  if (log.length > MAX_RECEIVED_FRAMES) {
    log.splice(0, log.length - MAX_RECEIVED_FRAMES);
  }
}
