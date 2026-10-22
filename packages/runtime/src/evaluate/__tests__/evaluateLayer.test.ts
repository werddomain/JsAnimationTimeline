// packages/runtime/src/evaluate/__tests__/evaluateLayer.test.ts
/**
 * Value of every property of a layer at frame N: spans, tracks, easing,
 * carried values, defaults and blank spans.
 */

import type { ILayer } from '../../model/layer';
import type { ISpan } from '../../model/span';
import { createPropertyRegistry } from '../../properties/PropertyRegistry';
import { createEasingFunction } from '../easingFunction';
import { collectLayerProperties, evaluateLayer, findSpanAt } from '../evaluateLayer';

function layer(spans: ISpan[]): ILayer {
  return { id: 'l1', type: 'layer', name: 'Logo', target: { selector: '#logo' }, spans };
}

/** The example of the analysis report (section 4.1). */
const LOGO = layer([
  {
    id: 's1', start: 1, end: 48, kind: 'tween',
    tracks: {
      x: [{ frame: 1, value: 0 }, { frame: 48, value: 300 }],
      opacity: [{ frame: 1, value: 0 }, { frame: 12, value: 1 }]
    }
  },
  { id: 's2', start: 49, end: 120, kind: 'static', tracks: { x: [{ frame: 49, value: 300 }] } }
]);

describe('evaluateLayer on the report example', () => {
  it('starts with the first keyframes', () => {
    expect(evaluateLayer(LOGO, 1)).toEqual({ layerId: 'l1', visible: true, spanId: 's1', values: { x: 0, opacity: 0 } });
  });

  it('interpolates each track on its own keyframes', () => {
    const { values } = evaluateLayer(LOGO, 6.5);
    expect(values.opacity).toBeCloseTo(0.5, 10);
    expect(values.x).toBeCloseTo((300 * 5.5) / 47, 10);
  });

  it('holds a track after its last keyframe', () => {
    expect(evaluateLayer(LOGO, 30).values.opacity).toBe(1);
  });

  it('reaches the end values at the end of the tween', () => {
    expect(evaluateLayer(LOGO, 48).values).toEqual({ x: 300, opacity: 1 });
  });

  it('gives a fractional frame to the span of its integer part', () => {
    expect(evaluateLayer(LOGO, 48.5)).toMatchObject({ spanId: 's1', values: { x: 300 } });
  });

  it('carries values into a static span that does not set them', () => {
    expect(evaluateLayer(LOGO, 80)).toEqual({ layerId: 'l1', visible: true, spanId: 's2', values: { x: 300, opacity: 1 } });
  });

  it('hides the target after the last span', () => {
    expect(evaluateLayer(LOGO, 121)).toEqual({ layerId: 'l1', visible: false, spanId: undefined, values: { x: 300, opacity: 1 } });
  });

  it('hides the target before the first frame, with registry defaults', () => {
    expect(evaluateLayer(LOGO, 0)).toMatchObject({ visible: false, spanId: undefined, values: { x: 0, opacity: 1 } });
  });
});

describe('evaluateLayer spans', () => {
  it('returns no values and hides the target for a layer without spans', () => {
    expect(evaluateLayer(layer([]), 1)).toEqual({ layerId: 'l1', visible: false, spanId: undefined, values: {} });
  });

  it('hides the target in a blank span and keeps the carried values', () => {
    const doc = layer([
      { id: 'a', start: 1, end: 5, kind: 'static', tracks: { x: [{ frame: 1, value: 40 }] } },
      { id: 'b', start: 6, end: 10, kind: 'blank' },
      { id: 'c', start: 11, end: 20, kind: 'static' }
    ]);
    expect(evaluateLayer(doc, 7)).toEqual({ layerId: 'l1', visible: false, spanId: 'b', values: { x: 40 } });
    expect(evaluateLayer(doc, 12)).toEqual({ layerId: 'l1', visible: true, spanId: 'c', values: { x: 40 } });
  });

  it('uses the registry default before a property first appears', () => {
    const doc = layer([
      { id: 'a', start: 1, end: 5, kind: 'static' },
      { id: 'b', start: 6, end: 10, kind: 'static', tracks: { scaleX: [{ frame: 6, value: 2 }], opacity: [{ frame: 6, value: 0.5 }] } }
    ]);
    expect(evaluateLayer(doc, 3).values).toEqual({ scaleX: 1, opacity: 1 });
    expect(evaluateLayer(doc, 8).values).toEqual({ scaleX: 2, opacity: 0.5 });
  });

  it('starts a tween track from the carried value when its first keyframe is later', () => {
    const doc = layer([
      { id: 'a', start: 1, end: 10, kind: 'static', tracks: { x: [{ frame: 1, value: 100 }] } },
      { id: 'b', start: 11, end: 21, kind: 'tween', tracks: { x: [{ frame: 21, value: 200 }] } }
    ]);
    expect(evaluateLayer(doc, 11).values.x).toBe(100);
    expect(evaluateLayer(doc, 16).values.x).toBeCloseTo(150, 10);
    expect(evaluateLayer(doc, 21).values.x).toBe(200);
  });

  it('reads the last keyframe of a tween into the next spans', () => {
    const doc = layer([
      { id: 'a', start: 1, end: 10, kind: 'tween', tracks: { rotation: [{ frame: 1, value: 0 }, { frame: 5, value: 90 }] } },
      { id: 'b', start: 11, end: 20, kind: 'blank' },
      { id: 'c', start: 21, end: 30, kind: 'tween', tracks: { x: [{ frame: 21, value: 0 }, { frame: 30, value: 9 }] } }
    ]);
    expect(evaluateLayer(doc, 25).values).toMatchObject({ rotation: 90 });
  });

  it('resets values with a static span keyframe', () => {
    const doc = layer([
      { id: 'a', start: 1, end: 10, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] } },
      { id: 'b', start: 11, end: 20, kind: 'static', tracks: { x: [{ frame: 11, value: 5 }] } }
    ]);
    expect(evaluateLayer(doc, 15).values.x).toBe(5);
  });

  it('ignores an empty track when carrying values', () => {
    const doc = layer([
      { id: 'a', start: 1, end: 5, kind: 'static', tracks: { x: [{ frame: 1, value: 3 }] } },
      { id: 'b', start: 6, end: 10, kind: 'static', tracks: { x: [] } },
      { id: 'c', start: 11, end: 12, kind: 'static' }
    ]);
    expect(evaluateLayer(doc, 11).values.x).toBe(3);
  });

  it('handles a one-frame tween', () => {
    const doc = layer([{ id: 'a', start: 1, end: 1, kind: 'tween', tracks: { x: [{ frame: 1, value: 7 }] } }]);
    expect(evaluateLayer(doc, 1).values.x).toBe(7);
  });

  it('keeps carried values for a tween without tracks', () => {
    const doc = layer([
      { id: 'a', start: 1, end: 5, kind: 'static', tracks: { y: [{ frame: 1, value: 12 }] } },
      { id: 'b', start: 6, end: 10, kind: 'tween' }
    ]);
    expect(evaluateLayer(doc, 8).values).toEqual({ y: 12 });
  });
});

