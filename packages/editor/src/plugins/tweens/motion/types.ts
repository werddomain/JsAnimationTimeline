// packages/editor/src/plugins/tweens/motion/types.ts
/**
 * Contrat de `tweens.motion` pour les autres plugins : le service
 * `tweens.motion` et ses trois événements. Les boutons de la barre d'outils
 * (T2), le menu contextuel (I1), les propriétés (W2) et l'accélération (W3)
 * s'en servent.
 */

import type { ISpan } from '@werddomain/timeline-runtime';

/** Disponibilité d'une action : activée, ou désactivée avec la raison (message français). */
export interface IMotionTweenAvailability {
  readonly enabled: boolean;
  /** Pourquoi l'action est refusée ; absente quand elle est activée. */
  readonly reason?: string;
}

/** Charge utile de `tweens:motionAvailabilityChanged` (émis seulement quand une des deux change). */
export interface MotionAvailabilityChangedEvent {
  readonly canCreate: IMotionTweenAvailability;
  readonly canRemove: IMotionTweenAvailability;
}

/** Charge utile de `tweens:motionCreated` et `tweens:motionRemoved` (après une exécution réussie). */
export interface MotionTweenEvent {
  readonly layerId: string;
  readonly spanId: string;
  /** Première image de la plage. */
  readonly start: number;
  /** Dernière image de la plage. */
  readonly end: number;
}

/** API publiée sous le service `tweens.motion`. */
export interface IMotionTweenService {
  /** La sélection d'images permet-elle de créer une interpolation ? (essai à blanc, même verdict que `create`.) */
  canCreate(): IMotionTweenAvailability;
  /** La sélection touche-t-elle une interpolation à supprimer ? (essai à blanc, même verdict que `remove`.) */
  canRemove(): IMotionTweenAvailability;
  /** Crée l'interpolation de la sélection ; `false` si refusée (`command:refused`). */
  create(): boolean;
  /**
   * Supprime les interpolations touchées par la sélection, sur un ou
   * plusieurs calques (une seule entrée d'historique, refusée en bloc si un
   * calque est verrouillé) ; `false` si refusé.
   */
  remove(): boolean;
  /**
   * Crée une interpolation sur `layerId` : avec `to`, entre les images clés
   * `from` et `to` ; sans, sur toute la plage qui contient `from`.
   */
  createAt(layerId: string, from: number, to?: number): boolean;
  /** Supprime l'interpolation de `layerId` qui contient `frame`. */
  removeAt(layerId: string, frame: number): boolean;
  /** Interpolation de `layerId` qui contient `frame`, `undefined` s'il n'y en a pas. */
  tweenAt(layerId: string, frame: number): ISpan | undefined;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'tweens.motion': IMotionTweenService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'tweens:motionAvailabilityChanged': MotionAvailabilityChangedEvent;
    'tweens:motionCreated': MotionTweenEvent;
    'tweens:motionRemoved': MotionTweenEvent;
  }
}
