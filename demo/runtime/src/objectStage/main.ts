// demo/runtime/src/objectStage/main.ts
/**
 * Page de démo « scène sans HTML animé » : un sprite canvas et un volume audio
 * (deux `createObjectStage`) animés avec un calque HTML (scène HTML par défaut)
 * par le même lecteur. `?clock=manual` remplace l'horloge du navigateur par
 * une horloge manuelle, pour piloter le temps depuis les tests.
 */

import { buildStageRegistry, createHtmlStage, createManualClock, createPlayer, defaultPropertyRegistry } from '@werddomain/timeline-runtime';
import type { IManualClock, IPlayerOptions } from '@werddomain/timeline-runtime';
import { AudioTrack, createAudioStage } from './audioStage';
import { createCanvasStage } from './canvasStage';
import { AUDIO_STAGE_ID, CANVAS_STAGE_ID, OBJECT_STAGE_DOCUMENT } from './document';
import { createDemoHook } from './hook';
import type { ReceivedLog } from './received';
import './object-stage.less';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Élément #${id} introuvable dans la page de démo.`);
  }
  return element as T;
}

function setUp(): void {
  const manual = new URLSearchParams(window.location.search).get('clock') === 'manual';
  const clock: IManualClock | null = manual ? createManualClock() : null;
  const canvas = byId<HTMLCanvasElement>('sprite-canvas');
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Le canvas 2D n’est pas disponible.');
  }

  const received: ReceivedLog = { [CANVAS_STAGE_ID]: [], [AUDIO_STAGE_ID]: [] };
  const track = new AudioTrack();
  const canvasStage = createCanvasStage(context, received[CANVAS_STAGE_ID]);
  const audioStage = createAudioStage(track, received[AUDIO_STAGE_ID]);
  const htmlStage = createHtmlStage({ root: byId('html-zone'), mode: 'waapi' });

  const options: IPlayerOptions = { stage: [canvasStage, audioStage, htmlStage] };
  const player = createPlayer(OBJECT_STAGE_DOCUMENT, clock === null ? options : { ...options, clock });
  const registry = buildStageRegistry(defaultPropertyRegistry, [canvasStage, audioStage]);
  window.__objectStageDemo = createDemoHook(player, clock, OBJECT_STAGE_DOCUMENT, received, registry);

  const playButton = byId<HTMLButtonElement>('play');
  const pauseButton = byId<HTMLButtonElement>('pause');
  const stepButton = byId<HTMLButtonElement>('step');
  const soundButton = byId<HTMLButtonElement>('sound');
  const seekInput = byId<HTMLInputElement>('seek');
  const frameOutput = byId<HTMLOutputElement>('frame');
  const soundState = byId<HTMLElement>('sound-state');

  seekInput.max = String(player.totalFrames);
  byId('clock-mode').textContent = manual
    ? 'Horloge manuelle : le temps n’avance que par « Avancer d’une image ».'
    : 'Horloge du navigateur : appuyez sur « Lecture ».';
  stepButton.hidden = !manual;

  const showFrame = (frame: number): void => {
    frameOutput.value = `Image ${frame} / ${player.totalFrames}`;
    seekInput.value = String(frame);
  };
  const showState = (): void => {
    playButton.disabled = player.playing;
    pauseButton.disabled = !player.playing;
    document.body.dataset.playing = String(player.playing);
  };

  player.on('frame', ({ frame }) => showFrame(frame));
  (['play', 'pause', 'complete', 'loop'] as const).forEach((event) => player.on(event, showState));

  playButton.addEventListener('click', () => player.play());
  pauseButton.addEventListener('click', () => player.pause());
  stepButton.addEventListener('click', () => {
    player.play();
    clock?.advance(1000 / player.fps);
    player.pause();
  });
  seekInput.addEventListener('input', () => player.seek(Number(seekInput.value)));
  soundButton.addEventListener('click', () => {
    track.start().then(
      () => {
        soundState.textContent = 'Son activé : le volume suit la piste « Musique ».';
        soundButton.disabled = true;
      },
      () => {
        soundState.textContent = 'Le son n’a pas pu être activé.';
      }
    );
  });

  showFrame(player.frame);
  showState();
}

setUp();
