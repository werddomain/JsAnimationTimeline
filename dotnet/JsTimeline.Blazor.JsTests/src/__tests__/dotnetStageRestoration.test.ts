// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/dotnetStageRestoration.test.ts
import { createManualClock, createPlayer } from '@kazo-ca/timeline-runtime';
import type { IPropertyTimeline, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createDotNetStage } from '../../../JsTimeline.Blazor/wwwroot/stage/dotnetStage.js';
import { FakeDotNetReference, heroDescription } from './fakeDotNet';

const tracks: Readonly<Record<string, IPropertyTimeline>> = {
  caption: { initialValue: { kind: 'text', value: 'Before' }, keys: [{ frame: 1, value: { kind: 'text', value: 'After' } }] },
  enabled: { initialValue: { kind: 'boolean', value: false }, keys: [{ frame: 1, value: { kind: 'boolean', value: true } }] },
  score: { initialValue: { kind: 'number', value: 2 }, keys: [{ frame: 1, value: { kind: 'number', value: 9 } }] },
  color: { initialValue: { kind: 'color', r: 0, g: 0, b: 1, a: 1 }, keys: [{ frame: 1, value: { kind: 'color', r: 1, g: 0, b: 0, a: 1 } }] }
};

function document(propertyTimelines = tracks, ref = 'hero'): ITimelineDocument {
  return {
    version: '2.0.0', settings: { fps: 24, totalFrames: 10 },
    layers: [{ id: 'layer', type: 'layer', name: 'Object', spans: [], target: { ref, stage: 'dotnet' }, propertyTimelines }]
  };
}

function setup() {
  const receiver = new FakeDotNetReference();
  const description = {
    ...heroDescription('everyTick'), properties: [],
    targets: ['hero', 'villain'].map((ref) => ({ ref, label: ref, icon: null, group: null, properties: null }))
  };
  const stage = createDotNetStage(description, receiver);
  const player = createPlayer(document(), { stage, clock: createManualClock(), onListenerError: () => undefined });
  const latest = () => receiver.frames[receiver.frames.length - 1];
  return { receiver, player, latest };
}

describe('typed property restoration through the real .NET bridge', () => {
  it('sends the original values when tracks are removed and supports undo by reloading the previous document', async () => {
    const { receiver, player, latest } = setup();
    await receiver.resolveAll();
    expect(latest().layers[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'After' });

    player.update(document({}));
    await receiver.resolveAll();

    expect(latest().layers[0].propertyValues).toEqual(Object.fromEntries(Object.entries(tracks).map(([name, track]) => [name, track.initialValue])));
    expect(latest().layers[0].values).toEqual({ score: 2 });
    player.update(document());
    await receiver.resolveAll();
    expect(latest().layers[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'After' });
    player.update(document({}));
    await receiver.resolveAll();
    expect(latest().layers[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'Before' });
    player.seek(3);
    await receiver.resolveAll();
    expect(latest().layers[0].propertyValues).not.toHaveProperty('caption');
  });

  it('carries restorations when a pending frame is replaced by a newer frame', async () => {
    const { receiver, player, latest } = setup();
    player.update(document({}));
    player.seek(4);
    await receiver.resolveAll();

    expect(latest().integerFrame).toBe(4);
    expect(latest().layers[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'Before' });
    expect(latest().layers[0].values.score).toBe(2);
    player.seek(5);
    await receiver.resolveAll();
    expect(latest().layers[0].propertyValues).not.toHaveProperty('caption');
  });

  it('lets the current animation override restoration when undo replaces a pending frame', async () => {
    const { receiver, player, latest } = setup();
    player.update(document({}));
    player.update(document());
    await receiver.resolveAll();

    expect(latest().layers[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'After' });
    expect(latest().layers[0].propertyValues?.score).toEqual({ kind: 'number', value: 9 });
    expect(latest().layers[0].values.score).toBe(9);
  });

  it('removes an obsolete numeric projection when a newer typed property becomes text', async () => {
    const { receiver, player, latest } = setup();
    player.update(document({}));
    player.update(document({ score: {
      initialValue: { kind: 'text', value: 'Base' }, keys: [{ frame: 1, value: { kind: 'text', value: 'New' } }]
    } }));
    await receiver.resolveAll();

    expect(latest().layers[0].propertyValues?.score).toEqual({ kind: 'text', value: 'New' });
    expect(latest().layers[0].values).not.toHaveProperty('score');
  });

  it('does not restore an old target onto a retargeted layer', async () => {
    const { receiver, player, latest } = setup();
    player.update(document({}));
    player.update(document({}, 'villain'));
    await receiver.resolveAll();

    expect(latest().released).toEqual([{ layerId: 'layer', target: { ref: 'hero', stage: 'dotnet' } }]);
    expect(latest().layers[0].target).toEqual({ ref: 'villain', stage: 'dotnet' });
    expect(latest().layers[0].propertyValues).not.toHaveProperty('caption');
    expect(latest().layers[0].values).not.toHaveProperty('score');
  });

  it('drops queued property restorations when the layer is released during destruction', async () => {
    const { receiver, player, latest } = setup();
    player.update(document({}));
    player.destroy();
    await receiver.resolveAll();

    expect(latest().layers).toEqual([]);
    expect(latest().released).toEqual([{ layerId: 'layer', target: { ref: 'hero', stage: 'dotnet' } }]);
  });

  it('retries an undelivered restoration with the next rendered frame', async () => {
    const { receiver, player, latest } = setup();
    await receiver.resolveAll();
    player.update(document({}));
    await receiver.rejectNext(new Error('RenderAsync failed'));
    player.seek(6);
    await receiver.resolveAll();

    expect(latest().integerFrame).toBe(6);
    expect(latest().layers[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'Before' });
  });

  it('retries an undelivered restoration with the frame already pending', async () => {
    const { receiver, player, latest } = setup();
    await receiver.resolveAll();
    player.update(document({}));
    player.seek(7);
    await receiver.rejectNext(new Error('RenderAsync failed'));
    await receiver.resolveAll();

    expect(latest().integerFrame).toBe(7);
    expect(latest().layers[0].propertyValues?.caption).toEqual({ kind: 'text', value: 'Before' });
  });

  it('does not retry an old restoration after the target is released and rebound under the same name', async () => {
    const { receiver, player, latest } = setup();
    await receiver.resolveAll();
    player.update(document({}));
    player.update({ ...document({}), layers: [] });
    player.update(document({}));
    await receiver.rejectNext(new Error('RenderAsync failed'));
    await receiver.resolveAll();

    expect(latest().released).toEqual([{ layerId: 'layer', target: { ref: 'hero', stage: 'dotnet' } }]);
    expect(latest().layers[0].propertyValues).not.toHaveProperty('caption');
  });
});
