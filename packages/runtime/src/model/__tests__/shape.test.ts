// packages/runtime/src/model/__tests__/shape.test.ts
/**
 * Hand-written shape check: issue codes and paths, live targets, the
 * property name rule and the ref target guard.
 */

import { isElementTarget, isRefTarget, isSelectorTarget } from '../guards';
import type { IValidationIssue } from '../issues';
import { isValidPropertyName, PROPERTY_NAME_PATTERN, RESERVED_PROPERTY_NAMES } from '../names';
import { checkDocumentShape } from '../shape';
import type { LayerTarget } from '../target';
import { validateDocument } from '../validate';

function keys(issues: readonly IValidationIssue[]): string[] {
  return issues.map((issue) => `${issue.code} ${issue.path}`);
}

function docWithTarget(target: unknown): unknown {
  return {
    version: '2.0.0',
    settings: { fps: 24, totalFrames: 10 },
    layers: [{ id: 'l1', type: 'layer', name: 'L', target, spans: [] }]
  };
}

function docWithLayer(patch: Record<string, unknown>): unknown {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 10 }, layers: [{ id: 'l1', type: 'layer', name: 'L', spans: [], ...patch }] };
}

describe('property name rule', () => {
  it.each(['x', 'borderRadius', 'colorR', 'frameIndex', 'a1'])('accepts %s', (name) => {
    expect(isValidPropertyName(name)).toBe(true);
  });

  it.each(['', '1x', 'border-radius', 'my_value', '$x', '__proto__', 'constructor', 'prototype', 'é'])('refuses %p', (name) => {
    expect(isValidPropertyName(name)).toBe(false);
  });

  it('refuses non-strings', () => {
    expect(isValidPropertyName(3)).toBe(false);
    expect(isValidPropertyName(undefined)).toBe(false);
  });

  it('matches the schema pattern and is frozen', () => {
    expect(PROPERTY_NAME_PATTERN.source).toBe('^[a-zA-Z][a-zA-Z0-9]*$');
    expect(Object.isFrozen(RESERVED_PROPERTY_NAMES)).toBe(true);
  });
});

describe('ref target guard', () => {
  const ref: LayerTarget = { ref: 'hero', stage: 'canvas' };

  it('recognises ref targets only', () => {
    expect(isRefTarget(ref)).toBe(true);
    expect(isRefTarget({ selector: '#a' })).toBe(false);
    expect(isRefTarget(undefined)).toBe(false);
    expect(isSelectorTarget(ref)).toBe(false);
    expect(isElementTarget(ref)).toBe(false);
  });
});

