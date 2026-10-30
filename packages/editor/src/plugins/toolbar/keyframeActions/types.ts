// packages/editor/src/plugins/toolbar/keyframeActions/types.ts
/**
 * Contrat de `toolbar.keyframeActions` pour les autres plugins : l'événement
 * `toolbar:editKeyframe`, émis par le bouton « Modifier l'image clé ». Le
 * panneau de propriétés (S1) l'écoute pour ouvrir l'édition.
 */

/** Charge utile de `toolbar:editKeyframe`. */
export interface ToolbarEditKeyframeEvent {
  /** Calque de l'image clé à modifier. */
  readonly layerId: string;
  /** Independent property, absent for a legacy layer keyframe. */
  readonly property?: string;
  /** Image à modifier. */
  readonly frame: number;
  /** Vrai si l'image est dans une interpolation de mouvement. */
  readonly inTween: boolean;
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'toolbar:editKeyframe': ToolbarEditKeyframeEvent;
  }
}
