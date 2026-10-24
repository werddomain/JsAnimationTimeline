// packages/editor/src/plugins/layers/icon/menuPosition.ts
/**
 * Position du menu d'icônes : sous l'ancre, ramenée dans la fenêtre. Fonction
 * pure (rectangles en pixels), sans DOM.
 */

/** Rectangle minimal (ancre ou fenêtre). */
export interface IRectLike {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
}

/** Position `fixed` du coin haut-gauche du menu. */
export interface IMenuPosition {
  readonly left: number;
  readonly top: number;
}

/**
 * Place un menu de taille `size` sous `anchor` (en 0,0 sans ancre). S'il
 * déborde en bas, il passe au-dessus de l'ancre ; il ne sort jamais de la
 * fenêtre `viewport` (largeur, hauteur) par le haut ou la gauche.
 */
export function clampMenuPosition(
  anchor: IRectLike | undefined,
  size: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number }
): IMenuPosition {
  const wantedLeft = anchor?.left ?? 0;
  let top = anchor?.bottom ?? 0;
  if (top + size.height > viewport.height && anchor !== undefined) top = anchor.top - size.height;
  return {
    left: Math.max(0, Math.min(wantedLeft, viewport.width - size.width)),
    top: Math.max(0, Math.min(top, viewport.height - size.height))
  };
}
