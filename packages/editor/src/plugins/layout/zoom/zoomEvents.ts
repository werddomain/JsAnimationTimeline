// packages/editor/src/plugins/layout/zoom/zoomEvents.ts
/**
 * Événement `zoom:changed`, émis par `layout.zoom` après chaque changement
 * de zoom, une fois la règle redessinée à la nouvelle largeur d'image (et
 * avant que la zone des images défile pour garder son point d'ancrage).
 *
 * Séparé du plugin pour que les plugins qui l'écoutent sans dépendre du zoom
 * (tête de lecture, grille...) en voient le type avec un simple import pour
 * effet.
 */

/** Charge utile de `zoom:changed`. */
export interface ZoomChangedEvent {
  /** Nouveau facteur de zoom (1 = largeur d'image de base). */
  readonly zoom: number;
  /** Nouvelle largeur d'une image, en pixels. */
  readonly frameWidth: number;
  /** Facteur de zoom précédent. */
  readonly previousZoom: number;
  /** Largeur d'une image précédente, en pixels. */
  readonly previousFrameWidth: number;
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'zoom:changed': ZoomChangedEvent;
  }
}
