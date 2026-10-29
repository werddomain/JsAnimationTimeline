// packages/editor/src/plugins/layout/scrollSync/scrollGeometry.ts
/**
 * Calculs sans DOM de `layout.scrollSync` : conversion d'un mouvement de
 * molette en pixels et état de défilement de la zone des images.
 */

/** `WheelEvent.DOM_DELTA_LINE` : delta exprimé en lignes. */
export const DELTA_LINE = 1;
/** `WheelEvent.DOM_DELTA_PAGE` : delta exprimé en pages. */
export const DELTA_PAGE = 2;
/** Hauteur d'une ligne de molette, en pixels (valeur usuelle des navigateurs). */
export const LINE_HEIGHT_PX = 16;

/** Ce dont la conversion a besoin d'un `WheelEvent`. */
export interface IWheelLike {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
}

/** Déplacement en pixels. */
export interface IScrollDelta {
  readonly dx: number;
  readonly dy: number;
}

/** Position et taille visible de la zone des images (charge utile de `layout:scrolled`). */
export interface IScrollState {
  /** Décalage horizontal, en pixels. */
  readonly scrollLeft: number;
  /** Décalage vertical, en pixels. */
  readonly scrollTop: number;
  /** Largeur visible de la zone des images, sans barre de défilement. */
  readonly viewportWidth: number;
  /** Hauteur visible de la zone des images, sans barre de défilement. */
  readonly viewportHeight: number;
}

/** Ce dont la lecture de l'état a besoin d'un élément qui défile. */
export interface IScrollableLike {
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
}

/** Ce dont la mesure des barres de défilement a besoin d'un élément. */
export interface IScrollbarBoxLike {
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
  readonly clientLeft: number;
  readonly clientTop: number;
}

/**
 * Convertit un mouvement de molette en pixels.
 *
 * @param pageSize Taille d'une « page » (`DOM_DELTA_PAGE`), en pixels, pour chaque axe.
 */
export function wheelToPixels(event: IWheelLike, pageSize: IScrollDelta): IScrollDelta {
  if (event.deltaMode === DELTA_LINE) {
    return { dx: event.deltaX * LINE_HEIGHT_PX, dy: event.deltaY * LINE_HEIGHT_PX };
  }
  if (event.deltaMode === DELTA_PAGE) {
    return { dx: event.deltaX * pageSize.dx, dy: event.deltaY * pageSize.dy };
  }
  return { dx: event.deltaX, dy: event.deltaY };
}

/**
 * Déplacement au-dessus de la règle : tout mouvement devient horizontal
 * (le mouvement horizontal s'il existe, sinon le vertical).
 */
export function rulerDelta(delta: IScrollDelta): IScrollDelta {
  return { dx: delta.dx !== 0 ? delta.dx : delta.dy, dy: 0 };
}

/**
 * Déplacement au-dessus des calques : vertical ; avec Maj, horizontal
 * (comme Maj + molette dans la zone des images).
 */
export function layersDelta(delta: IScrollDelta, shiftKey: boolean): IScrollDelta {
  return shiftKey ? rulerDelta(delta) : { dx: 0, dy: delta.dy };
}

/** État de défilement d'un élément. */
export function readScrollState(element: IScrollableLike): IScrollState {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    viewportWidth: element.clientWidth,
    viewportHeight: element.clientHeight
  };
}

/** Vrai si les deux états diffèrent (position ou taille visible). */
export function scrollStateChanged(previous: IScrollState | undefined, next: IScrollState): boolean {
  return (
    previous === undefined ||
    previous.scrollLeft !== next.scrollLeft ||
    previous.scrollTop !== next.scrollTop ||
    previous.viewportWidth !== next.viewportWidth ||
    previous.viewportHeight !== next.viewportHeight
  );
}

/**
 * Épaisseur des barres de défilement d'un élément, en pixels : `x` pour la
 * barre horizontale (en bas), `y` pour la barre verticale (à droite).
 * Les bordures sont retirées ; une valeur négative (arrondis) devient 0.
 */
export function scrollbarSizes(element: IScrollbarBoxLike): { readonly x: number; readonly y: number } {
  return {
    x: Math.max(0, element.offsetHeight - element.clientHeight - element.clientTop * 2),
    y: Math.max(0, element.offsetWidth - element.clientWidth - element.clientLeft * 2)
  };
}
