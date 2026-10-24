// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/timelinePlayer.test.ts
/**
 * Tests of Player/TimelinePlayer.razor.js: a stage or listener error goes to .NET (OnPlayerError)
 * and is written to the console when .NET does not handle it or cannot be reached.
 */

import { createTimelinePlayer } from '../../../JsTimeline.Blazor/Player/TimelinePlayer.razor.js';

/** A document without layers: the HTML stage animates nothing, so jsdom needs no Web Animations. */
const EMPTY_DOCUMENT = JSON.stringify({ version: '2.0.0', settings: { fps: 10, totalFrames: 10 }, layers: [] });

/**
 * .NET side whose `OnPlayerEvent` throws synchronously: the player reports that listener error
 * to `onListenerError`, which offers it to `OnPlayerError` answered by `answer`.
 */
function receiver(answer: () => Promise<boolean>) {
  const errors: string[] = [];
  return {
    errors,
    invokeMethodAsync(name: string, ...args: unknown[]): Promise<unknown> {
      if (name === 'OnPlayerEvent') {
        throw new Error('listener failed');
      }
      errors.push(String(args[0]));
      return answer();
    }
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('stage and listener errors of TimelinePlayer.razor.js', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  function playOnce(events: ReturnType<typeof receiver>): void {
    const root = document.createElement('div');
    const options = { autoplay: false, loop: false, speed: 1, notifyFrames: false };
    const player = createTimelinePlayer(root, EMPTY_DOCUMENT, options, events);
    player.play();
    player.destroy();
  }

  it('offers the error to .NET and logs nothing when it is handled', async () => {
    const events = receiver(() => Promise.resolve(true));

    playOnce(events);
    await flush();

    expect(events.errors).toEqual(['listener failed']);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('writes the error to the console when .NET has no OnError handler', async () => {
    const events = receiver(() => Promise.resolve(false));

    playOnce(events);
    await flush();

    expect(consoleError).toHaveBeenCalledWith('TimelinePlayer:', new Error('listener failed'));
  });

  it('writes the error to the console when .NET cannot be reached', async () => {
    const events = receiver(() => Promise.reject(new Error('circuit gone')));

    playOnce(events);
    await flush();

    expect(consoleError).toHaveBeenCalledWith('TimelinePlayer:', new Error('listener failed'));
  });
});
