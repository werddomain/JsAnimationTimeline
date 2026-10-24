// packages/editor/src/core/playback/playbackEvents.ts
/**
 * Événements de la lecture, ajoutés à `TimelineEventMap` par fusion de
 * déclarations. Tous sont émis par le noyau seul (`CoreEventName`) :
 * - `playhead:changed` : l'image affichée a changé (au plus une fois par
 *   image d'affichage, déplacements regroupés) ;
 * - `frame:render` : une image vient d'être évaluée ; porte l'échantillon ;
 * - `playback:play` / `playback:pause` : la lecture démarre ou s'arrête ;
 * - `playback:loop` : la dernière image est atteinte en boucle, retour à l'image 1 ;
 * - `playback:complete` : la dernière image est atteinte sans boucle, la lecture s'arrête.
 */

import type { IFrameSample } from './types';

/** Charge utile de `playhead:changed`. */
export interface PlayheadChangedEvent {
  /** Nouvelle image affichée (entière). */
  readonly frame: number;
  /** Image affichée au rendu précédent. */
  readonly previous: number;
}

/** Charge utile de `frame:render`. */
export interface FrameRenderEvent {
  readonly sample: IFrameSample;
}

/** Charge utile (vide) des événements `playback:*`. */
export type PlaybackStateEvent = Readonly<Record<string, never>>;

declare module '../events/TimelineEventMap' {
  interface TimelineEventMap {
    'playhead:changed': PlayheadChangedEvent;
    'frame:render': FrameRenderEvent;
    'playback:play': PlaybackStateEvent;
    'playback:pause': PlaybackStateEvent;
    'playback:loop': PlaybackStateEvent;
    'playback:complete': PlaybackStateEvent;
  }
}
