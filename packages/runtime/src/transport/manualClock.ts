// packages/runtime/src/transport/manualClock.ts
/**
 * Horloge manuelle : le temps n'avance que sur `advance(deltaMs)`. Sert aux
 * boucles de jeu qui ont leur propre rythme, au rendu image par image et aux
 * tests. C'est un `IPlayerClock` ordinaire.
 */

import type { IPlayerClock } from './types';

/** A clock moved by hand; see `createManualClock`. */
export interface IManualClock extends IPlayerClock {
  /** Number of frame callbacks waiting for the next `advance`. */
  readonly pendingFrames: number;
  /**
   * Moves `now()` forward by `deltaMs` (finite, ≥ 0), then runs once the frame
   * callbacks requested before this call. Callbacks requested meanwhile wait
   * for the next `advance`. When callbacks throw, all of them still run and
   * the first error is rethrown. A callback cancelled by an earlier one of the
   * same batch does not run, as with `requestAnimationFrame`.
   */
  advance(deltaMs: number): void;
}

function assertFiniteTime(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite number of at least 0 (got ${value}).`);
  }
}

/** Creates a manual clock whose `now()` starts at `startMs` (finite, ≥ 0; defaults to 0). */
export function createManualClock(startMs = 0): IManualClock {
  assertFiniteTime(startMs, 'startMs');
  let time = startMs;
  let nextHandle = 1;
  const callbacks = new Map<number, () => void>();

  return {
    now: () => time,
    requestFrame(callback: () => void): number {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelFrame(handle: number): void {
      callbacks.delete(handle);
    },
    get pendingFrames(): number {
      return callbacks.size;
    },
    advance(deltaMs: number): void {
      assertFiniteTime(deltaMs, 'deltaMs');
      time += deltaMs;
      // Handles only: a callback cancelled by an earlier one in this batch is skipped.
      const due = Array.from(callbacks.keys());
      const errors: unknown[] = [];
      due.forEach((handle) => {
        const callback = callbacks.get(handle);
        if (callback === undefined) {
          return;
        }
        callbacks.delete(handle);
        try {
          callback();
        } catch (error) {
          errors.push(error);
        }
      });
      if (errors.length > 0) {
        throw errors[0];
      }
    }
  };
}
