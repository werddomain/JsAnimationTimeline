// dotnet/JsTimeline.Blazor/Player/TimelinePlayer.razor.js
// Collocated module of TimelinePlayer: wraps createPlayer of the runtime build for .NET interop.
// Served at _content/JsTimeline.Blazor/Player/TimelinePlayer.razor.js, next to js/timeline-runtime.mjs.
import { createPlayer } from '../js/timeline-runtime.mjs';

/** Player events forwarded to .NET; `frame` only when the component listens to it. */
const STATE_EVENTS = ['play', 'pause', 'complete', 'loop'];

/** A stage warning without its thrown value, which cannot cross to .NET. */
const toWarning = (report) => ({
  code: report.code,
  message: report.message,
  stageId: report.stageId ?? null,
  layerId: report.layerId ?? null,
  property: report.property ?? null,
});

/**
 * Creates a player animating the elements under `root`.
 * @param {Element} root Element where the layer selectors are resolved.
 * @param {string} documentJson Timeline document, serialized by TimelineJson.
 * @param {{ autoplay: boolean, loop: boolean, speed: number, notifyFrames: boolean }} options
 * @param {{ invokeMethodAsync(name: string, ...args: unknown[]): Promise<unknown> }} events .NET receiver.
 */
export function createTimelinePlayer(root, documentJson, options, events) {
  let destroyed = false;
  // Stage and listener errors (playback goes on): to OnError when .NET handles them, otherwise to
  // the console. Asked on every error, since the handler may be set or removed after creation.
  const onListenerError = (error) => {
    if (destroyed) return;
    const message = error instanceof Error ? error.message : String(error);
    events
      .invokeMethodAsync('OnPlayerError', message)
      .then((handled) => {
        if (!handled) console.error('TimelinePlayer:', error);
      })
      .catch(() => console.error('TimelinePlayer:', error));
  };
  const player = createPlayer(JSON.parse(documentJson), { root, loop: options.loop, speed: options.speed, onListenerError });

  const notify = (name, frame) => {
    if (destroyed) return;
    // Handler errors are reported on the .NET side; a failure here means .NET is gone (closed
    // circuit, disposed component): nothing is left to notify.
    events.invokeMethodAsync('OnPlayerEvent', name, frame).catch((error) => console.debug('TimelinePlayer:', error));
  };

  const unsubscribers = STATE_EVENTS.map((name) => player.on(name, () => notify(name, player.frame)));
  if (options.notifyFrames) {
    unsubscribers.push(player.on('frame', (event) => notify('frame', event.frame)));
  }
  if (options.autoplay) {
    try {
      player.play();
    } catch (error) {
      // No handle reaches .NET in that case: remove the animations before failing.
      destroyed = true;
      unsubscribers.forEach((off) => off());
      player.destroy();
      throw error;
    }
  }

  return {
    play: () => player.play(),
    pause: () => player.pause(),
    seek: (frame) => player.seek(frame),
    update: (json) => player.update(JSON.parse(json)),
    refreshTargets: (layerId) => player.refreshTargets(layerId ?? undefined),
    setLoop: (loop) => {
      player.loop = loop;
    },
    setSpeed: (speed) => {
      player.speed = speed;
    },
    getState: () => ({
      frame: player.frame,
      playing: player.playing,
      totalFrames: player.totalFrames,
      fps: player.fps,
      duration: player.duration,
      missingTargets: [...player.missingTargets],
      warnings: player.warnings.map(toWarning),
    }),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      unsubscribers.forEach((off) => off());
      player.destroy();
    },
  };
}
