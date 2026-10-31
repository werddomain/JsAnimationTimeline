// packages/runtime/src/playback/__tests__/compilePlayback.test.ts
import { compilePlayback } from '../compilePlayback';
import { parsePlayback } from '../parsePlayback';
import { samplePlayback } from '../samplePlayback';
import { evaluateDocument } from '../../evaluate/evaluateDocument';
import { createPropertyRegistry } from '../../properties/PropertyRegistry';
import type { ITimelineDocument } from '../../model/document';
import type { PropertyEasing } from '../../model/propertyEasing';
import { documentWith, layerOf, numberValue, timeline } from './fixtures';
import { freezePlaybackJson } from '../json';

describe('generic playback compilation without a DOM', () => {
  it('samples independent properties and supports a backward seek without replay or new editable keys', () => {
    const doc = freezePlaybackJson(documentWith({ gain: timeline(1, 50, 0.8), x: timeline(0, 25, 30) }));
    const before = JSON.stringify(doc);
    const result = compilePlayback(doc);
    expect(result.status).toBe('exported');
    if (result.status !== 'exported') throw new Error(JSON.stringify(result.diagnostics));
    const data = parsePlayback(JSON.parse(JSON.stringify(result.data)));
    expect(data.sampling).toBe('frames');
    expect(Object.keys(data.frames)).toHaveLength(100);
    expect(data.objects.object.target).toEqual({ ref: 'synth', stage: 'audio' });
    expect(samplePlayback(data, 100).object.values).toEqual({ gain: numberValue(0.8), x: numberValue(30) });
    expect(samplePlayback(data, 20).object.values).toEqual({ gain: numberValue(1), x: numberValue(0) });
    expect(samplePlayback(data, 49.9).object.values.gain).toEqual(numberValue(1));
    expect(samplePlayback(data, -10)).toEqual(samplePlayback(data, 1));
    expect(samplePlayback(data, 500)).toEqual(samplePlayback(data, 100));
    expect(JSON.stringify(doc)).toBe(before);
    expect(typeof document).toBe('undefined');
  });

  it('preserves rich values, object identities, initial states and an unbound generic target', () => {
    const original = documentWith({
      text: { initialValue: { kind: 'text', value: 'base' }, keys: [{ frame: 5, value: { kind: 'text', value: '</script>\n"🌈' } }] },
      enabled: { initialValue: { kind: 'boolean', value: false }, keys: [{ frame: 3, value: { kind: 'boolean', value: true } }] },
      color: { initialValue: { kind: 'color', r: 0, g: 0, b: 1, a: 1 }, keys: [{ frame: 2, value: { kind: 'color', r: 1, g: 0, b: 0, a: 0.5 } }] }
    }, 5);
    const doc: ITimelineDocument = { ...original, layers: [layerOf(original), { type: 'layer', id: 'other', name: 'Unbound', spans: [], propertyTimelines: layerOf(original).propertyTimelines }] };
    const result = compilePlayback(doc);
    if (result.status !== 'exported') throw new Error(JSON.stringify(result.diagnostics));
    const data = parsePlayback(JSON.parse(JSON.stringify(result.data)));
    expect(Object.keys(data.objects)).toEqual(['object', 'other']);
    expect(data.objects.other).toEqual({ name: 'Unbound' });
    expect(samplePlayback(data, 5).object.values).toEqual({ text: { kind: 'text', value: '</script>\n"🌈' }, enabled: { kind: 'boolean', value: true }, color: { kind: 'color', r: 1, g: 0, b: 0, a: 0.5 } });
  });

  it.each<PropertyEasing>([
    { kind: 'effect', family: 'sine', mode: 'in-out' },
    { kind: 'effect', family: 'bounce', mode: 'out', parameters: { bounces: 4 } },
    { kind: 'effect', family: 'elastic', mode: 'in-out', parameters: { oscillations: 5, springiness: 2 } },
    { kind: 'bezier', x1: 0.2, y1: -0.4, x2: 0.8, y2: 1.3 }
  ])('bakes the canonical evaluator for %j, including a retained split source and a custom interpolator', (easing) => {
    const keys = [{ frame: 1, value: numberValue(0) }, { frame: 100, value: numberValue(10) }];
    const registry = createPropertyRegistry([{ name: 'gain', kind: 'value', unit: '', defaultValue: 0, interpolate: (a, b, t) => a + (b - a) * t * t }]);
    const source = { start: 1, end: 100, keys, easing };
    const unsplit = documentWith({ gain: { initialValue: numberValue(0), keys, transitions: [{ id: 'whole', fromFrame: 1, toFrame: 100, easing }] } });
    const middle = evaluateDocument(unsplit, 50, { registry })[0].propertyValues!.gain;
    const doc = documentWith({ gain: { initialValue: numberValue(0), keys: [keys[0], { frame: 50, value: middle }, keys[1]], transitions: [
      { id: 'left', fromFrame: 1, toFrame: 50, source }, { id: 'right', fromFrame: 50, toFrame: 100, source }
    ] } });
    const result = compilePlayback(doc, { registry });
    if (result.status !== 'exported') throw new Error(JSON.stringify(result.diagnostics));
    for (let frame = 1; frame <= 100; frame++) expect(samplePlayback(result.data, frame).object.values).toEqual(evaluateDocument(unsplit, frame, { registry })[0].propertyValues);
    expect(samplePlayback(result.data, 20.5)).toEqual(samplePlayback(result.data, 20));
  });

  it('keeps legacy blank-span visibility and carried values in direct snapshots', () => {
    const doc: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 6 }, layers: [{ id: 'legacy', type: 'layer', name: 'Legacy', spans: [
      { id: 'on', start: 1, end: 2, kind: 'static', tracks: { x: [{ frame: 1, value: 30 }] } },
      { id: 'off', start: 3, end: 4, kind: 'blank' }, { id: 'on2', start: 5, end: 6, kind: 'static' }
    ] }] };
    const result = compilePlayback(doc);
    if (result.status !== 'exported') throw new Error(JSON.stringify(result.diagnostics));
    expect(samplePlayback(result.data, 4).legacy).toEqual({ active: false, values: { x: numberValue(30) } });
    expect(samplePlayback(result.data, 5).legacy.active).toBe(true);
  });

  it('refuses unknown legacy properties, invalid input, executable targets, failing interpolation and resource overflow atomically', () => {
    const invalid = { version: 'bad', settings: { fps: 20, totalFrames: 2 }, layers: [] };
    expect(compilePlayback(invalid as ITimelineDocument).status).toBe('refused');
    const unknown: ITimelineDocument = { version: '2.0.0', settings: { fps: 20, totalFrames: 2 }, layers: [{ id: 'object', type: 'layer', name: 'Object', spans: [{ id: 'span', start: 1, end: 2, kind: 'static', tracks: { missing: [{ frame: 1, value: 1 }] } }] }] };
    expect(compilePlayback(unknown).status).toBe('refused');
    const doc = documentWith({ gain: timeline(0, 1, 2) });
    expect(compilePlayback(doc, { maxCells: 2 })).toEqual(expect.objectContaining({ status: 'refused' }));
    expect(compilePlayback(doc, { maxCells: 0 })).toEqual(expect.objectContaining({ status: 'refused' }));
    expect(compilePlayback(documentWith({}, 100_001)).status).toBe('refused');
    const target = { element: { nodeType: 1, toJSON: () => ({ selector: '#unsafe' }) } };
    expect(compilePlayback({ ...doc, layers: [{ ...layerOf(doc), target }] } as unknown as ITimelineDocument).status).toBe('refused');
    const badRegistry = createPropertyRegistry([{ name: 'gain', kind: 'value', unit: '', defaultValue: 0, interpolate: () => Infinity }]);
    const tween = documentWith({ gain: { initialValue: numberValue(0), keys: [{ frame: 1, value: numberValue(0) }, { frame: 100, value: numberValue(1) }], transitions: [{ id: 't', fromFrame: 1, toFrame: 100 }] } });
    expect(compilePlayback(tween, { registry: badRegistry }).status).toBe('refused');
  });

  it('handles valid prototype-like object names without losing objects or changing editor visibility flags', () => {
    const doc = documentWith({ gain: timeline(1, 1, 2) }, 2);
    const input = { ...doc, layers: [{ ...layerOf(doc), id: 'toString', visible: false }] };
    const result = compilePlayback(input);
    if (result.status !== 'exported') throw new Error(JSON.stringify(result.diagnostics));
    expect(Object.keys(result.data.objects)).toEqual(['toString']);
    expect(samplePlayback(result.data, 1).toString).toEqual({ active: true, values: { gain: numberValue(2) } });
  });
});
