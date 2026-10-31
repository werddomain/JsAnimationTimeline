// packages/runtime/src/playback/createPlaybackPlayer.ts
import type { IPlaybackDocument, IPlaybackPlayer, IPlaybackPlayerOptions } from './types';
import type { ITransportTime, TransportEventName, TransportListener } from '../transport/types';
import { createTransport } from '../transport/Transport';
import { parsePlayback } from './parsePlayback';
import { samplePlayback } from './samplePlayback';

/** Read-only, frame-sampled playback on the existing generic transport. */
export function createPlaybackPlayer(data: IPlaybackDocument, options: IPlaybackPlayerOptions): IPlaybackPlayer {
  const document = parsePlayback(data);
  if (options.clock === undefined || ['now', 'requestFrame', 'cancelFrame'].some((name) => typeof Reflect.get(options.clock, name) !== 'function')) {
    throw new TypeError('Le lecteur générique exige une horloge explicite.');
  }
  if (options.loop !== undefined && typeof options.loop !== 'boolean') throw new TypeError('La boucle doit être booléenne.');
  const onListenerError = options.onListenerError ?? ((error: unknown): void => { setTimeout(() => { throw error; }, 0); });
  const transport = createTransport({ fps: document.fps, totalFrames: document.totalFrames, clock: options.clock,
    speed: options.speed, loop: options.loop, onListenerError });
  let destroyed = false;
  let renderedFrame = 1;
  const assertAlive = (): void => { if (destroyed) throw new Error('Le lecteur de données compilées est détruit.'); };
  const render = (time: ITransportTime): void => {
    renderedFrame = time.integerFrame;
    options.render?.(samplePlayback(document, time.integerFrame), { ...time });
  };
  const renderIfChanged = (): void => { if (!destroyed && transport.frame !== renderedFrame) render(transport.time); };
  // Subscribe before exposing the player, so every public tick observes the rendered snapshot.
  transport.on('tick', render);
  // Transport events occur after scheduling/cancellation, so a render callback can safely destroy the player.
  for (const event of ['play', 'pause', 'loop'] as const) transport.on(event, renderIfChanged);
  try { render(transport.time); }
  catch (error) { transport.destroy(); throw error; }
  return {
    get fps() { return transport.fps; },
    get totalFrames() { return transport.totalFrames; },
    get duration() { return transport.duration; },
    get timeMs() { return transport.timeMs; },
    get time() { return transport.time; },
    get frame() { return transport.frame; },
    get playing() { return transport.playing; },
    get speed() { return transport.speed; },
    set speed(value: number) {
      transport.speed = value;
      try { renderIfChanged(); } catch (error) { onListenerError(error); }
    },
    get loop() { return transport.loop; },
    set loop(value: boolean) {
      if (typeof value !== 'boolean') throw new TypeError('La boucle doit être booléenne.');
      transport.loop = value;
    },
    play: () => transport.play(),
    pause: () => transport.pause(),
    seek: (frame) => transport.seek(frame),
    sample: (frame = transport.frame) => { assertAlive(); return samplePlayback(document, frame); },
    on: <K extends TransportEventName>(event: K, listener: TransportListener<K>) => transport.on(event, listener),
    off: <K extends TransportEventName>(event: K, listener: TransportListener<K>) => transport.off(event, listener),
    destroy: () => { if (!destroyed) { destroyed = true; transport.destroy(); } }
  };
}
