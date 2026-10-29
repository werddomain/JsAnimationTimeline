// demo/runtime/src/objectStage/audioStage.ts
/**
 * Scène `audio` de la démo : une piste non visuelle dont le volume (propriété
 * `value` de 0 à 1) pilote un GainNode par `setTargetAtTime`. Le graphe audio
 * n'est construit qu'après un geste de l'utilisateur (`AudioTrack.start`) :
 * avant, la scène retient seulement le volume demandé. Le contexte ne tourne
 * que si la timeline joue et que la page est visible.
 */

import { createObjectStage } from '@kazo-ca/timeline-runtime';
import type { IObjectStage } from '@kazo-ca/timeline-runtime';
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
  /** Called with each volume the timeline asks for (e.g. a readout). */
  onVolume: ((volume: number) => void) | null = null;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private oscillator: OscillatorNode | null = null;
  /** Whether the timeline is playing; the context only runs while it is. */
  private playing = false;
  /** Whether the page is visible; a hidden page stops rendering, so the tone must stop too. */
  private visible = true;
  /** Resume/suspend calls run one after the other, so a fast play/pause cannot race. */
  private queue: Promise<void> = Promise.resolve();

  get started(): boolean {
    return this.context !== null;
  }

  /**
   * Builds the graph (oscillator, gain, output); call it from a user gesture.
   * The context runs only if the timeline is playing, else it stays suspended.
   */
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
      this.oscillator = oscillator;
    }
    await this.enqueuePlayState();
  }

  /** Remembers `volume` and, once started, moves the gain to it smoothly. */
  setVolume(volume: number): void {
    this.volume = volume;
    this.onVolume?.(volume);
    if (this.context !== null && this.gain !== null) {
      this.gain.gain.setTargetAtTime(volume, this.context.currentTime, VOLUME_TIME_CONSTANT);
    }
  }

  /** Runs the sound while the timeline plays and suspends it otherwise. */
  setPlaying(playing: boolean): void {
    this.playing = playing;
    void this.enqueuePlayState();
  }

  /** Suspends the sound while the page is hidden; resumes it only if the timeline is playing. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    void this.enqueuePlayState();
  }

  /** Stops the oscillator and closes the context; the track cannot be started again. */
  dispose(): void {
    const { context, oscillator } = this;
    this.context = null;
    this.gain = null;
    this.oscillator = null;
    oscillator?.stop();
    if (context !== null && context.state !== 'closed') {
      context.close().catch(() => undefined);
    }
  }

  private enqueuePlayState(): Promise<void> {
    this.queue = this.queue.then(() => this.applyPlayState()).catch(() => undefined);
    return this.queue;
  }

  private async applyPlayState(): Promise<void> {
    const context = this.context;
    if (context === null || context.state === 'closed') {
      return;
    }
    const shouldRun = this.playing && this.visible;
    if (shouldRun && context.state !== 'running') {
      await context.resume();
    } else if (!shouldRun && context.state === 'running') {
      await context.suspend();
    }
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
