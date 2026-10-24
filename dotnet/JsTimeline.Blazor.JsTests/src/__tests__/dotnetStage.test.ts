// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/dotnetStage.test.ts
/**
 * Tests of wwwroot/stage/dotnetStage.js through a real player: compact frames sent to .NET, one
 * call in flight with the last frame winning, frame modes, errors to `onListenerError`, released
 * layers and detach.
 */

import { createManualClock, createPlayer } from '@werddomain/timeline-runtime';
import type { IPlayer, IStage, ITimelineDocument } from '@werddomain/timeline-runtime';
import { createDotNetStage } from '../../../JsTimeline.Blazor/wwwroot/stage/dotnetStage.js';
import { FakeDotNetReference, flush, heroDescription, heroDocument, heroStage } from './fakeDotNet';
import type { FrameMode } from './fakeDotNet';

function playerWith(receiver: FakeDotNetReference, mode?: FrameMode, onListenerError?: (error: unknown) => void): IPlayer {
  return createPlayer(heroDocument(), { stage: heroStage(receiver, mode), clock: createManualClock(), onListenerError });
}

describe('frames sent to .NET', () => {
  it('sends the compact state of each layer, values completed with the defaults', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver);
    await receiver.resolveAll();

    // Act
    player.seek(5);
    await flush();

    // Assert
    const frame = receiver.frames[receiver.frames.length - 1];
    expect(receiver.calls.every((call) => call.method === 'RenderAsync')).toBe(true);
    expect(frame).toEqual({
      released: [],
      timeMs: 400,
      frame: 5,
      integerFrame: 5,
      layers: [{
        layerId: 'l-hero',
        target: { ref: 'hero', stage: 'dotnet' },
        values: { x: 40, frameIndex: 4, volume: 1 },
        active: true,
        visible: true
      }]
    });
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame);
  });

  it('applies the interpolation named by .NET (floor) to its property', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick');
    await receiver.resolveAll();

    // Act
    player.seek(3.5);
    await flush();

    // Assert
    const values = receiver.frames[receiver.frames.length - 1].layers[0].values;
    expect(values.frameIndex).toBe(Math.floor(values.x / 10));
  });

  it('keeps one call in flight and sends only the newest frame after it', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver);
    await receiver.resolveAll();
    const before = receiver.calls.length;

    // Act
    player.seek(2);
    player.seek(3);
    player.seek(4);
    await flush();
    const whileBusy = receiver.calls.length - before;
    await receiver.resolveNext();

    // Assert
    expect(whileBusy).toBe(1);
    expect(receiver.calls.length - before).toBe(2);
    expect(receiver.frames[receiver.frames.length - 1].integerFrame).toBe(4);
  });
});

describe('frame modes', () => {
  /** Plays four ticks of 30 ms at 10 fps: three inside frame 1, then one in frame 2. */
  async function framesWhilePlaying(mode: FrameMode): Promise<number[]> {
    const receiver = new FakeDotNetReference();
    const clock = createManualClock();
    const player = createPlayer(heroDocument(), { stage: heroStage(receiver, mode), clock });
    await receiver.resolveAll();
    const before = receiver.calls.length;
    player.play();
    for (let tick = 0; tick < 4; tick++) {
      clock.advance(30);
      await receiver.resolveAll();
    }
    return receiver.frames.slice(before).map((frame) => frame.integerFrame);
  }

  it('integerFrames sends once per displayed frame while playing', async () => {
    const frames = await framesWhilePlaying('integerFrames');

    expect(frames).toEqual([1, 2]);
  });

  it('everyTick sends every rendered tick', async () => {
    const frames = await framesWhilePlaying('everyTick');

    expect(frames.length).toBeGreaterThanOrEqual(4);
    expect(frames[frames.length - 1]).toBe(2);
  });

  it('off sends nothing', async () => {
    const frames = await framesWhilePlaying('off');

    expect(frames).toEqual([]);
  });

  it('integerFrames sends again at the same frame when the document changes', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver);
    await receiver.resolveAll();
    const before = receiver.calls.length;

    // Act
    player.update({ ...heroDocument(), settings: { fps: 10, totalFrames: 12 } });
    await receiver.resolveAll();

    // Assert
    expect(receiver.frames.slice(before).map((frame) => frame.integerFrame)).toEqual([1]);
  });
});

describe('errors, released layers and detach', () => {
  it('reports a failed call to onListenerError and keeps sending', async () => {
    // Arrange
    const errors: unknown[] = [];
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'integerFrames', (error) => errors.push(error));
    const failure = new Error('RenderAsync threw');

    // Act
    await receiver.rejectNext(failure);
    player.seek(6);
    await flush();

    // Assert
    expect(errors).toContain(failure);
    expect(receiver.frames[receiver.frames.length - 1].integerFrame).toBe(6);
  });

  it('lists a removed layer in the next frame', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver);
    await receiver.resolveAll();
    const empty: ITimelineDocument = { ...heroDocument(), layers: [] };

    // Act
    player.update(empty);
    await flush();

    // Assert
    const frame = receiver.frames[receiver.frames.length - 1];
    expect(frame.released).toEqual(['l-hero']);
    expect(frame.layers).toEqual([]);
  });

  it('sends nothing after destroy, and a late failure is not reported', async () => {
    // Arrange
    const errors: unknown[] = [];
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick', (error) => errors.push(error));
    player.seek(4);
    const sent = receiver.calls.length;

    // Act
    player.destroy();
    await receiver.rejectNext(new Error('circuit gone'));
    await flush();

    // Assert
    expect(receiver.calls.length).toBe(sent);
    expect(errors).toEqual([]);
  });
});