describe('checkDocumentShape', () => {
  it('accepts a well-formed document', () => {
    expect(checkDocumentShape(docWithTarget({ ref: 'hero', stage: 'canvas' }))).toEqual([]);
  });

  it.each([null, 3, 'doc', []])('reports a non-object document %p at the root', (value) => {
    expect(keys(checkDocumentShape(value))).toEqual(['invalid-type ']);
  });

  it('reports missing and unknown root fields', () => {
    expect(keys(checkDocumentShape({ version: '2.0.0', extra: 1 }))).toEqual([
      'missing-field /settings',
      'missing-field /layers',
      'unknown-field /extra'
    ]);
  });

  it('reports version, fps and totalFrames issues', () => {
    const doc = { version: '3.0.0', settings: { fps: 300, totalFrames: 1.5 }, layers: [] };
    expect(keys(checkDocumentShape(doc))).toEqual([
      'invalid-version /version',
      'out-of-range /settings/fps',
      'invalid-type /settings/totalFrames'
    ]);
  });

  it.each<[string, unknown, string]>([
    ['no key', {}, 'invalid-target /layers/0/target'],
    ['two keys', { selector: '#a', element: {} }, 'invalid-target /layers/0/target'],
    ['a non-object', 'hero', 'invalid-type /layers/0/target'],
    ['an empty ref', { ref: '' }, 'invalid-value /layers/0/target/ref'],
    ['a numeric stage', { ref: 'hero', stage: 1 }, 'invalid-type /layers/0/target/stage'],
    ['an extra field', { ref: 'hero', id: 'x' }, 'unknown-field /layers/0/target/id'],
    ['a selector with a ref stage', { selector: '#a', stage: 'html' }, 'unknown-field /layers/0/target/stage'],
    ['a null element', { element: null }, 'invalid-type /layers/0/target/element']
  ])('reports a target with %s', (_label, target, expected) => {
    expect(keys(checkDocumentShape(docWithTarget(target)))).toEqual([expected]);
  });

  it('accepts live { element } targets by default and refuses them with allowLiveTargets: false', () => {
    const doc = docWithTarget({ element: document.createElement('div') });
    expect(checkDocumentShape(doc)).toEqual([]);
    expect(validateDocument(doc)).toEqual([]);
    expect(keys(validateDocument(doc, { allowLiveTargets: false }))).toEqual(['live-target /layers/0/target']);
  });

  it('reports node issues with their paths', () => {
    const doc = {
      version: '2.0.0',
      settings: { fps: 24, totalFrames: 10 },
      layers: [
        { type: 'layer', name: 'A', color: '#12345', icon: '', spans: {} },
        { id: 'f', type: 'folder', name: 'F', collapsed: 'no', children: [{ id: 'g', name: 'G' }, { id: 'h', type: 'clip' }] },
        42
      ]
    };
    expect(keys(checkDocumentShape(doc))).toEqual([
      'missing-field /layers/0/id',
      'invalid-value /layers/0/color',
      'invalid-value /layers/0/icon',
      'invalid-type /layers/0/spans',
      'invalid-type /layers/1/collapsed',
      'missing-field /layers/1/children/0/type',
      'invalid-value /layers/1/children/1/type',
      'invalid-type /layers/2'
    ]);
  });

  it('reports span, track and keyframe issues with their paths', () => {
    const spans = [
      { id: '', start: 0, end: 'x', kind: 'shape', easing: 3, tracks: [] },
      { id: 's2', start: 1, end: 2, kind: 'tween', tracks: { 'my-x': [], constructor: [], x: {}, y: [7, { frame: 1, value: 'a', z: 0 }] } }
    ];
    expect(keys(checkDocumentShape(docWithLayer({ spans })))).toEqual([
      'invalid-value /layers/0/spans/0/id',
      'out-of-range /layers/0/spans/0/start',
      'invalid-type /layers/0/spans/0/end',
      'invalid-value /layers/0/spans/0/kind',
      'invalid-type /layers/0/spans/0/easing',
      'invalid-type /layers/0/spans/0/tracks',
      'invalid-property-name /layers/0/spans/1/tracks/my-x',
      'invalid-property-name /layers/0/spans/1/tracks/constructor',
      'invalid-type /layers/0/spans/1/tracks/x',
      'invalid-type /layers/0/spans/1/tracks/y/0',
      'unknown-field /layers/0/spans/1/tracks/y/1/z',
      'invalid-type /layers/0/spans/1/tracks/y/1/value'
    ]);
  });

  it('reports a __proto__ track from parsed JSON', () => {
    const doc: unknown = JSON.parse('{"version":"2.0.0","settings":{"fps":24,"totalFrames":10},"layers":[{"id":"l","type":"layer",'
      + '"name":"L","spans":[{"id":"s","start":1,"end":10,"kind":"tween","tracks":{"__proto__":[{"frame":1,"value":1}]}}]}]}');
    expect(keys(checkDocumentShape(doc))).toEqual(['invalid-property-name /layers/0/spans/0/tracks/__proto__']);
  });

  it('skips the semantic invariants of a malformed document', () => {
    const doc = docWithLayer({ name: 1, spans: [{ id: 's', start: 3, end: 2, kind: 'static' }] });
    expect(keys(validateDocument(doc))).toEqual(['invalid-type /layers/0/name']);
  });

  it('gives every issue a message', () => {
    for (const issue of checkDocumentShape({ version: 1, settings: [], layers: 'x' })) {
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });
});
