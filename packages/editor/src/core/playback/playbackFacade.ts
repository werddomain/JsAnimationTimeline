// packages/editor/src/core/playback/playbackFacade.ts
/**
 * Façade `IEditorPlayback` donnée aux plugins (`ctx.playback`) et à l'hôte
 * (`editor.playback`) : un objet figé de fermetures, sans référence vers le
 * `PlaybackController` ni le `Transport`. Les actions passent par
 * `assertActive` (erreur après la destruction de l'éditeur) ; les lectures
 * restent permises.
 */

import type { ITransportTime } from '@kazo-ca/timeline-runtime';
import type { PlaybackController } from './PlaybackController';
import type { IEditorPlayback, IFrameSample } from './types';

/** Construit la façade de `controller`, gardée par `assertActive(operation)`. */
export function createPlaybackFacade(
  controller: PlaybackController,
  assertActive: (operation: string) => void
): IEditorPlayback {
  return Object.freeze<IEditorPlayback>({
    get frame(): number {
      return controller.frame;
    },
    get time(): ITransportTime {
      return controller.time;
    },
    get playing(): boolean {
      return controller.playing;
    },
    get fps(): number {
      return controller.fps;
    },
    get totalFrames(): number {
      return controller.totalFrames;
    },
    get loop(): boolean {
      return controller.loop;
    },
    set loop(value: boolean) {
      assertActive('playback.loop');
      controller.loop = value;
    },
    get speed(): number {
      return controller.speed;
    },
    set speed(value: number) {
      assertActive('playback.speed');
      controller.speed = value;
    },
    play: (): void => {
      assertActive('playback.play');
      controller.play();
    },
    pause: (): void => {
      assertActive('playback.pause');
      controller.pause();
    },
    toggle: (): void => {
      assertActive('playback.toggle');
      controller.toggle();
    },
    seek: (frame: number): void => {
      assertActive('playback.seek');
      controller.seek(frame);
    },
    sample: (frame?: number): IFrameSample => {
      assertActive('playback.sample');
      return controller.sample(frame);
    },
    now: (): number => controller.clockNow()
  });
}