describe('review cases: no lost released ids, no stuck pump', () => {
  it('carries released ids over when a waiting frame is replaced', async () => {
    // Arrange: a call is in flight.
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick');
    const empty: ITimelineDocument = { ...heroDocument(), layers: [] };

    // Act: the layer goes away, then a newer frame replaces the waiting one.
    player.update(empty);
    player.seek(4);
    await receiver.resolveAll();

    // Assert
    const released = receiver.frames.flatMap((frame) => frame.released);
    expect(released).toEqual(['l-hero']);
  });

  it('sends released ids again after a failed call', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick', () => undefined);
    await receiver.resolveAll();
    player.update({ ...heroDocument(), layers: [] });
    await flush();

    // Act
    await receiver.rejectNext(new Error('RenderAsync threw'));
    player.seek(3);
    await flush();

    // Assert
    expect(receiver.frames[receiver.frames.length - 1].released).toEqual(['l-hero']);
  });

  it('moves the ids of a failed call to the frame already waiting', async () => {
    // Arrange: the call carrying the release is in flight and a newer frame waits.
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick', () => undefined);
    await receiver.resolveAll();
    player.update({ ...heroDocument(), layers: [] });
    await flush();
    player.seek(4);

    // Act
    await receiver.rejectNext(new Error('RenderAsync threw'));

    // Assert
    const sent = receiver.frames[receiver.frames.length - 1];
    expect(sent.integerFrame).toBe(4);
    expect(sent.released).toEqual(['l-hero']);
  });

  it('keeps sending when the receiver throws instead of rejecting', async () => {
    // Arrange
    const errors: unknown[] = [];
    let calls = 0;
    const receiver = {
      invokeMethodAsync(): Promise<void> {
        calls++;
        if (calls === 1) throw new Error('no tracked object');
        return Promise.resolve();
      }
    };
    const stage = createDotNetStage({ ...heroDescription('everyTick') }, receiver) as IStage;
    const player = createPlayer(heroDocument(), { stage, clock: createManualClock(), onListenerError: (e) => errors.push(e) });
    await flush();

    // Act
    player.seek(5);
    await flush();

    // Assert
    expect(errors).toEqual([new Error('no tracked object')]);
    expect(calls).toBe(2);
  });

  it('integerFrames sends again after a seek to the same frame', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver);
    player.seek(5);
    await receiver.resolveAll();
    const before = receiver.calls.length;

    // Act
    player.seek(5);
    await receiver.resolveAll();

    // Assert
    expect(receiver.calls.length - before).toBe(1);
  });

  it('stop() ends the frames before the .NET receiver goes away', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const stage = heroStage(receiver, 'everyTick') as IStage & { stop(): void };
    const player = createPlayer(heroDocument(), { stage, clock: createManualClock() });
    await receiver.resolveAll();
    const before = receiver.calls.length;

    // Act
    stage.stop();
    player.seek(7);
    await flush();

    // Assert
    expect(receiver.calls.length).toBe(before);
  });

  it('leaves out values that JSON cannot carry', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const stage = heroStage(receiver, 'everyTick');
    const states = [{ layerId: 'l', target: { ref: 'hero' }, object: 'hero', values: { x: Number.NaN, y: 2 }, active: true, editorVisible: true }];

    // Act
    stage.render?.({ timeMs: 0, frame: 1, integerFrame: 1 }, states);
    await flush();

    // Assert
    expect(receiver.frames[0].layers[0].values).toEqual(expect.not.objectContaining({ x: expect.anything() }));
    expect(receiver.frames[0].layers[0].values.y).toBe(2);
  });
});

describe('description checks', () => {
  const base = { id: 'dotnet', targets: [], properties: [] };

  it('refuses an unknown frame mode', () => {
    expect(() => createDotNetStage({ ...base, mode: 'sometimes' }, new FakeDotNetReference())).toThrow('unknown frame mode');
  });

  it('refuses an unknown interpolation name', () => {
    const properties = [{ name: 'volume', defaultValue: 0, interpolation: 'cubic', unit: '' }];
    expect(() => createDotNetStage({ ...base, mode: 'off', properties }, new FakeDotNetReference())).toThrow(
      'unknown interpolation "cubic"'
    );
  });

  it('offers the .NET targets to the target picker', () => {
    const stage = heroStage(new FakeDotNetReference());

    expect(stage.targets?.list()).toEqual([{ target: { ref: 'hero', stage: 'dotnet' }, label: 'Héros' }]);
  });
});
