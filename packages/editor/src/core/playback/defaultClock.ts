// packages/editor/src/core/playback/defaultClock.ts
/**
 * Horloge par défaut de la lecture de l'éditeur, quand `options.clock` est
 * absent : celle du navigateur (`createBrowserClock()` du runtime :
 * `performance.now`, `requestAnimationFrame`) si `requestAnimationFrame`
 * existe, sinon des minuteries (`setTimeout`, environ 60
 * images par seconde) annulables par numéro. L'éditeur se crée donc aussi
 * hors d'un navigateur complet (tests, rendu côté serveur, webview limitée).
 */

import { createBrowserClock } from '@kazo-ca/timeline-runtime';
import type { IPlayerClock } from '@kazo-ca/timeline-runtime';

/** Délai d'une image avec les minuteries (60 images par seconde). */
const TIMER_FRAME_MS = 1000 / 60;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Horloge à minuteries, pour les environnements sans `requestAnimationFrame`. */
export function createTimerClock(): IPlayerClock {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let nextHandle = 1;
  return {
    now,
    requestFrame(callback: () => void): number {
      const handle = nextHandle++;
      timers.set(handle, setTimeout(() => {
        timers.delete(handle);
        callback();
      }, TIMER_FRAME_MS));
      return handle;
    },
    cancelFrame(handle: number): void {
      const timer = timers.get(handle);
      if (timer === undefined) return;
      clearTimeout(timer);
      timers.delete(handle);
    }
  };
}

/** Horloge du navigateur si `requestAnimationFrame` existe, sinon horloge à minuteries. */
export function createDefaultClock(): IPlayerClock {
  return typeof requestAnimationFrame === 'function' ? createBrowserClock() : createTimerClock();
}
