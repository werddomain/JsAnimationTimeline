// demo/runtime/src/main.ts
/**
 * Page de démo du runtime : crée le lecteur sur l'animation écrite à la main
 * et branche les contrôles (lecture, pause, boucle, vitesse, image) et le
 * journal des événements.
 */

import { createPlayer } from '@werddomain/timeline-runtime';
import type { IPlayer, PlayerEventName } from '@werddomain/timeline-runtime';
import { DEMO_ANIMATION } from './animation';
import './demo.less';

/** Event labels shown in the log. */
const EVENT_LABELS: Readonly<Record<Exclude<PlayerEventName, 'frame'>, string>> = {
  play: 'Lecture',
  pause: 'Pause',
  complete: 'Fin de l’animation (complete)',
  loop: 'Retour au début (loop)'
};

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Élément #${id} introuvable dans la page de démo.`);
  }
  return element as T;
}

function logEvent(log: HTMLElement, event: keyof typeof EVENT_LABELS, frame: number): void {
  const item = document.createElement('li');
  item.dataset.event = event;
  item.textContent = `${EVENT_LABELS[event]} — image ${frame}`;
  log.prepend(item);
}

function setUp(): IPlayer {
  const stage = byId<HTMLElement>('stage');
  const playButton = byId<HTMLButtonElement>('play');
  const pauseButton = byId<HTMLButtonElement>('pause');
  const loopInput = byId<HTMLInputElement>('loop');
  const speedSelect = byId<HTMLSelectElement>('speed');
  const seekInput = byId<HTMLInputElement>('seek');
  const frameOutput = byId<HTMLOutputElement>('frame');
  const log = byId<HTMLUListElement>('events');

  const player = createPlayer(DEMO_ANIMATION, { root: stage });
  seekInput.max = String(player.totalFrames);

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
  (Object.keys(EVENT_LABELS) as Array<keyof typeof EVENT_LABELS>).forEach((event) => {
    player.on(event, () => {
      logEvent(log, event, player.frame);
      showState();
    });
  });

  playButton.addEventListener('click', () => player.play());
  pauseButton.addEventListener('click', () => player.pause());
  loopInput.addEventListener('change', () => {
    player.loop = loopInput.checked;
  });
  speedSelect.addEventListener('change', () => {
    player.speed = Number(speedSelect.value);
  });
  seekInput.addEventListener('input', () => player.seek(Number(seekInput.value)));

  showFrame(player.frame);
  showState();
  return player;
}

setUp();
