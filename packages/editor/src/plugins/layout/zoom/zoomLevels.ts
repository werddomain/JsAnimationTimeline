// packages/editor/src/plugins/layout/zoom/zoomLevels.ts
/**
 * Calculs sans DOM de `layout.zoom` : bornes, paliers (zoom avant / arrière)
 * et position de défilement qui garde un point d'ancrage immobile.
 */

/*
 * Deux plages, à ne pas confondre :
 * - les paliers (`DEFAULT_ZOOM_LEVELS`, 25 % à 400 %) servent au zoom avant /
 *   arrière (boutons, Ctrl + molette) et à la liste déroulante de T4 : les pas
 *   s'arrêtent au premier et au dernier palier ;
 * - les bornes (`DEFAULT_MIN_ZOOM` à `DEFAULT_MAX_ZOOM`, 10 % à 800 %) limitent
 *   `setZoom` : ajustement à la fenêtre, curseur de T4, pincement.
 */

/** Facteur de zoom minimal par défaut (`setZoom`, ajustement à la fenêtre, pincement). */
export const DEFAULT_MIN_ZOOM = 0.1;
/** Facteur de zoom maximal par défaut (`setZoom`, ajustement à la fenêtre, pincement). */
export const DEFAULT_MAX_ZOOM = 8;
/**
 * Paliers par défaut du zoom avant / arrière (et de la liste déroulante de
 * T4) : de « minuscule » à « très grand », comme les tailles d'images de Flash.
 */
export const DEFAULT_ZOOM_LEVELS: readonly number[] = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);

/** Écart sous lequel deux facteurs de zoom sont considérés égaux. */
const EPSILON = 1e-9;

/** Bornes du zoom. */
export interface IZoomRange {
  readonly min: number;
  readonly max: number;
}

/** Vrai si `value` est un facteur de zoom utilisable (nombre fini > 0). */
export function isValidZoom(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Borne `zoom` à `range`. */
export function clampZoom(zoom: number, range: IZoomRange): number {
  return Math.min(range.max, Math.max(range.min, zoom));
}

/**
 * Palier suivant (`direction` 1) ou précédent (`direction` -1) de `zoom`
 * parmi les `levels` triés compris dans `range`. Hors des paliers, on va au
 * plus proche dans la direction. Au-delà du dernier palier (ou avant le
 * premier), le zoom ne bouge pas : les bornes plus larges restent à `setZoom`.
 */
export function stepZoom(zoom: number, direction: 1 | -1, levels: readonly number[], range: IZoomRange): number {
  const candidates = levels.filter((level) => level >= range.min - EPSILON && level <= range.max + EPSILON);
  const next =
    direction === 1
      ? candidates.find((level) => level > zoom + EPSILON)
      : [...candidates].reverse().find((level) => level < zoom - EPSILON);
  return clampZoom(next ?? zoom, range);
}

/**
 * Défilement horizontal qui garde immobile, à l'écran, le point situé à
 * `anchorOffset` pixels du bord gauche de la zone des images.
 *
 * @param scrollLeft Défilement avant le zoom.
 * @param previousWidth Largeur d'image avant le zoom.
 * @param nextWidth Largeur d'image après le zoom.
 */
export function anchoredScrollLeft(
  anchorOffset: number,
  scrollLeft: number,
  previousWidth: number,
  nextWidth: number
): number {
  const framePosition = (scrollLeft + anchorOffset) / previousWidth;
  return Math.max(0, framePosition * nextWidth - anchorOffset);
}
