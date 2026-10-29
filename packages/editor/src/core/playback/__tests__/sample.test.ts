// packages/editor/src/core/playback/__tests__/sample.test.ts
/**
 * Tests de `editor.sample()` / `ctx.playback.sample()` et du `FrameSampler` :
 * calques dans l'ordre d'affichage (dossiers exclus), cible telle qu'écrite,
 * `active` faux dans une plage vide, œil résolu avec les dossiers parents,
 * image fractionnaire et bornée, piste inconnue sautée, échantillon figé,
 * cache par document, et aucun événement émis.
 */

import { createPropertyRegistry, evaluateLayer, isLayer } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import { captureContext, cleanBody } from '../../editor/__tests__/fixtures';
import { FrameSampler } from '../FrameSampler';
import { DISPLAY_FRAME_MS, createAnimatedDocument, createPlaybackEditor, recordRenders } from './fixtures';

afterEach(cleanBody);

describe('editor.sample', () => {
  it('returns every layer in display order with its target, values and flags', () => {
    // Arrange
    const { editor } = createPlaybackEditor();

    // Act
    const sample = editor.sample(2);

    // Assert
    expect(sample.time).toEqual({ timeMs: 100, frame: 2, integerFrame: 2 });
    expect(sample.layers.map((layer) => layer.layerId)).toEqual(['hero', 'tree', 'ghost']);
    expect(sample.layer('hero')).toEqual({
      layerId: 'hero', target: { selector: '#hero' }, values: { x: 10 },
      spanId: 's-hero', active: true, editorVisible: true
    });
    expect(sample.layer('tree')).toMatchObject({ target: { ref: 'tree', stage: 'canvas' }, editorVisible: false });
    expect(sample.layer('ghost')).toMatchObject({ target: undefined, spanId: 's-blank', active: false });
    expect(sample.layer('folder')).toBeUndefined();
  });

  it('defaults to the current position and accepts a fractional frame', () => {
    // Arrange
    const { editor } = createPlaybackEditor();
    editor.playback.seek(4);

    // Act
    const current = editor.sample();
    const between = editor.sample(1.5);

    // Assert
    expect(current.time.integerFrame).toBe(4);
    expect(current.layer('ghost')).toMatchObject({ active: true, values: { y: 7 } });
    expect(between.time.frame).toBe(1.5);
    expect(between.layer('hero')?.values.x).toBeCloseTo(5);
  });

  it('clamps the frame and refuses a non-finite one', () => {
    // Arrange
    const { editor } = createPlaybackEditor();

    // Act
    const low = editor.sample(-3);
    const high = editor.sample(500);

    // Assert
    expect(low.time.integerFrame).toBe(1);
    expect(high.time.integerFrame).toBe(20);
    expect(() => editor.sample(Number.NaN)).toThrow(/nombre fini/);
  });

  it('matches the runtime evaluation of each layer', () => {
    // Arrange
    const { editor } = createPlaybackEditor();
    const hero = editor.document.layers[0];
    if (hero === undefined || !isLayer(hero)) throw new Error('calque attendu');

    // Act
    const sample = editor.sample(7);

    // Assert
    expect(sample.layer('hero')?.values).toEqual(evaluateLayer(hero, 7).values);
  });

  it('returns a frozen sample and emits no event', () => {
    // Arrange
    const { editor, clock } = createPlaybackEditor();
    clock.advance(DISPLAY_FRAME_MS);
    const log = recordRenders(editor);

    // Act
    const sample = editor.sample(3);

    // Assert
    expect(Object.isFrozen(sample)).toBe(true);
    expect(Object.isFrozen(sample.layers)).toBe(true);
    expect(Object.isFrozen(sample.layers[0])).toBe(true);
    expect(Object.isFrozen(sample.layers[0]?.values)).toBe(true);
    expect(log.renders).toHaveLength(0);
    expect(log.playheads).toHaveLength(0);
  });

  it('is the same function for plugins (ctx.playback.sample)', () => {
    // Arrange
    const { plugin, context } = captureContext();
    const { editor } = createPlaybackEditor({ plugins: [plugin] });

    // Act
    const fromPlugin = context().playback.sample(6);

    // Assert
    expect(context().playback).toBe(editor.playback);
    expect(fromPlugin.layer('hero')?.values).toEqual({ x: 50 });
  });

  it('skips a track unknown to the registry and keeps the other tracks', () => {
    // Arrange
    const data = deepFreeze<ITimelineDocument>({
      version: '2.0.0',
      settings: { fps: 10, totalFrames: 5 },
      layers: [{
        id: 'robot', type: 'layer', name: 'Robot', target: { ref: 'arm', stage: 'servo' },
        spans: [{ id: 's1', start: 1, end: 5, kind: 'static', tracks: { x: [{ frame: 1, value: 3 }], servoAngle: [{ frame: 1, value: 90 }] } }]
      }]
    });
    const { editor } = createPlaybackEditor({ data, onWarning: () => undefined });

    // Act
    const sample = editor.sample(1);

    // Assert
    expect(sample.layer('robot')?.values).toEqual({ x: 3 });
  });
});

describe('FrameSampler', () => {
  it('uses its registry for extra value properties', () => {
    // Arrange
    const registry = createPropertyRegistry([{ name: 'volume', kind: 'value', unit: '', defaultValue: 1 }]);
    const doc = deepFreeze<ITimelineDocument>({
      version: '2.0.0',
      settings: { fps: 10, totalFrames: 3 },
      layers: [{
        id: 'music', type: 'layer', name: 'Musique', target: { ref: 'music', stage: 'audio' },
        spans: [{ id: 's1', start: 1, end: 3, kind: 'tween', tracks: { volume: [{ frame: 1, value: 0 }, { frame: 3, value: 1 }] } }]
      }]
    });

    // Act
    const sample = new FrameSampler(registry).sample(doc, FrameSampler.timeAt(doc, 2));

    // Assert
    expect(sample.layer('music')?.values).toEqual({ volume: 0.5 });
  });

  it('keeps one layer list per document reference', () => {
    // Arrange
    const sampler = new FrameSampler(createPropertyRegistry());
    const doc = createAnimatedDocument();
    const shown = deepFreeze<ITimelineDocument>({
      ...doc,
      layers: doc.layers.map((node) => (node.id === 'folder' ? { ...node, visible: true } : node))
    });

    // Act
    const before = sampler.sample(doc, FrameSampler.timeAt(doc, 1));
    const after = sampler.sample(shown, FrameSampler.timeAt(shown, 1));
    const again = sampler.sample(doc, FrameSampler.timeAt(doc, 1));

    // Assert
    expect(before.layer('tree')?.editorVisible).toBe(false);
    expect(after.layer('tree')?.editorVisible).toBe(true);
    expect(again.layer('tree')?.editorVisible).toBe(false);
  });
});
