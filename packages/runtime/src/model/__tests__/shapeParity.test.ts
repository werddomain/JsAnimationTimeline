// packages/runtime/src/model/__tests__/shapeParity.test.ts
/**
 * Ajv (schema/timeline.schema.json) and the hand-written check of
 * validateDocument give the same verdict on the same valid and invalid
 * documents (live targets refused, as in a JSON file).
 */

import { validateDocument } from '../validate';
import { compileSchema, EXAMPLE_NAMES, readExample } from './fixtures/schema';

const ajvValidate = compileSchema();

type Patch = Record<string, unknown>;

function makeDoc(layerPatch: Patch = {}, spanPatch: Patch = {}, settings: unknown = { fps: 24, totalFrames: 10 }): unknown {
  return {
    version: '2.0.0',
    settings,
    layers: [{ id: 'l1', type: 'layer', name: 'Layer', spans: [{ id: 's1', start: 1, end: 10, kind: 'tween', ...spanPatch }], ...layerPatch }]
  };
}

const track = (name: string, value: unknown = 1): Patch => ({ tracks: { [name]: [{ frame: 1, value }] } });

const VALID: Array<[string, unknown]> = [
  ...EXAMPLE_NAMES.map((name): [string, unknown] => [`example ${name}`, readExample(name)]),
  ['the base document', makeDoc()],
  ['an empty document', { version: '2.13.0', settings: { fps: 240, totalFrames: 1 }, layers: [] }],
  ['a selector target', makeDoc({ target: { selector: '#logo' } })],
  ['a ref target', makeDoc({ target: { ref: 'hero' } })],
  ['a ref target with a stage', makeDoc({ target: { ref: 'hero', stage: 'canvas' } })],
  ['all optional layer fields', makeDoc({ color: '#ABCdef', visible: false, locked: true, icon: 'star' })],
  ['a folder', { version: '2.0.0', settings: { fps: 1, totalFrames: 5 }, layers: [
    { id: 'f', type: 'folder', name: 'F', collapsed: true, visible: true, locked: false, color: '#000000', children: [
      { id: 'l', type: 'layer', name: 'L', spans: [] }
    ] }
  ] }],
  ['a value track name', makeDoc({}, { tracks: { frameIndex: [{ frame: 1, value: 0 }, { frame: 10, value: 11 }] } })],
  ['tracks on a static span', makeDoc({}, { kind: 'static', ...track('x') })],
  ['an eased tween', makeDoc({}, { easing: 'cubic-bezier(0.1, 0.2, 0.3, 0.4)' })],
  ['an integer written as a float', makeDoc({}, { end: 10.0 })]
];

