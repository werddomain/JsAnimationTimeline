// packages/editor/src/plugins/playback/livePreview/previewSettings.ts
/**
 * Réglages de `playback.livePreview`, sans DOM : modes reconnus, contrôle
 * des valeurs, intervalle et échéance du mode `'throttled'`, libellés
 * français.
 */

import type { LivePreviewMode } from './types';

/** Modes reconnus, dans l'ordre de la liste de la barre d'outils. */
export const LIVE_PREVIEW_MODES: readonly LivePreviewMode[] = Object.freeze(['live', 'throttled', 'onRelease']);

/** Fréquence par défaut du mode `'throttled'`, en rendus par seconde. */
export const DEFAULT_PREVIEW_MAX_FPS = 10;

/** Bornes de la fréquence du mode `'throttled'`. */
export const MIN_PREVIEW_MAX_FPS = 1;
export const MAX_PREVIEW_MAX_FPS = 60;

/** Mode vérifié ; lève une `Error` française pour un mode inconnu. */
export function checkMode(mode: unknown): LivePreviewMode {
  if (LIVE_PREVIEW_MODES.some((known) => known === mode)) return mode as LivePreviewMode;
  throw new Error(`Mode d'aperçu inconnu : « ${String(mode)} » (attendu : ${LIVE_PREVIEW_MODES.join(', ')}).`);
}

/** Fréquence vérifiée ; lève une `Error` française hors de 1 à 60 (entier). */
export function checkMaxFps(maxFps: number): number {
  if (Number.isInteger(maxFps) && maxFps >= MIN_PREVIEW_MAX_FPS && maxFps <= MAX_PREVIEW_MAX_FPS) return maxFps;
  throw new Error(
    `La fréquence de l'aperçu doit être un nombre entier de ${MIN_PREVIEW_MAX_FPS} à ${MAX_PREVIEW_MAX_FPS} images par seconde.`
  );
}

/** Intervalle entre deux rendus du mode `'throttled'`, en millisecondes. */
export function previewIntervalMs(maxFps: number): number {
  return 1000 / maxFps;
}

/** Temps restant avant le prochain rendu permis (0 : maintenant). */
export function remainingMs(now: number, lastRender: number, maxFps: number): number {
  return Math.max(0, lastRender + previewIntervalMs(maxFps) - now);
}

/** Libellé français d'un mode (`'throttled'` avec sa fréquence). */
export function modeLabel(mode: LivePreviewMode, maxFps: number): string {
  switch (mode) {
    case 'live':
      return 'Aperçu en direct';
    case 'throttled':
      return `Aperçu limité (${maxFps} img/s)`;
    case 'onRelease':
      return 'Aperçu au relâchement';
  }
}
