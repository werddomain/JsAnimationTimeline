// packages/runtime/src/evaluate/__tests__/evaluateDocument.test.ts
/**
 * Evaluation of a whole document, and the evaluate entry point.
 */

import * as runtime from '../../index';
import type { ITimelineDocument } from '../../model/document';
import * as evaluate from '../index';
import { clampFrame, collectLayers, evaluateDocument } from '../evaluateDocument';

const DOC: ITimelineDocument = {
  version: '2.0.0',
  settings: { fps: 24, totalFrames: 10 },
  layers: [
    { id: 'a', type: 'layer', name: 'A', spans: [{ id: 'sa', start: 1, end: 10, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] } }] },
    {
      id: 'f', type: 'folder', name: 'Folder', children: [
        { id: 'b', type: 'layer', name: 'B', spans: [{ id: 'sb', start: 1, end: 10, kind: 'blank' }] },
        { id: 'g', type: 'folder', name: 'Inner', children: [
          { id: 'c', type: 'layer', name: 'C', spans: [{ id: 'sc', start: 1, end: 10, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.5 }] } }] }
        ] }
      ]
    }
  ]
};

describe('collectLayers', () => {
  it('lists layers depth-first, without folders', () => {
    expect(collectLayers(DOC).map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('clampFrame', () => {
  it.each([[-3, 1], [0, 1], [5.5, 5.5], [10, 10], [99, 10]])('clamps %p to %p', (frame, expected) => {
    expect(clampFrame(DOC, frame)).toBe(expected);
  });
});

describe('evaluateDocument', () => {
  it('evaluates every layer at the frame', () => {
    expect(evaluateDocument(DOC, 4)).toEqual([
      { layerId: 'a', visible: true, spanId: 'sa', values: { x: 30 } },
      { layerId: 'b', visible: false, spanId: 'sb', values: {} },
      { layerId: 'c', visible: true, spanId: 'sc', values: { opacity: 0.5 } }
    ]);
  });

  it('clamps the frame to the document', () => {
    expect(evaluateDocument(DOC, 50)[0].values.x).toBe(90);
    expect(evaluateDocument(DOC, -5)[0].values.x).toBe(0);
  });

  it('throws for a non-finite frame', () => {
    expect(() => evaluateDocument(DOC, Number.NaN)).toThrow('Frame must be a finite number');
  });

  it('returns an empty list for a document without layers', () => {
    expect(evaluateDocument({ ...DOC, layers: [] }, 1)).toEqual([]);
  });
});

describe('evaluate entry point', () => {
  it('exports the evaluation values', () => {
    expect(Object.keys(evaluate).sort()).toEqual([
      'EvaluateIssueCodes',
      'applyUnknownPropertyPolicy',
      'clampFrame',
      'collectLayerProperties',
      'collectLayers',
      'createEasingFunction',
      'createPropertyEasingFunction',
      'cubicBezierFunction',
      'evaluateDocument',
      'evaluateLayer',
      'evaluatePropertyTimeline',
      'evaluatePropertyTimelines',
      'findSpanAt',
      'findUnknownProperties',
      'valueAtFrame',
      'withImplicitStart'
    ]);
  });

  it('is re-exported by the package', () => {
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining(Object.keys(evaluate)));
  });
});
