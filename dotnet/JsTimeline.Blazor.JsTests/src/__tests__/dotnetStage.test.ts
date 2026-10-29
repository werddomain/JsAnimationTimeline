// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/dotnetStage.test.ts
/**
 * Tests of wwwroot/stage/dotnetStage.js through a real player: compact frames sent to .NET, one
 * call in flight with the last frame winning, frame modes, errors to `onListenerError`, released
 * layers and detach.
 */

import { createManualClock, createPlayer } from '@kazo-ca/timeline-runtime';
import type { IPlayer, IStage, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createDotNetStage } from '../../../JsTimeline.Blazor/wwwroot/stage/dotnetStage.js';
import { FakeDotNetReference, flush, HERO_RELEASE, heroDescription, heroDocument, heroStage } from './fakeDotNet';
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
    expect(frame.released).toEqual([HERO_RELEASE]);
    expect(frame.layers).toEqual([]);
  });

  it('on destroy, sends the final releases in one last frame without layers, then nothing', async () => {
    // Arrange
    const errors: unknown[] = [];
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick', (error) => errors.push(error));
    await receiver.resolveAll();
    const before = receiver.calls.length;

    // Act
    player.destroy();
    await receiver.rejectNext(new Error('circuit gone'));
    await flush();

    // Assert
    const sent = receiver.frames.slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0].layers).toEqual([]);
    expect(sent[0].released).toEqual([HERO_RELEASE]);
    expect(errors).toEqual([]);
  });

  it('delivers the last frame after the call in flight when destroyed meanwhile', async () => {
    // Arrange: a call is in flight when the player is destroyed.
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick');
    const before = receiver.calls.length;

    // Act
    player.destroy();
    await receiver.resolveAll();

    // Assert
    const sent = receiver.frames.slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0].released).toEqual([HERO_RELEASE]);
  });

  it('lists a retargeted layer as released with its old target, and in layers with the new one', async () => {
    // Arrange: two objects in the same stage; the layer moves from hero to villain.
    const receiver = new FakeDotNetReference();
    const description = {
      ...heroDescription('everyTick'),
      targets: [
        { ref: 'hero', label: 'Héros', icon: null, group: null, properties: null },
        { ref: 'villain', label: 'Méchant', icon: null, group: null, properties: null }
      ]
    };
    const stage = createDotNetStage(description, receiver) satisfies IStage;
    const player = createPlayer(heroDocument(), { stage, clock: createManualClock() });
    await receiver.resolveAll();
    const retargeted = heroDocument();
    const layer = retargeted.layers[0];
    const moved: ITimelineDocument = { ...retargeted, layers: [{ ...layer, target: { ref: 'villain', stage: 'dotnet' } } as typeof layer] };

    // Act
    player.update(moved);
    await receiver.resolveAll();

    // Assert
    const frame = receiver.frames[receiver.frames.length - 1];
    expect(frame.released).toEqual([HERO_RELEASE]);
    expect(frame.layers.map((l) => l.target)).toEqual([{ ref: 'villain', stage: 'dotnet' }]);
  });

  it('resends the releases of a frame without layers that fails during destroy', async () => {
    // Arrange: the only layer is deleted; the frame telling .NET (no layers, one release) is in flight.
    const errors: unknown[] = [];
    const receiver = new FakeDotNetReference();
    const player = playerWith(receiver, 'everyTick', (error) => errors.push(error));
    await receiver.resolveAll();
    player.update({ ...heroDocument(), layers: [] });
    await flush();
    const inFlight = receiver.frames[receiver.frames.length - 1];

    // Act: destroy (nothing left to release), then the frame in flight fails.
    player.destroy();
    await receiver.rejectNext(new Error('RenderAsync threw'));
    await receiver.resolveAll();

    // Assert: a last frame repeats the release.
    const last = receiver.frames[receiver.frames.length - 1];
    expect(inFlight.layers).toEqual([]);
    expect(inFlight.released).toEqual([HERO_RELEASE]);
    expect(last).not.toBe(inFlight);
    expect(last.released).toEqual([HERO_RELEASE]);
    expect(errors).toEqual([]);
  });

  it('puts the releases of a call failing after destroy into the last frame', async () => {
    // Arrange: the layer moves from hero to villain; the frame telling .NET about hero is in flight
    // when the player is destroyed (which releases the layer from villain).
    const errors: unknown[] = [];
    const receiver = new FakeDotNetReference();
    const description = {
      ...heroDescription('everyTick'),
      targets: [
        { ref: 'hero', label: 'Héros', icon: null, group: null, properties: null },
        { ref: 'villain', label: 'Méchant', icon: null, group: null, properties: null }
      ]
    };
    const stage = createDotNetStage(description, receiver) satisfies IStage;
    const player = createPlayer(heroDocument(), { stage, clock: createManualClock(), onListenerError: (e) => errors.push(e) });
    await receiver.resolveAll();
    const document = heroDocument();
    const layer = document.layers[0];
    player.update({ ...document, layers: [{ ...layer, target: { ref: 'villain', stage: 'dotnet' } } as typeof layer] });
    await flush();

    // Act: destroy, then the frame in flight fails.
    player.destroy();
    await receiver.rejectNext(new Error('RenderAsync threw'));
    await receiver.resolveAll();

    // Assert: the last frame tells .NET about both releases, and nothing is reported.
    const last = receiver.frames[receiver.frames.length - 1];
    expect(last.layers).toEqual([]);
    expect(last.released).toEqual([HERO_RELEASE, { layerId: 'l-hero', target: { ref: 'villain', stage: 'dotnet' } }]);
    expect(errors).toEqual([]);
  });

  it('stop() resolves even when the last frame fails', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const stage = createDotNetStage(heroDescription('everyTick'), receiver) satisfies IStage;
    const player = createPlayer(heroDocument(), { stage, clock: createManualClock() });
    await receiver.resolveAll();
    player.destroy();

    // Act
    const stopping = stage.stop();
    await receiver.rejectNext(new Error('circuit gone'));

    // Assert
    await expect(stopping).resolves.toBeUndefined();
  });

  it('stop() resolves at once after destroy in off mode', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const stage = createDotNetStage(heroDescription('off'), receiver) satisfies IStage;
    const player = createPlayer(heroDocument(), { stage, clock: createManualClock() });
    player.destroy();

    // Act + Assert
    await expect(stage.stop()).resolves.toBeUndefined();
    expect(receiver.calls).toEqual([]);
  });

  it('lists a layer released twice before a frame only once', () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const stage = createDotNetStage(heroDescription('everyTick'), receiver) satisfies IStage;

    // Act
    stage.release('l-hero', 'hero');
    stage.release('l-hero', 'hero');
    stage.render({ timeMs: 0, frame: 1, integerFrame: 1 }, []);

    // Assert
    expect(receiver.frames[0].released).toEqual([HERO_RELEASE]);
  });

  it('stop() after destroy resolves once the last frame is delivered', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const stage = createDotNetStage(heroDescription('everyTick'), receiver) satisfies IStage;
    const player = createPlayer(heroDocument(), { stage, clock: createManualClock() });
    player.destroy();
    let stopped = false;

    // Act
    const stopping = stage.stop().then(() => {
      stopped = true;
    });
    await flush();
    const stoppedEarly = stopped;
    await receiver.resolveAll();
    await stopping;

    // Assert
    expect(stoppedEarly).toBe(false);
    expect(stopped).toBe(true);
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
    expect(released).toEqual([HERO_RELEASE]);
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
    expect(receiver.frames[receiver.frames.length - 1].released).toEqual([HERO_RELEASE]);
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
    expect(sent.released).toEqual([HERO_RELEASE]);
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
    const stage = createDotNetStage({ ...heroDescription('everyTick') }, receiver) satisfies IStage;
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
    const stage = createDotNetStage(heroDescription('everyTick'), receiver) satisfies IStage;
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
