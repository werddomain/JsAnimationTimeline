// packages/runtime/src/model/__tests__/validate.test.ts
/**
 * Semantic invariants checked by validateDocument, one test per issue code.
 */

import type { ITimelineDocument } from '../document';
import type { LayerNode } from '../layer';
import type { ISpan } from '../span';
import { validateDocument, ValidationCodes, type IValidationIssue } from '../validate';

function docWith(layers: readonly LayerNode[], totalFrames = 10): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames }, layers };
}

function docWithSpans(spans: readonly ISpan[], totalFrames = 10): ITimelineDocument {
  return docWith([{ id: 'l1', type: 'layer', name: 'L', spans }], totalFrames);
}

function issueKeys(issues: readonly IValidationIssue[]): string[] {
  return issues.map((issue) => `${issue.code} ${issue.path}`);
}

describe('validateDocument', () => {
  it('accepts a consistent document', () => {
    const doc = docWithSpans([
      { id: 's1', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }], y: [{ frame: 1, value: 2 }] } },
      { id: 's2', start: 5, end: 5, kind: 'blank' },
      { id: 's3', start: 6, end: 10, kind: 'tween', easing: 'cubic-bezier(0.1, 2, 0.9, -1)',
        tracks: { x: [{ frame: 6, value: 0 }, { frame: 8, value: 3 }, { frame: 10, value: 1 }] } }
    ]);
    expect(validateDocument(doc)).toEqual([]);
  });

  it('accepts layers without spans and empty documents', () => {
    expect(validateDocument(docWith([]))).toEqual([]);
    expect(validateDocument(docWithSpans([]))).toEqual([]);
  });

  it('reports every issue with a message', () => {
    const issues = validateDocument(docWithSpans([{ id: 's1', start: 2, end: 20, kind: 'static' }]));
    expect(issues).toHaveLength(2);
    for (const issue of issues) {
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });

  describe(ValidationCodes.DUPLICATE_ID, () => {
    it('detects ids shared by layers, folders and spans, at any depth', () => {
      const doc = docWith([
        { id: 'a', type: 'layer', name: 'A', spans: [{ id: 'f', start: 1, end: 10, kind: 'static' }] },
        { id: 'f', type: 'folder', name: 'F', children: [
          { id: 'a', type: 'layer', name: 'A2', spans: [] }
        ] }
      ]);
      expect(issueKeys(validateDocument(doc))).toEqual([
        'duplicate-id /layers/1/id',
        'duplicate-id /layers/1/children/0/id'
      ]);
    });
  });

  it(ValidationCodes.SPAN_INVALID_RANGE, () => {
    const doc = docWithSpans([{ id: 's1', start: 5, end: 4, kind: 'static' }]);
    expect(issueKeys(validateDocument(doc))).toContain('span-invalid-range /layers/0/spans/0/end');
  });

  it(ValidationCodes.SPANS_UNSORTED, () => {
    const doc = docWithSpans([
      { id: 's1', start: 1, end: 5, kind: 'static' },
      { id: 's2', start: 6, end: 10, kind: 'static' },
      { id: 's3', start: 3, end: 4, kind: 'static' }
    ]);
    expect(issueKeys(validateDocument(doc))).toEqual(['spans-unsorted /layers/0/spans/2/start']);
  });

  it.each([
    ['a gap', 7],
    ['an overlap', 5]
  ])(`${ValidationCodes.SPANS_NOT_CONTIGUOUS} (%s)`, (_label, secondStart) => {
    const doc = docWithSpans([
      { id: 's1', start: 1, end: 5, kind: 'static' },
      { id: 's2', start: secondStart, end: 10, kind: 'static' }
    ]);
    expect(issueKeys(validateDocument(doc))).toEqual(['spans-not-contiguous /layers/0/spans/1/start']);
  });

  it(ValidationCodes.FIRST_SPAN_NOT_AT_FRAME_1, () => {
    const doc = docWithSpans([{ id: 's1', start: 2, end: 10, kind: 'static' }]);
    expect(issueKeys(validateDocument(doc))).toEqual(['first-span-not-at-frame-1 /layers/0/spans/0/start']);
  });

  it(ValidationCodes.SPAN_EXCEEDS_TOTAL_FRAMES, () => {
    const doc = docWithSpans([{ id: 's1', start: 1, end: 11, kind: 'static' }]);
    expect(issueKeys(validateDocument(doc))).toEqual(['span-exceeds-total-frames /layers/0/spans/0/end']);
  });

  it(ValidationCodes.KEYFRAME_OUT_OF_SPAN, () => {
    const doc = docWithSpans([
      { id: 's1', start: 1, end: 4, kind: 'static' },
      { id: 's2', start: 5, end: 10, kind: 'tween', tracks: { x: [{ frame: 4, value: 0 }, { frame: 11, value: 1 }] } }
    ]);
    expect(issueKeys(validateDocument(doc))).toEqual([
      'keyframe-out-of-span /layers/0/spans/1/tracks/x/0/frame',
      'keyframe-out-of-span /layers/0/spans/1/tracks/x/1/frame'
    ]);
  });

  it.each([
    ['duplicated', 3],
    ['decreasing', 2]
  ])(`${ValidationCodes.KEYFRAMES_NOT_INCREASING} (%s frames)`, (_label, secondFrame) => {
    const doc = docWithSpans([
      { id: 's1', start: 1, end: 10, kind: 'tween', tracks: { opacity: [{ frame: 3, value: 0 }, { frame: secondFrame, value: 1 }] } }
    ]);
    expect(issueKeys(validateDocument(doc))).toEqual(['keyframes-not-increasing /layers/0/spans/0/tracks/opacity/1/frame']);
  });

  it(ValidationCodes.STATIC_KEYFRAME_NOT_AT_START, () => {
    const doc = docWithSpans([
      { id: 's1', start: 1, end: 10, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }], y: [{ frame: 2, value: 0 }] } }
    ]);
    expect(issueKeys(validateDocument(doc))).toEqual(['static-keyframe-not-at-start /layers/0/spans/0/tracks/y/0/frame']);
  });

  it(`reports two keyframes of one property on a static span`, () => {
    const doc = docWithSpans([
      { id: 's1', start: 1, end: 10, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }, { frame: 1, value: 2 }] } }
    ]);
    expect(issueKeys(validateDocument(doc))).toEqual(['keyframes-not-increasing /layers/0/spans/0/tracks/x/1/frame']);
  });

  it(ValidationCodes.TRACKS_NOT_ALLOWED, () => {
    const doc = docWithSpans([{ id: 's1', start: 1, end: 10, kind: 'blank', tracks: { x: [{ frame: 99, value: 0 }] } }]);
    expect(issueKeys(validateDocument(doc))).toEqual(['tracks-not-allowed /layers/0/spans/0/tracks']);
  });

  it.each(['blank', 'static'] as const)(`${ValidationCodes.EASING_NOT_ALLOWED} (%s span)`, (kind) => {
    const doc = docWithSpans([{ id: 's1', start: 1, end: 10, kind, easing: 'ease' }]);
    expect(issueKeys(validateDocument(doc))).toEqual(['easing-not-allowed /layers/0/spans/0/easing']);
  });

  it(ValidationCodes.INVALID_EASING, () => {
    const doc = docWithSpans([{ id: 's1', start: 1, end: 10, kind: 'tween', easing: 'cubic-bezier(2, 0, 1, 1)' }]);
    expect(issueKeys(validateDocument(doc))).toEqual(['invalid-easing /layers/0/spans/0/easing']);
  });

  it.each([NaN, Infinity, -Infinity])(`${ValidationCodes.NON_FINITE_VALUE} (%p)`, (value) => {
    const doc = docWithSpans([{ id: 's1', start: 1, end: 10, kind: 'tween', tracks: { x: [{ frame: 1, value }] } }]);
    expect(issueKeys(validateDocument(doc))).toEqual(['non-finite-value /layers/0/spans/0/tracks/x/0/value']);
  });

  it('escapes property names in paths like a JSON pointer', () => {
    const doc = docWithSpans([{ id: 's1', start: 1, end: 10, kind: 'tween', tracks: { 'a/b~c': [{ frame: 20, value: 0 }] } }]);
    expect(issueKeys(validateDocument(doc))).toEqual(['keyframe-out-of-span /layers/0/spans/0/tracks/a~1b~0c/0/frame']);
  });

  it('checks layers nested in folders', () => {
    const doc = docWith([
      { id: 'f', type: 'folder', name: 'F', children: [
        { id: 'l', type: 'layer', name: 'L', spans: [{ id: 's', start: 2, end: 10, kind: 'blank' }] }
      ] }
    ]);
    expect(issueKeys(validateDocument(doc))).toEqual(['first-span-not-at-frame-1 /layers/0/children/0/spans/0/start']);
  });
});
