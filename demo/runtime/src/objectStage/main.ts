// demo/runtime/src/objectStage/main.ts
/**
 * Page de démo « scène sans HTML animé » : un sprite canvas et un volume audio
 * (deux `createObjectStage`) animés avec un calque HTML (scène HTML par défaut)
 * par le même lecteur. `?clock=manual` remplace l'horloge du navigateur par
 * une horloge manuelle, pour piloter le temps depuis les tests ; la scène HTML
 * passe alors en mode `frame` pour suivre cette horloge (le mode `waapi`
 * avance seul, en temps réel).
 */

import { buildStageRegistry, createHtmlStage, createManualClock, createPlayer, defaultPropertyRegistry } from '@werddomain/timeline-runtime';
import type { IManualClock, IPlayer, IPlayerOptions } from '@werddomain/timeline-runtime';
import { AudioTrack, createAudioStage } from './audioStage';
import { createCanvasStage, createSprite } from './canvasStage';
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

/** Volume as shown to the user: two decimals, French decimal comma. */
function formatVolume(volume: number): string {
  return volume.toFixed(2).replace('.', ',');
}

/** Creates the stages and the player, and publishes the test hook. */
function createDemo(manual: boolean, clock: IManualClock | null): { player: IPlayer; track: AudioTrack } {
  const canvas = byId<HTMLCanvasElement>('sprite-canvas');
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Le canvas 2D n’est pas disponible.');
  }

  const received: ReceivedLog = { [CANVAS_STAGE_ID]: [], [AUDIO_STAGE_ID]: [] };
  const track = new AudioTrack();
  const hero = createSprite();
  const canvasStage = createCanvasStage(context, received[CANVAS_STAGE_ID], hero);
  const audioStage = createAudioStage(track, received[AUDIO_STAGE_ID]);
  const htmlStage = createHtmlStage({ root: byId('html-zone'), mode: manual ? 'frame' : 'waapi' });

  const options: IPlayerOptions = { stage: [canvasStage, audioStage, htmlStage] };
  const player = createPlayer(OBJECT_STAGE_DOCUMENT, clock === null ? options : { ...options, clock });
  const registry = buildStageRegistry(defaultPropertyRegistry, [canvasStage, audioStage]);
  window.__objectStageDemo = createDemoHook(player, clock, OBJECT_STAGE_DOCUMENT, received, registry, hero, track);
  return { player, track };
}

/** Wires the transport controls and the displays that follow the player. */
function bindControls(player: IPlayer, track: AudioTrack, clock: IManualClock | null): void {
  const playButton = byId<HTMLButtonElement>('play');
  const pauseButton = byId<HTMLButtonElement>('pause');
  const stepButton = byId<HTMLButtonElement>('step');
  const loopInput = byId<HTMLInputElement>('loop');
  const volumeOutput = byId<HTMLOutputElement>('volume');
  const seekInput = byId<HTMLInputElement>('seek');
  const frameOutput = byId<HTMLOutputElement>('frame');

  seekInput.max = String(player.totalFrames);
  byId('clock-mode').textContent =
    clock !== null
      ? 'Horloge manuelle : le temps n’avance que par « Avancer d’une image ».'
      : 'Horloge du navigateur : appuyez sur « Lecture ».';
  stepButton.hidden = clock === null;
  // The browser may restore the form state: the checkbox, not the player default, is the truth.
  player.loop = loopInput.checked;

  const showFrame = (frame: number): void => {
    frameOutput.value = `Image ${frame} / ${player.totalFrames}`;
    seekInput.value = String(frame);
  };
  const showState = (): void => {
    playButton.disabled = player.playing;
    pauseButton.disabled = !player.playing;
    document.body.dataset.playing = String(player.playing);
    showSound(player, track);
  };
  const showVolume = (volume: number): void => {
    const text = formatVolume(volume);
    if (volumeOutput.value !== text) {
      volumeOutput.value = text;
    }
  };
  track.onVolume = showVolume;
  showVolume(track.volume);

  player.on('frame', ({ frame }) => showFrame(frame));
  (['play', 'pause', 'complete', 'loop'] as const).forEach((event) => player.on(event, showState));

  playButton.addEventListener('click', () => player.play());
  pauseButton.addEventListener('click', () => player.pause());
  stepButton.addEventListener('click', () => {
    player.play();
    clock?.advance(1000 / player.fps);
    player.pause();
  });
  loopInput.addEventListener('change', () => {
    player.loop = loopInput.checked;
  });
  seekInput.addEventListener('input', () => player.seek(Number(seekInput.value)));

  showFrame(player.frame);
  showState();
}

/** Shows whether the sound is on, once the audio track has started. */
function showSound(player: IPlayer, track: AudioTrack): void {
  if (!track.started) {
    return;
  }
  byId<HTMLElement>('sound-state').textContent = player.playing
    ? 'Son activé : le volume suit la piste « Musique ».'
    : 'Son activé : appuyez sur Lecture pour l’entendre';
}

/** Wires the « Activer le son » button. */
function bindAudio(player: IPlayer, track: AudioTrack): void {
  const soundButton = byId<HTMLButtonElement>('sound');
  const soundState = byId<HTMLElement>('sound-state');
  soundButton.addEventListener('click', () => {
    track.start().then(
      () => {
        showSound(player, track);
        soundButton.disabled = true;
      },
      () => {
        soundState.textContent = 'Le son n’a pas pu être activé.';
      }
    );
  });
}

/** Ties the tone and the player to the page lifecycle. */
function bindLifecycle(player: IPlayer, track: AudioTrack): void {
  // The tone must not outlive the rendering: a hidden page stops drawing frames.
  document.addEventListener('visibilitychange', () => track.setVisible(!document.hidden));
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) {
      // Kept in the back/forward cache: the player stays usable after a restore.
      track.setVisible(false);
      return;
    }
    player.destroy();
    track.dispose();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      track.setVisible(!document.hidden);
    }
  });
}

function setUp(): void {
  const manual = new URLSearchParams(window.location.search).get('clock') === 'manual';
  const clock: IManualClock | null = manual ? createManualClock() : null;
  const { player, track } = createDemo(manual, clock);
  bindControls(player, track, clock);
  bindAudio(player, track);
  bindLifecycle(player, track);
}

setUp();
