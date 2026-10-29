// packages/runtime/src/player/clock.ts
/**
 * Horloge par défaut du lecteur : `performance.now` et `requestAnimationFrame`.
 */

import type { IPlayerClock } from './types';

/** Clock of the browser; throws when `requestAnimationFrame` is missing. */
export function createBrowserClock(): IPlayerClock {
  if (typeof requestAnimationFrame !== 'function') {
    throw new Error('requestAnimationFrame is not available; pass a clock in the player options.');
  }
  return {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(() => callback()),
    cancelFrame: (handle) => cancelAnimationFrame(handle)
  };
}
