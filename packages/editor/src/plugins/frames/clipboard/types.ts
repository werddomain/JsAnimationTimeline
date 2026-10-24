// packages/editor/src/plugins/frames/clipboard/types.ts
/**
 * Contrat de `frames.clipboard` pour les autres plugins : le contenu du
 * presse-papiers d'images (`IFrameClip`), le service `frames.clipboard` et
 * l'événement `frames:clipboardChanged`. Le menu contextuel ou les boutons
 * d'une tâche suivante s'en servent sans connaître le modèle.
 *
 * Le contenu est du JSON pur (aucune référence au document) : il peut être
 * recopié tel quel dans le presse-papiers du système (E1).
 */

import type { Easing, PropertyTracks, SpanKind } from '@werddomain/timeline-runtime';
import type { IFrameCell } from '../selection/frameSelection';

/** Marque du format, pour reconnaître le contenu d'un presse-papiers. */
export const FRAME_CLIP_FORMAT = 'jstimeline/frames';

/** Version du format. */
export const FRAME_CLIP_VERSION = 1;

/** Plage copiée : images relatives au début de la suite copiée (1 = première image). */
export interface IClipSpan {
  /** Première image, relative (>= 1). */
  readonly start: number;
  /** Dernière image, relative (>= start). */
  readonly end: number;
  readonly kind: SpanKind;
  readonly easing?: Easing;
  /** Images clés de propriété, en images relatives. */
  readonly tracks?: PropertyTracks;
}

/** Suite d'images contiguës copiée sur une ligne. */
export interface IClipRun {
  /** Écart entre la première image de la suite et la plus petite image copiée. */
  readonly frameOffset: number;
  /** Nombre d'images. */
  readonly length: number;
  /** Plages contiguës de 1 à `length`. */
  readonly spans: readonly IClipSpan[];
}

/** Suites copiées sur une ligne de calque. */
export interface IClipRow {
  /** Écart, en lignes de calque visibles, avec la première ligne copiée. */
  readonly rowOffset: number;
  readonly runs: readonly IClipRun[];
}

/** Contenu du presse-papiers d'images. */
export interface IFrameClip {
  readonly format: typeof FRAME_CLIP_FORMAT;
  readonly version: typeof FRAME_CLIP_VERSION;
  /** Nombre d'images du rectangle englobant. */
  readonly width: number;
  readonly rows: readonly IClipRow[];
}

/** API publiée sous le service `frames.clipboard`. */
export interface IFramesClipboardService {
  /** Copie la sélection d'images ; `false` (presse-papiers inchangé) s'il n'y a rien à copier. */
  copy(): boolean;
  /**
   * Colle à `target` (sinon l'ancre de la sélection, la première image
   * sélectionnée, ou la tête de lecture sur le premier calque sélectionné) ;
   * `false` si rien n'a été collé (presse-papiers vide, pas de cible, refus).
   */
  paste(target?: IFrameCell): boolean;
  /** Vrai si le presse-papiers contient des images. */
  hasContent(): boolean;
  /** Contenu actuel (figé), ou `undefined` s'il est vide. */
  content(): IFrameClip | undefined;
  /** Vide le presse-papiers. */
  clear(): void;
}

/** Charge utile de `frames:clipboardChanged`. */
export interface FramesClipboardChangedEvent {
  readonly hasContent: boolean;
  /** Nombre de lignes du rectangle copié (0 si vide). */
  readonly rows: number;
  /** Nombre d'images du rectangle copié (0 si vide). */
  readonly width: number;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'frames.clipboard': IFramesClipboardService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'frames:clipboardChanged': FramesClipboardChangedEvent;
  }
}
