// packages/runtime/src/model/span.ts
/**
 * Plage (span) d'un calque, modèle motion tween de Flash CS4 : une plage
 * commence par une image clé de contenu et couvre [start, end] (images
 * absolues, à partir de 1). Ses pistes donnent les images clés de propriété.
 */

import type { Easing } from './easing';

/**
 * - `static` : la cible ne bouge pas (valeurs posées à `start`) ;
 * - `blank` : la cible est masquée pendant la plage ;
 * - `tween` : interpolation de mouvement entre les images clés de propriété.
 */
export type SpanKind = 'static' | 'blank' | 'tween';

/** Value of one property at one absolute frame. */
export interface IPropertyKeyframe {
  readonly frame: number;
  readonly value: number;
}

/** Keyframes per property name (e.g. `x`, `opacity`), frames strictly increasing. */
export type PropertyTracks = Readonly<Record<string, readonly IPropertyKeyframe[]>>;

/** A frame range of a layer. */
export interface ISpan {
  readonly id: string;
  /** First frame, inclusive, 1-based. */
  readonly start: number;
  /** Last frame, inclusive (>= start). */
  readonly end: number;
  readonly kind: SpanKind;
  /** Only on `tween` spans; defaults to `DEFAULT_EASING`. */
  readonly easing?: Easing;
  /** Only on `static` and `tween` spans. */
  readonly tracks?: PropertyTracks;
}