describe('evaluateLayer easing', () => {
  const tween = (easing: ISpan['easing'], tracks: ISpan['tracks']): ILayer =>
    layer([{ id: 'a', start: 1, end: 11, kind: 'tween', easing, tracks }]);

  it('applies the easing to the whole span', () => {
    const doc = tween('ease-in', { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] });
    expect(evaluateLayer(doc, 6).values.x).toBeCloseTo(100 * createEasingFunction('ease-in')(0.5), 6);
  });

  it('reads middle property keyframes at the eased frame (not per segment)', () => {
    const doc = tween('ease-in', { x: [{ frame: 1, value: 0 }, { frame: 6, value: 50 }, { frame: 11, value: 60 }] });
    const eased = 1 + createEasingFunction('ease-in')(0.5) * 10;
    // Eased frame < 6, so the value is still on the first segment.
    expect(eased).toBeLessThan(6);
    expect(evaluateLayer(doc, 6).values.x).toBeCloseTo(((eased - 1) / 5) * 50, 6);
  });

  it('defaults to linear', () => {
    const doc = tween(undefined, { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] });
    expect(evaluateLayer(doc, 4).values.x).toBeCloseTo(30, 10);
  });

  it('overshoots with a back-like curve, within the opacity bounds', () => {
    const doc = tween('cubic-bezier(0.68, -0.55, 0.265, 1.55)', {
      x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }],
      opacity: [{ frame: 1, value: 0 }, { frame: 11, value: 1 }]
    });
    const states = Array.from({ length: 101 }, (_, i) => evaluateLayer(doc, 1 + i / 10).values);
    const xs = states.map((v) => v.x);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(100);
    states.forEach((v) => {
      expect(v.opacity).toBeGreaterThanOrEqual(0);
      expect(v.opacity).toBeLessThanOrEqual(1);
    });
  });

  it('throws for an invalid easing', () => {
    const doc = tween('cubic-bezier(2, 0, 0, 1)', { x: [{ frame: 1, value: 0 }] });
    expect(() => evaluateLayer(doc, 2)).toThrow('Invalid easing');
  });
});

describe('evaluateLayer options and errors', () => {
  const custom = layer([
    { id: 'a', start: 1, end: 3, kind: 'tween', tracks: { borderRadius: [{ frame: 1, value: 0 }, { frame: 3, value: 20 }] } }
  ]);

  it('throws for a property unknown to the registry', () => {
    expect(() => evaluateLayer(custom, 2)).toThrow('Unknown property "borderRadius"');
  });

  it('uses a registry with plugin properties', () => {
    const registry = createPropertyRegistry([
      { name: 'borderRadius', kind: 'style', cssName: 'border-radius', unit: 'px', defaultValue: 0 }
    ]);
    expect(evaluateLayer(custom, 2, { registry }).values).toEqual({ borderRadius: 10 });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('throws for frame %p', (frame) => {
    expect(() => evaluateLayer(LOGO, frame)).toThrow('Frame must be a finite number');
  });
});

describe('findSpanAt', () => {
  it.each([
    [1, 's1'],
    [48, 's1'],
    [48.99, 's1'],
    [49, 's2'],
    [120.5, 's2'],
    [121, undefined],
    [0.5, undefined]
  ])('frame %p is in span %p', (frame, spanId) => {
    expect(findSpanAt(LOGO, frame)?.id).toBe(spanId);
  });
});

describe('collectLayerProperties', () => {
  it('lists every tracked property once, in order of first appearance', () => {
    expect(collectLayerProperties(LOGO)).toEqual(['x', 'opacity']);
  });

  it('is empty without tracks', () => {
    expect(collectLayerProperties(layer([{ id: 'a', start: 1, end: 2, kind: 'blank' }]))).toEqual([]);
  });
});
