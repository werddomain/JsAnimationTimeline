// packages/editor/src/plugins/layout/ruler/frameGeometry.ts
/**
 * Calculs sans DOM de la règle, repris de `legacy/ui/TimeRuler.ts` : place
 * d'une image en pixels, image sous un point et écart entre deux étiquettes.
 *
 * L'image `n` (de 1 à `totalFrames`) occupe la cellule
 * `[(n - 1) * largeur, n * largeur[`. La largeur par défaut est
 * `DEFAULT_FRAME_WIDTH` de `model/rows/rowMetrics.ts`, partagée avec la grille.
 */

/** Écart minimal voulu entre deux étiquettes de la règle, en pixels. */
export const MIN_LABEL_SPACING_PX = 30;

/** Pas possibles entre deux étiquettes (Flash numérote de 5 en 5 au minimum). */
export const LABEL_STEPS: readonly number[] = Object.freeze([5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]);

/** Vrai si `width` est une largeur d'image utilisable (nombre fini > 0). */
export function isValidFrameWidth(width: number): boolean {
  return Number.isFinite(width) && width > 0;
}

/** Bord gauche de l'image `frame`, en pixels. */
export function frameLeft(frame: number, frameWidth: number): number {
  return (frame - 1) * frameWidth;
}

/** Milieu de l'image `frame`, en pixels (où passe la ligne de la tête de lecture). */
export function frameCenter(frame: number, frameWidth: number): number {
  return frameLeft(frame, frameWidth) + frameWidth / 2;
}

/** Largeur totale de la timeline, en pixels. */
export function timelineWidth(totalFrames: number, frameWidth: number): number {
  return totalFrames * frameWidth;
}

/** Borne `frame` à 1..`totalFrames`. */
export function clampFrame(frame: number, totalFrames: number): number {
  return Math.min(Math.max(1, totalFrames), Math.max(1, frame));
}

/**
 * Image dont la cellule contient `x` (pixels depuis le début de la
 * timeline), bornée à 1..`totalFrames`.
 *
 * Le legacy arrondissait (`round(x / largeur) + 1`), ce qui donnait l'image
 * suivante dès la moitié d'une cellule ; ici, toute la cellule désigne son image.
 */
export function frameAtX(x: number, frameWidth: number, totalFrames: number): number {
  return clampFrame(Math.floor(x / frameWidth) + 1, totalFrames);
}

/**
 * Pas entre deux étiquettes : le plus petit de `LABEL_STEPS` qui les écarte
 * d'au moins `MIN_LABEL_SPACING_PX` (le plus grand sinon).
 */
export function labelStep(frameWidth: number): number {
  const step = LABEL_STEPS.find((candidate) => candidate * frameWidth >= MIN_LABEL_SPACING_PX);
  return step ?? LABEL_STEPS[LABEL_STEPS.length - 1] ?? 1;
}

/** Images étiquetées : l'image 1, puis chaque multiple de `step` jusqu'à `totalFrames`. */
export function labelledFrames(totalFrames: number, step: number): number[] {
  const frames = totalFrames >= 1 ? [1] : [];
  for (let frame = step; frame <= totalFrames; frame += step) frames.push(frame);
  return frames;
}
