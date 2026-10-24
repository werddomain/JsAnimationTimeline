// packages/editor/src/plugins/playback/livePreview/types.ts
/**
 * Types publics de `playback.livePreview` : modes d'aperçu, options, API du
 * service et événement `playback:previewChanged`. Ce module ajoute aussi le
 * service à `EditorServiceMap` et l'événement à `TimelineEventMap` (fusion de
 * déclarations).
 */

/**
 * Aperçu de la scène pendant le glisser de la tête de lecture :
 * - `'live'` : à chaque image d'affichage (comportement par défaut) ;
 * - `'throttled'` : au plus `maxFps` rendus par seconde, cadencés sur
 *   l'horloge de l'éditeur, plus un rendu de fin quand le pointeur s'arrête ;
 * - `'onRelease'` : un seul rendu, à la fin du glisser.
 * La lecture, les flèches du clavier et les modifications hors glisser ne
 * sont jamais retenues.
 */
export type LivePreviewMode = 'live' | 'throttled' | 'onRelease';

/** Options de `playback.livePreview`. */
export interface ILivePreviewOptions {
  /** Mode de départ. Par défaut : `'live'`. */
  readonly mode?: LivePreviewMode;
  /** Rendus par seconde au plus en mode `'throttled'`, entier de 1 à 60. Par défaut : 10. */
  readonly maxFps?: number;
  /** Liste « Aperçu » dans la barre d'outils. Par défaut : `true`. */
  readonly toolbar?: boolean;
}

/** API du service `playback.livePreview`. */
export interface ILivePreviewApi {
  readonly mode: LivePreviewMode;
  readonly maxFps: number;
  /** Change le mode (effet immédiat, même pendant un glisser) ; lève pour un mode inconnu. */
  setMode(mode: LivePreviewMode): void;
  /** Change la fréquence du mode `'throttled'` ; lève hors de 1 à 60 (entier). */
  setMaxFps(maxFps: number): void;
}

/** Charge utile de `playback:previewChanged` : le réglage de l'aperçu a changé. */
export interface PreviewChangedEvent {
  readonly mode: LivePreviewMode;
  readonly maxFps: number;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'playback.livePreview': ILivePreviewApi;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'playback:previewChanged': PreviewChangedEvent;
  }
}
