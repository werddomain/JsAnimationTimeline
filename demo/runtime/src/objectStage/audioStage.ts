// demo/runtime/src/objectStage/audioStage.ts
/**
 * Scène `audio` de la démo : une piste non visuelle dont le volume (propriété
 * `value` de 0 à 1) pilote un GainNode par `setTargetAtTime`. Le graphe audio
 * n'est construit qu'après un geste de l'utilisateur (`AudioTrack.start`) :
 * avant, la scène retient seulement le volume demandé.
 */

import { createObjectStage } from '@werddomain/timeline-runtime';
import type { IObjectStage } from '@werddomain/timeline-runtime';
import { AUDIO_STAGE_ID } from './document';
import { recordFrame } from './received';
import type { IReceivedFrame } from './received';

/** Time constant (seconds) of the volume changes: avoids clicks. */
export const VOLUME_TIME_CONSTANT = 0.02;
const TONE_HZ = 220;

/** The audio track: volume asked by the timeline, graph built on demand. */
export class AudioTrack {
  /** Last volume asked by the timeline (0 when inactive). */
  volume = 0;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;

  get started(): boolean {
    return this.context !== null;
  }

  /** Builds the graph (oscillator, gain, output); call it from a user gesture. */
  async start(): Promise<void> {
    if (this.context === null) {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.value = this.volume;
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = TONE_HZ;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      this.context = context;
      this.gain = gain;
    }
    await this.context.resume();
  }

  /** Remembers `volume` and, once started, moves the gain to it smoothly. */
  setVolume(volume: number): void {
    this.volume = volume;
    if (this.context !== null && this.gain !== null) {
      this.gain.gain.setTargetAtTime(volume, this.context.currentTime, VOLUME_TIME_CONSTANT);
    }
  }

  /** Suspends the sound while the timeline is paused. */
  setPlaying(playing: boolean): void {
    if (this.context === null) {
      return;
    }
    void (playing ? this.context.resume() : this.context.suspend());
  }
}

/** Creates the `audio` stage driving `track`; what it receives goes to `received`. */
export function createAudioStage(track: AudioTrack, received: IReceivedFrame[]): IObjectStage<AudioTrack> {
  return createObjectStage<AudioTrack>({
    id: AUDIO_STAGE_ID,
    properties: [{ name: 'volume', kind: 'value', unit: '', label: 'Volume', group: 'Audio', defaultValue: 1, min: 0, max: 1 }],
    objects: [{ id: 'music', label: 'Musique', icon: 'audio', object: track, properties: ['volume'] }],
    apply(audio, values, state) {
      audio.setVolume(state.active ? values.volume : 0);
    },
    endFrame(time, states) {
      recordFrame(received, time, states);
    },
    sync(_time, state) {
      track.setPlaying(state.playing);
    }
  });
}
