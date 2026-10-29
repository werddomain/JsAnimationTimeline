// packages/runtime/src/evaluate/__tests__/unknownProperties.test.ts
/**
 * `unknownProperties` option of the evaluation: `throw` by default, `skip`
 * drops and reports only the unknown track; value properties are evaluated.
 */

import type { ITimelineDocument } from '../../model/document';
import type { ILayer } from '../../model/layer';
import { interpolators } from '../../properties/interpolators';
import { createPropertyRegistry } from '../../properties/PropertyRegistry';
import { evaluateDocument } from '../evaluateDocument';
import { evaluateLayer } from '../evaluateLayer';
import { applyUnknownPropertyPolicy, EvaluateIssueCodes, findUnknownProperties } from '../unknownProperties';
import type { IEvaluateIssue, UnknownPropertyPolicy } from '../unknownProperties';

const registry = createPropertyRegistry([
  { name: 'frameIndex', kind: 'value', unit: '', defaultValue: 0, interpolate: interpolators.floor },
  { name: 'muted', kind: 'value', unit: '', defaultValue: 0, interpolate: interpolators.step }
]);

const layer: ILayer = {
  id: 'hero',
  type: 'layer',
  name: 'Hero',
  target: { ref: 'hero', stage: 'canvas' },
  spans: [
    { id: 's1', start: 1, end: 5, kind: 'static', tracks: { pitch: [{ frame: 1, value: 3 }] } },
    { id: 's2', start: 6, end: 16, kind: 'tween', tracks: {
      x: [{ frame: 6, value: 0 }, { frame: 16, value: 100 }],
      frameIndex: [{ frame: 6, value: 0 }, { frame: 16, value: 11 }],
      muted: [{ frame: 6, value: 0 }, { frame: 16, value: 1 }],
      pitch: [{ frame: 16, value: 9 }],
      gain: [{ frame: 6, value: 1 }]
    } }
  ]
};

describe('unknown properties', () => {
  it('throws by default and with "throw"', () => {
    expect(() => evaluateLayer(layer, 8, { registry })).toThrow('Unknown property "pitch"');
    expect(() => evaluateLayer(layer, 8, { registry, unknownProperties: 'throw' })).toThrow('Unknown property "pitch"');
  });

  it('skips and reports only the unknown tracks with "skip"', () => {
    const issues: IEvaluateIssue[] = [];
    const state = evaluateLayer(layer, 11, { registry, unknownProperties: 'skip', onIssue: (issue) => issues.push(issue) });
    expect(state.values).toEqual({ x: 50, frameIndex: 5, muted: 0 });
    expect(state.visible).toBe(true);
    expect(issues).toEqual([
      { code: EvaluateIssueCodes.UNKNOWN_PROPERTY, layerId: 'hero', property: 'pitch', message: 'Layer "hero": unknown property "pitch" skipped.' },
      { code: 'unknown-property', layerId: 'hero', property: 'gain', message: 'Layer "hero": unknown property "gain" skipped.' }
    ]);
  });

  it('evaluates value properties with their interpolators', () => {
    const options = { registry, unknownProperties: 'skip' as const };
    expect(evaluateLayer(layer, 15.9, options).values.frameIndex).toBe(10);
    expect(evaluateLayer(layer, 15.9, options).values.muted).toBe(0);
    expect(evaluateLayer(layer, 16, options).values).toEqual({ x: 100, frameIndex: 11, muted: 1 });
  });

  it('works without a listener and leaves the layer untouched', () => {
    const before = JSON.stringify(layer);
    expect(evaluateLayer(layer, 1, { registry, unknownProperties: 'skip' }).values).toEqual({ x: 0, frameIndex: 0, muted: 0 });
    expect(JSON.stringify(layer)).toBe(before);
  });

  it('reports with the layer id from evaluateDocument', () => {
    const doc: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 16 }, layers: [
      { id: 'f', type: 'folder', name: 'F', children: [layer] },
      { id: 'other', type: 'layer', name: 'O', spans: [{ id: 's3', start: 1, end: 16, kind: 'static', tracks: { y: [{ frame: 1, value: 4 }] } }] }
    ] };
    const issues: IEvaluateIssue[] = [];
    const states = evaluateDocument(doc, 99, { registry, unknownProperties: 'skip', onIssue: (issue) => issues.push(issue) });
    expect(states.map((s) => s.values)).toEqual([{ x: 100, frameIndex: 11, muted: 1 }, { y: 4 }]);
    expect(issues.map((issue) => `${issue.layerId}.${issue.property}`)).toEqual(['hero.pitch', 'hero.gain']);
  });

  it('refuses an unknown policy', () => {
    const policy = 'ignore' as unknown as UnknownPropertyPolicy;
    expect(() => evaluateLayer(layer, 1, { registry, unknownProperties: policy })).toThrow('unknownProperties must be "throw" or "skip"');
    const empty: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 1 }, layers: [] };
    expect(() => evaluateDocument(empty, 1, { unknownProperties: policy })).toThrow('unknownProperties must be "throw" or "skip"');
  });

  it('lists unknown track names in order of first appearance', () => {
    expect(findUnknownProperties(layer, registry)).toEqual(['pitch', 'gain']);
    expect(findUnknownProperties(layer, createPropertyRegistry())).toEqual(['pitch', 'frameIndex', 'muted', 'gain']);
  });

  it('returns the same layer when nothing is unknown or the policy is "throw"', () => {
    const known: ILayer = { ...layer, spans: [{ id: 's', start: 1, end: 2, kind: 'blank' }] };
    expect(applyUnknownPropertyPolicy(known, registry, 'skip', undefined)).toBe(known);
    expect(applyUnknownPropertyPolicy(layer, registry, 'throw', undefined)).toBe(layer);
  });
});