const INVALID: Array<[string, unknown]> = [
  ['a non-object document', [1, 2]],
  ['a missing version', { settings: { fps: 24, totalFrames: 1 }, layers: [] }],
  ['version 1.0.0', { version: '1.0.0', settings: { fps: 24, totalFrames: 1 }, layers: [] }],
  ['a numeric version', { version: 2, settings: { fps: 24, totalFrames: 1 }, layers: [] }],
  ['an extra root field', { version: '2.0.0', settings: { fps: 24, totalFrames: 1 }, layers: [], meta: {} }],
  ['missing settings', { version: '2.0.0', layers: [] }],
  ['settings as an array', makeDoc({}, {}, [])],
  ['fps 0', makeDoc({}, {}, { fps: 0, totalFrames: 10 })],
  ['fps 241', makeDoc({}, {}, { fps: 241, totalFrames: 10 })],
  ['a fractional fps', makeDoc({}, {}, { fps: 24.5, totalFrames: 10 })],
  ['fps as a string', makeDoc({}, {}, { fps: '24', totalFrames: 10 })],
  ['totalFrames 0', makeDoc({}, {}, { fps: 24, totalFrames: 0 })],
  ['an extra setting', makeDoc({}, {}, { fps: 24, totalFrames: 10, loop: true })],
  ['layers as an object', { version: '2.0.0', settings: { fps: 24, totalFrames: 1 }, layers: {} }],
  ['a null node', { version: '2.0.0', settings: { fps: 24, totalFrames: 1 }, layers: [null] }],
  ['a node without type', makeDoc({ type: undefined })],
  ['an unknown node type', makeDoc({ type: 'group' })],
  ['a layer without spans', makeDoc({ spans: undefined })],
  ['a layer without name', makeDoc({ name: undefined })],
  ['an empty id', makeDoc({ id: '' })],
  ['a numeric name', makeDoc({ name: 3 })],
  ['a bad color', makeDoc({ color: 'red' })],
  ['a string visible flag', makeDoc({ visible: 'yes' })],
  ['an empty icon', makeDoc({ icon: '' })],
  ['an extra layer field', makeDoc({ extra: true })],
  ['a folder with spans', { version: '2.0.0', settings: { fps: 24, totalFrames: 1 }, layers: [
    { id: 'f', type: 'folder', name: 'F', children: [], spans: [] }
  ] }],
  ['a folder with a bad child', { version: '2.0.0', settings: { fps: 24, totalFrames: 1 }, layers: [
    { id: 'f', type: 'folder', name: 'F', children: [{ id: 'x', type: 'layer', name: 'X' }] }
  ] }],
  ['a collapsed flag as a number', { version: '2.0.0', settings: { fps: 24, totalFrames: 1 }, layers: [
    { id: 'f', type: 'folder', name: 'F', collapsed: 1, children: [] }
  ] }],
  ['a target with no key', makeDoc({ target: {} })],
  ['a target with two keys', makeDoc({ target: { selector: '#a', ref: 'a' } })],
  ['a string target', makeDoc({ target: '#logo' })],
  ['an element target', makeDoc({ target: { element: {} } })],
  ['an empty selector', makeDoc({ target: { selector: '' } })],
  ['a numeric selector', makeDoc({ target: { selector: 1 } })],
  ['a selector with a stage', makeDoc({ target: { selector: '#a', stage: 'html' } })],
  ['an empty ref', makeDoc({ target: { ref: '' } })],
  ['an empty stage', makeDoc({ target: { ref: 'hero', stage: '' } })],
  ['an extra ref target field', makeDoc({ target: { ref: 'hero', layer: 2 } })],
  ['a span as a string', makeDoc({ spans: ['s1'] })],
  ['a span without kind', makeDoc({}, { kind: undefined })],
  ['an unknown span kind', makeDoc({}, { kind: 'shape' })],
  ['frame 0 as start', makeDoc({}, { start: 0 })],
  ['a fractional end', makeDoc({}, { end: 9.5 })],
  ['an extra span field', makeDoc({}, { duration: 3 })],
  ['a numeric easing', makeDoc({}, { easing: 1 })],
  ['an unknown easing', makeDoc({}, { easing: 'bounce' })],
  ['easing on a static span', makeDoc({}, { kind: 'static', easing: 'linear' })],
  ['tracks on a blank span', makeDoc({}, { kind: 'blank', tracks: {} })],
  ['tracks as an array', makeDoc({}, { tracks: [] })],
  ['a track with a dash', makeDoc({}, track('margin-left'))],
  ['a track with an underscore', makeDoc({}, track('my_value'))],
  ['a __proto__ track', JSON.parse('{"version":"2.0.0","settings":{"fps":24,"totalFrames":10},"layers":[{"id":"l","type":"layer","name":"L","spans":[{"id":"s","start":1,"end":10,"kind":"tween","tracks":{"__proto__":[{"frame":1,"value":1}]}}]}]}')],
  ['a constructor track', makeDoc({}, track('constructor'))],
  ['a prototype track', makeDoc({}, track('prototype'))],
  ['a track as an object', makeDoc({}, { tracks: { x: { frame: 1, value: 1 } } })],
  ['a keyframe as a number', makeDoc({}, { tracks: { x: [1] } })],
  ['a keyframe without value', makeDoc({}, { tracks: { x: [{ frame: 1 }] } })],
  ['frame 0 in a keyframe', makeDoc({}, { tracks: { x: [{ frame: 0, value: 1 }] } })],
  ['a string keyframe value', makeDoc({}, track('x', '1'))],
  ['an extra keyframe field', makeDoc({}, { tracks: { x: [{ frame: 1, value: 1, easing: 'linear' }] } })]
];

function roundTrip(doc: unknown): unknown {
  return JSON.parse(JSON.stringify(doc));
}

describe('ajv and validateDocument agree', () => {
  it.each(VALID)('both accept %s', (_label, doc) => {
    const json = roundTrip(doc);
    expect(ajvValidate(json)).toBe(true);
    expect(validateDocument(json, { allowLiveTargets: false })).toEqual([]);
  });

  it.each(INVALID)('both reject %s', (_label, doc) => {
    const json = roundTrip(doc);
    expect(ajvValidate(json)).toBe(false);
    expect(validateDocument(json, { allowLiveTargets: false }).length).toBeGreaterThan(0);
  });
});
