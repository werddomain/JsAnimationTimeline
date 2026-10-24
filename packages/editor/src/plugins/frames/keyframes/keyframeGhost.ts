// packages/editor/src/plugins/frames/keyframes/keyframeGhost.ts
/**
 * Fantôme du glisser des images clés : un repère sur chaque cellule de
 * destination, dans un calque posé sur la grille (`frames.grid` →
 * `element()`). Vert si le déplacement serait accepté, rouge s'il serait
 * refusé. Redessiné à chaque `frames:gridRendered` (défilement, zoom,
 * document), vide hors d'un glisser.
 */

import type { IEditorContext } from '../../../core/context/IEditorContext';
// Types seulement : l'événement écouté (frames:gridRendered) et les services utilisés.
import type {} from '../grid/types';
import type {} from '../../layout/ruler/RulerPlugin';

/** Classes CSS du fantôme. */
export const FRAMES_KEYFRAMES_CLASSES = Object.freeze({
  layer: 'jt-keyframe-ghost',
  marker: 'jt-keyframe-ghost__marker',
  valid: 'jt-keyframe-ghost__marker--valid',
  invalid: 'jt-keyframe-ghost__marker--invalid'
});

/** Cellule de destination d'une image clé. */
export interface IGhostMarker {
  readonly rowId: string;
  readonly frame: number;
}

/** Fantôme dessiné dans un calque. */
export interface IKeyframeGhost {
  /** Dessine un repère sur chaque cellule ; `valid` choisit la couleur. */
  show(markers: readonly IGhostMarker[], valid: boolean): void;
  /** Efface les repères. */
  clear(): void;
  /** Cesse d'écouter la grille et efface les repères. */
  destroy(): void;
}

interface IGhostState {
  readonly markers: readonly IGhostMarker[];
  readonly valid: boolean;
}

const EMPTY_STATE: IGhostState = Object.freeze({ markers: Object.freeze([]), valid: true });

/** Crée le fantôme dessiné dans `overlay` (enfant de l'élément de la grille). */
export function createKeyframeGhost(ctx: IEditorContext, overlay: HTMLElement): IKeyframeGhost {
  let state = EMPTY_STATE;

  const draw = (): void => {
    const grid = ctx.services.require('frames.grid');
    const ruler = ctx.services.require('layout.ruler');
    const window = grid.window();
    const rowHeight = grid.rowHeight();
    const rowIndex = new Map(grid.rows().map((row) => [row.id, row.index] as const));
    const fragment = overlay.ownerDocument.createDocumentFragment();
    state.markers.forEach((marker) => {
      const index = rowIndex.get(marker.rowId);
      const visible =
        index !== undefined &&
        index >= window.rows.first &&
        index <= window.rows.last &&
        marker.frame >= window.frames.first &&
        marker.frame <= window.frames.last;
      if (!visible) return;
      const element = overlay.ownerDocument.createElement('div');
      element.className = `${FRAMES_KEYFRAMES_CLASSES.marker} ${state.valid ? FRAMES_KEYFRAMES_CLASSES.valid : FRAMES_KEYFRAMES_CLASSES.invalid}`;
      const left = ruler.frameLeft(marker.frame);
      element.style.left = `${left}px`;
      element.style.width = `${ruler.frameLeft(marker.frame + 1) - left}px`;
      element.style.top = `${index * rowHeight}px`;
      element.style.height = `${rowHeight}px`;
      element.dataset.rowId = marker.rowId;
      element.dataset.frame = String(marker.frame);
      fragment.appendChild(element);
    });
    overlay.replaceChildren(fragment);
  };

  const show = (markers: readonly IGhostMarker[], valid: boolean): void => {
    state = { markers: [...markers], valid };
    draw();
  };
  const clear = (): void => {
    state = EMPTY_STATE;
    overlay.replaceChildren();
  };
  const stopListening = ctx.events.on('frames:gridRendered', () => {
    if (state.markers.length > 0) draw();
  });

  return Object.freeze({
    show,
    clear,
    destroy: () => {
      stopListening();
      clear();
    }
  });
}
