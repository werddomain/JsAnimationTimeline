// packages/editor/src/plugins/toolbar/zoomControl/zoomControlMath.ts
/**
 * Calculs sans DOM de `toolbar.zoomControl` : échelle et pas du curseur,
 * zoom « Ajuster à la fenêtre » et libellés en pourcentage.
 *
 * Le curseur couvre toutes les bornes du service `layout.zoom` (`range()`),
 * sur une échelle logarithmique (base 2) : passer de 25 % à 50 % fait le
 * même trajet que de 200 % à 400 %. Sa valeur est exacte (aucun arrondi) :
 * un zoom fait ailleurs (« Ajuster à la fenêtre », pincement, autre plugin)
 * s'y affiche tel quel, et un palier comme 75 % tombe juste.
 */

import type { IZoomRange } from '../../layout/zoom/zoomLevels';

/** Unités du curseur par octave (doublement du zoom). */
export const SLIDER_UNITS_PER_OCTAVE = 100;

/**
 * Pas du curseur au clavier, en unités : 5 centièmes d'octave (environ
 * 3,5 %). Un pas qui enjamberait un palier s'arrête dessus.
 */
export const SLIDER_STEP = 5;

/** Écart sous lequel deux facteurs de zoom sont considérés égaux. */
const EPSILON = 1e-9;

/** Valeur du curseur pour `zoom` (échelle logarithmique, exacte). */
export function zoomToSlider(zoom: number): number {
  return Math.log2(zoom) * SLIDER_UNITS_PER_OCTAVE;
}

/** Zoom d'une valeur du curseur. */
export function sliderToZoom(value: number): number {
  return 2 ** (value / SLIDER_UNITS_PER_OCTAVE);
}

/** Bornes du curseur : toutes celles du zoom. */
export function sliderBounds(range: IZoomRange): { readonly min: number; readonly max: number } {
  return { min: zoomToSlider(range.min), max: zoomToSlider(range.max) };
}

/**
 * Zoom après un pas de curseur (`direction` 1 vers la droite, -1 vers la
 * gauche) depuis `zoom` : `SLIDER_STEP` unités, arrêté sur un palier de
 * `levels` qu'il enjamberait, borné à `range`.
 */
export function stepSlider(zoom: number, direction: 1 | -1, levels: readonly number[], range: IZoomRange): number {
  const target = sliderToZoom(zoomToSlider(zoom) + direction * SLIDER_STEP);
  const crossed = levels.filter((level) =>
    direction === 1 ? level > zoom + EPSILON && level < target - EPSILON : level < zoom - EPSILON && level > target + EPSILON
  );
  const next = crossed.length === 0 ? target : direction === 1 ? Math.min(...crossed) : Math.max(...crossed);
  return Math.min(range.max, Math.max(range.min, next));
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

/** Pourcentage français avec `decimals` décimales et une espace insécable. */
function percent(zoom: number, decimals: number): string {
  return `${(zoom * 100).toFixed(decimals).replace('.', ',')}\u00a0%`;
}

/** Libellé français d'un zoom, arrondi à l'unité (`1.5` -> `150 %`). */
export function formatZoom(zoom: number): string {
  return percent(zoom, 0);
}

/** Décimales au plus d'un libellé hors paliers. */
const MAX_DECIMALS = 6;

/**
 * Libellé d'un zoom hors paliers : le moins de décimales possible sans
 * qu'il se lise comme un palier de `levels` (`0.998` -> `99,8 %`,
 * `0.9996` -> `99,96 %`, jamais `100 %` ni `100,0 %`).
 */
export function formatCustomZoom(zoom: number, levels: readonly number[]): string {
  for (let decimals = 0; decimals < MAX_DECIMALS; decimals += 1) {
    const shown = Number((zoom * 100).toFixed(decimals));
    if (!levels.some((level) => Math.abs(level * 100 - shown) < EPSILON)) return percent(zoom, decimals);
  }
  return percent(zoom, MAX_DECIMALS);
}
