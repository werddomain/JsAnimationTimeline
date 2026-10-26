// packages/editor/src/model/properties/__tests__/propertyValue.test.ts
import { evaluateLayer } from '@werddomain/timeline-runtime';
import type { ISpan, LayerNode } from '@werddomain/timeline-runtime';
import { createDoc, createRegistry, expectValid, layer, layerOf, spansOf } from '../../spans/__tests__/fixtures';
import { applyPropertyValue } from '../propertyValue';

const motion: ISpan = {
  id: 'motion', start: 3, end: 13, kind: 'tween', easing: 'linear',
  tracks: {
    x: [{ frame: 3, value: 0 }, { frame: 13, value: 100 }],
    y: [{ frame: 3, value: 20 }, { frame: 13, value: 40 }]
  }
};
const context = { registry: createRegistry() };

function contentLayer(spans: readonly ISpan[]): ReturnType<typeof layer> {
  return layer('logo', [{ id: 'leading-blank', start: 1, end: 2, kind: 'blank' }, ...spans]);
}

it('adds a sorted absolute property key without splitting spans or changing other data', () => {
  const doc = createDoc([contentLayer([motion]), layer('other', [])]);
  const next = applyPropertyValue(doc, 'logo', 'x', 75, 8, context);
  const changed = spansOf(next, 'logo')[1];
  expect(changed).toEqual({ ...motion, tracks: { ...motion.tracks, x: [
    { frame: 3, value: 0 }, { frame: 8, value: 75 }, { frame: 13, value: 100 }
  ] } });
  expect(changed.tracks?.y).toBe(motion.tracks?.y);
  expect(next.layers[1]).toBe(doc.layers[1]);
  expect(next.settings).toBe(doc.settings);
  expect(spansOf(doc, 'logo')[1]).toBe(motion);
  expectValid(next);
});

it('replaces just the requested key and returns the same document for an identical key', () => {
  const doc = createDoc([contentLayer([motion])]);
  const next = applyPropertyValue(doc, 'logo', 'x', -5, 13, context);
  expect(spansOf(next, 'logo')[1].tracks?.x).toEqual([{ frame: 3, value: 0 }, { frame: 13, value: -5 }]);
  expect(applyPropertyValue(next, 'logo', 'x', -5, 13, context)).toBe(next);
});

it('records a new explicit key even when its value equals the evaluated value', () => {
  const doc = createDoc([contentLayer([motion])]);
  expect(evaluateLayer(layerOf(doc, 'logo'), 8, context).values.x).toBe(50);
  const next = applyPropertyValue(doc, 'logo', 'x', 50, 8, context);
  expect(next).not.toBe(doc);
  expect(spansOf(next, 'logo')[1].tracks?.x).toHaveLength(3);
});

it('writes static values at span.start and creates a missing property track', () => {
  const span: ISpan = { id: 'still', start: 3, end: 13, kind: 'static' };
  const doc = createDoc([contentLayer([span])]);
  const next = applyPropertyValue(doc, 'logo', 'opacity', 2, 8, context);
  expect(spansOf(next, 'logo')[1]).toEqual({ ...span, tracks: { opacity: [{ frame: 3, value: 2 }] } });
  expect(evaluateLayer(layerOf(next, 'logo'), 8, context).values.opacity).toBe(2);
  expect(applyPropertyValue(next, 'logo', 'opacity', 2, 9, context)).toBe(next);
  expectValid(next);
});

it('supports registered inherited names when the span has no own property track', () => {
  const registry = createRegistry().register({ name: 'toString', kind: 'value', unit: '', defaultValue: 0 });
  const doc = createDoc([contentLayer([motion])]);
  const next = applyPropertyValue(doc, 'logo', 'toString', 7, 8, { registry });
  expect(Object.prototype.hasOwnProperty.call(spansOf(next, 'logo')[1].tracks, 'toString')).toBe(true);
  expect(spansOf(next, 'logo')[1].tracks?.['toString']).toEqual([{ frame: 8, value: 7 }]);
  expectValid(next);
});

it('preserves nonlinear easing and stores the requested key without inverting runtime time mapping', () => {
  const doc = createDoc([contentLayer([{ ...motion, easing: 'ease-in' }])]);
  const next = applyPropertyValue(doc, 'logo', 'x', 75, 8, context);
  expect(spansOf(next, 'logo')[1].easing).toBe('ease-in');
  expect(spansOf(next, 'logo')[1].tracks?.x[1]).toEqual({ frame: 8, value: 75 });
  expect(evaluateLayer(layerOf(next, 'logo'), 8, context).values.x).not.toBeCloseTo(75);
});

it.each([0, -1, 25, 2.5, NaN, Infinity])('refuses invalid frame %s without auto-growing', (frame) => {
  const doc = createDoc([layer('logo', [motion])]);
  expect(() => applyPropertyValue(doc, 'logo', 'x', 2, frame, context)).toThrow();
  expect(doc.settings.totalFrames).toBe(24);
});

it.each([NaN, Infinity, -Infinity])('refuses nonfinite value %s', (value) => {
  expect(() => applyPropertyValue(createDoc([layer('logo', [motion])]), 'logo', 'x', value, 8, context)).toThrow();
});

it.each(['unknown', '', 'constructor', '__proto__'])('refuses unregistered property %s', (name) => {
  expect(() => applyPropertyValue(createDoc([layer('logo', [motion])]), 'logo', name, 2, 8, context)).toThrow();
});

it.each<readonly [string, readonly LayerNode[], number]>([
  ['missing layer', [], 8],
  ['folder', [{ id: 'logo', type: 'folder', name: 'folder', children: [] }], 8],
  ['blank span', [layer('logo', [{ id: 'blank', start: 1, end: 13, kind: 'blank' }])], 8],
  ['before span', [layer('logo', [motion])], 1],
  ['after span', [layer('logo', [motion])], 14],
  ['empty layer', [layer('logo', [])], 8],
  ['locked layer', [layer('logo', [motion], { locked: true })], 8],
  ['locked parent', [{ id: 'folder', type: 'folder', name: 'folder', locked: true, children: [layer('logo', [motion])] }], 8]
])('refuses %s', (_description, layers, frame) => {
  expect(() => applyPropertyValue(createDoc(layers), 'logo', 'x', 2, frame, context)).toThrow();
});
