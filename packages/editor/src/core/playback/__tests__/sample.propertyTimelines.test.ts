// packages/editor/src/core/playback/__tests__/sample.propertyTimelines.test.ts
import { createPropertyRegistry } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument, TimelinePropertyValues } from '@kazo-ca/timeline-runtime';
import { cleanBody } from '../../editor/__tests__/fixtures';
import { FrameSampler } from '../FrameSampler';
import type { IFrameSample, ILayerSample } from '../types';
import { createAnimatedDocument, createPlaybackEditor, DISPLAY_FRAME_MS } from './fixtures';

afterEach(cleanBody);

function typedValues(sample: ILayerSample | undefined): TimelinePropertyValues | undefined {
  return sample?.propertyValues;
}

function document(): ITimelineDocument {
  return {
    version: '2.0.0', settings: { fps: 10, totalFrames: 20 }, layers: [{
      id: 'modern', type: 'layer', name: 'Moderne', target: { ref: 'model' }, spans: [],
      propertyTimelines: {
        x: {
          initialValue: { kind: 'number', value: 0 },
          keys: [{ frame: 1, value: { kind: 'number', value: 0 } }, { frame: 11, value: { kind: 'number', value: 100 } }],
          transitions: [{ id: 'move', fromFrame: 1, toFrame: 11 }]
        },
        caption: {
          initialValue: { kind: 'text', value: 'Initial' },
          keys: [{ frame: 5, value: { kind: 'text', value: 'Bonjour' } }]
        },
        enabled: { initialValue: { kind: 'boolean', value: true }, keys: [] },
        color: { initialValue: { kind: 'color', r: 0.25, g: 0.5, b: 0.75, a: 0.8 }, keys: [] }
      }
    }]
  };
}

const expectedAtSix: TimelinePropertyValues = {
  x: { kind: 'number', value: 50 },
  caption: { kind: 'text', value: 'Bonjour' },
  enabled: { kind: 'boolean', value: true },
  color: { kind: 'color', r: 0.25, g: 0.5, b: 0.75, a: 0.8 }
};

it('includes all typed values and retains the numeric projection in an editor frame sample', () => {
  const doc = document();
  const sampler = new FrameSampler(createPropertyRegistry());
  const sampled = sampler.sample(doc, FrameSampler.timeAt(doc, 6)).layer('modern');

  expect(sampled).toMatchObject({ active: true, values: { x: 50 } });
  expect(typedValues(sampled)).toEqual(expectedAtSix);
});

it('freezes the typed record and every typed value without freezing mutable source data', () => {
  const doc = document();
  const sampler = new FrameSampler(createPropertyRegistry());
  const sourceLayer = doc.layers[0];
  if (sourceLayer.type !== 'layer') throw new Error('Expected a layer.');
  const sourceValue = sourceLayer.propertyTimelines?.caption.keys[0].value;
  expect(sourceValue).toBeDefined();
  expect(Object.isFrozen(sourceValue)).toBe(false);

  const values = typedValues(sampler.sample(doc, FrameSampler.timeAt(doc, 6)).layer('modern'));
  expect(values).toEqual(expectedAtSix);
  if (values === undefined) throw new Error('Expected typed values.');
  expect(Object.isFrozen(values)).toBe(true);
  for (const value of Object.values(values)) expect(Object.isFrozen(value)).toBe(true);
  expect(Reflect.set(values, 'added', { kind: 'number', value: 9 })).toBe(false);
  expect(Reflect.set(values.caption, 'value', 'Changed externally')).toBe(false);
  expect(Reflect.set(values.color, 'r', 1)).toBe(false);

  expect(Object.isFrozen(sourceValue)).toBe(false);
  expect(values.caption).not.toBe(sourceValue);
  expect(typedValues(sampler.sample(doc, FrameSampler.timeAt(doc, 6)).layer('modern'))).toEqual(expectedAtSix);
});

it('keeps older samples unchanged when another image is evaluated', () => {
  const doc = document();
  const sampler = new FrameSampler(createPropertyRegistry());
  const before = typedValues(sampler.sample(doc, FrameSampler.timeAt(doc, 1)).layer('modern'));
  const after = typedValues(sampler.sample(doc, FrameSampler.timeAt(doc, 6)).layer('modern'));

  expect(before?.caption).toEqual({ kind: 'text', value: 'Initial' });
  expect(before?.x).toEqual({ kind: 'number', value: 0 });
  expect(after).toEqual(expectedAtSix);
  expect(before).not.toBe(after);
});

it('propagates typed values through editor.sample and onFrame without creating editing history', () => {
  const { editor, clock } = createPlaybackEditor({ data: document(), stage: false });
  clock.advance(DISPLAY_FRAME_MS);
  const seen: IFrameSample[] = [];
  const history = jest.fn();
  editor.on('history:changed', history);
  const unsubscribe = editor.onFrame((sample) => seen.push(sample));

  const sampled = editor.sample(6);
  expect(typedValues(sampled.layer('modern'))).toEqual(expectedAtSix);
  expect(seen).toHaveLength(0);
  expect(history).not.toHaveBeenCalled();
  expect(editor.canUndo).toBe(false);

  editor.playback.seek(6);
  clock.advance(DISPLAY_FRAME_MS);
  expect(seen).toHaveLength(1);
  const values = typedValues(seen[0].layer('modern'));
  expect(values).toEqual(expectedAtSix);
  expect(Object.isFrozen(values)).toBe(true);
  expect(Object.isFrozen(values?.caption)).toBe(true);
  expect(history).not.toHaveBeenCalled();
  expect(editor.canUndo).toBe(false);

  unsubscribe();
  editor.destroy();
});

it('does not add a propertyValues field to legacy-only frame samples', () => {
  const doc = createAnimatedDocument();
  const sampler = new FrameSampler(createPropertyRegistry());
  const sampled = sampler.sample(doc, FrameSampler.timeAt(doc, 2)).layer('hero');

  expect(sampled).toEqual({
    layerId: 'hero', target: { selector: '#hero' }, values: { x: 10 },
    spanId: 's-hero', active: true, editorVisible: true
  });
  expect(Object.prototype.hasOwnProperty.call(sampled, 'propertyValues')).toBe(false);
});
