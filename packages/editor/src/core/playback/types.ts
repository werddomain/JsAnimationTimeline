// packages/editor/src/core/playback/types.ts
/**
 * Types publics de la lecture dans l'éditeur : la façade `IEditorPlayback`
 * (posée sur le `Transport` sans DOM du runtime) et l'échantillon d'une image
 * (`IFrameSample`), valeurs de chaque calque calculées par l'évaluation.
 *
 * L'échantillon ne dépend d'aucune scène : c'est ce que reçoivent
 * `frame:render`, `editor.onFrame()` et `editor.sample()`, avec ou sans scène
 * branchée (mode tiré, robot, état Blazor...).
 */

import type { ITransportTime, LayerTarget, PropertyValues } from '@werddomain/timeline-runtime';

/** Valeurs d'un calque à une image. */
export interface ILayerSample {
  readonly layerId: string;
  /** Cible du calque telle qu'écrite dans le document (`undefined` si le calque n'en a pas). */
  readonly target: LayerTarget | undefined;
  /** Valeur de chaque propriété animée dans le calque (pistes inconnues du registre exclues). */
  readonly values: PropertyValues;
  /** Plage qui contient l'image, `undefined` hors de toute plage. */
  readonly spanId: string | undefined;
  /** `false` dans une plage vide (`blank`), avant la première plage et après la dernière. */
  readonly active: boolean;
  /** Œil du calque dans l'éditeur : `false` si le calque ou un dossier parent est masqué. */
  readonly editorVisible: boolean;
}

/** Valeurs de tous les calques à une image, dans l'ordre d'affichage du document. */
export interface IFrameSample {
  /** Position échantillonnée (image fractionnaire pendant la lecture). */
  readonly time: ITransportTime;
  /** Calques du document (dossiers exclus), dans l'ordre d'affichage. */
  readonly layers: readonly ILayerSample[];
  /** Calque `layerId` de cet échantillon, ou `undefined`. */
  layer(layerId: string): ILayerSample | undefined;
}

/** Reçoit chaque image rendue (voir `editor.onFrame`). */
export type FrameListener = (sample: IFrameSample) => void;

/**
 * Lecture vue par un plugin (`ctx.playback`) et par l'hôte (`editor.playback`).
 *
 * Le temps est tenu par un `Transport` sans DOM : la lecture fonctionne avec
 * ou sans scène. Les déplacements (`seek`, lecture) et les changements du
 * document sont regroupés : une seule évaluation, un seul `playhead:changed`
 * et un seul `frame:render` par image d'affichage. Les lectures (`frame`,
 * `time`) sont, elles, à jour tout de suite.
 *
 * Après la destruction de l'éditeur, les actions (`play`, `pause`, `seek`,
 * affectation de `loop` ou `speed`, `sample`) lèvent une erreur.
 */
export interface IEditorPlayback {
  /** Image affichée, entière, de 1 à `totalFrames`. */
  readonly frame: number;
  /** Position courante en millisecondes, image fractionnaire et image entière. */
  readonly time: ITransportTime;
  /** Vrai pendant la lecture. */
  readonly playing: boolean;
  /** Images par seconde du document. */
  readonly fps: number;
  /** Nombre d'images du document. */
  readonly totalFrames: number;
  /** Reprend à l'image 1 après la dernière image (faux par défaut). */
  loop: boolean;
  /** Vitesse de lecture, nombre fini > 0 (1 par défaut). */
  speed: number;
  /** Lance la lecture depuis l'image courante (depuis l'image 1 si la fin est atteinte). */
  play(): void;
  /** Met la lecture en pause. */
  pause(): void;
  /** Bascule entre lecture et pause. */
  toggle(): void;
  /**
   * Place la tête de lecture au début de l'image `frame` (bornée à
   * 1..totalFrames), en lecture ou non. Le rendu suit à la prochaine image
   * d'affichage.
   */
  seek(frame: number): void;
  /**
   * Échantillon synchrone à l'image `frame` (fractionnaire permise, bornée),
   * ou à la position courante sans argument. N'émet aucun événement.
   */
  sample(frame?: number): IFrameSample;
}
