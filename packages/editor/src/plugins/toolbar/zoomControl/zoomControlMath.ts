// packages/editor/src/plugins/toolbar/zoomControl/zoomControlMath.ts
/**
 * Calculs sans DOM de `toolbar.zoomControl` : préréglages de la liste,
 * bornes et échelle du curseur, zoom « Ajuster à la fenêtre » et libellés
 * en pourcentage.
 *
 * Le curseur suit une échelle logarithmique (base 2) : passer de 25 % à
 * 50 % fait le même trajet que de 200 % à 400 %.
 */

import type { IZoomRange } from '../../layout/zoom/zoomLevels';

/** Préréglages de la liste déroulante (rapport d'analyse, décision par défaut : 25 % à 400 %). */
export const ZOOM_PRESETS: readonly number[] = Object.freeze([0.25, 0.5, 1, 2, 4]);

/** Graduation interne du curseur : un centième d'octave (2^0,01, environ 0,7 %). */
export const SLIDER_STEPS_PER_OCTAVE = 100;

/**
 * Pas du curseur au clavier et au glisser : 5 centièmes d'octave (environ
 * 3,5 %). Les préréglages tombent sur des multiples de 100, donc sur un pas.
 */
export const SLIDER_STEP = 5;

/** Écart sous lequel deux facteurs de zoom sont considérés égaux. */
const EPSILON = 1e-6;

/** Préréglages compris dans `range` (bornes du service `layout.zoom`). */
export function presetsWithin(range: IZoomRange): number[] {
  return ZOOM_PRESETS.filter((preset) => preset >= range.min - EPSILON && preset <= range.max + EPSILON);
}

/**
 * Bornes du curseur : celles des préréglages (25 % à 400 %), réduites à
 * `range` ; `range` lui-même s'il ne contient aucun préréglage.
 */
export function sliderRange(range: IZoomRange): IZoomRange {
  const presets = presetsWithin(range);
  if (presets.length === 0) return range;
  return { min: Math.max(range.min, presets[0]), max: Math.min(range.max, presets[presets.length - 1]) };
}

/** Valeur entière du curseur pour `zoom` (échelle logarithmique). */
export function zoomToSlider(zoom: number): number {
  return Math.round(Math.log2(zoom) * SLIDER_STEPS_PER_OCTAVE);
}

/** Zoom d'une valeur du curseur. */
export function sliderToZoom(value: number): number {
  return 2 ** (value / SLIDER_STEPS_PER_OCTAVE);
}

/**
 * Zoom qui fait tenir `totalFrames` images dans `visibleWidth` pixels, borné
 * à `range` ; `undefined` si la largeur visible est inconnue (vue non
 * affichée).
 */
export function fitZoom(
  visibleWidth: number,
  totalFrames: number,
  baseFrameWidth: number,
  range: IZoomRange
): number | undefined {
  if (!(visibleWidth > 0) || !(totalFrames > 0) || !(baseFrameWidth > 0)) return undefined;
  const zoom = visibleWidth / (totalFrames * baseFrameWidth);
  return Math.min(range.max, Math.max(range.min, zoom));
}

/** Vrai si deux facteurs de zoom sont égaux (à l'arrondi près). */
export function sameZoom(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

/** Libellé français d'un zoom, arrondi à l'unité (`1.5` -> `150 %`, espace insécable). */
export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}\u00a0%`;
}

/**
 * Libellé d'un zoom hors préréglages : arrondi à l'unité, ou au dixième si
 * l'unité le confondrait avec un préréglage (`0.998` -> `99,8 %`, pas `100 %`).
 */
export function formatCustomZoom(zoom: number, presets: readonly number[]): string {
  const label = formatZoom(zoom);
  if (!presets.some((preset) => formatZoom(preset) === label)) return label;
  return `${(zoom * 100).toFixed(1).replace('.', ',')}\u00a0%`;
}
