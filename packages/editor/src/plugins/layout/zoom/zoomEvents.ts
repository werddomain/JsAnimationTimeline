// packages/editor/src/plugins/layout/zoom/zoomEvents.ts
/**
 * Contrat de l'événement `zoom:changed` (types seulement).
 *
 * Le futur plugin `layout.zoom` (tâche L3) en sera le seul émetteur ; il
 * possédera ce fichier. Les plugins qui dessinent des images (la grille
 * `frames.grid`, la règle...) l'écoutent pour suivre la largeur d'une image.
 */

/** Charge utile de `zoom:changed`. */
export interface ZoomChangedEvent {
  /** Nouvelle largeur d'une image, en pixels (nombre fini, strictement positif). */
  readonly frameWidth: number;
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'zoom:changed': ZoomChangedEvent;
  }
}
