// packages/runtime/src/model/__tests__/schema.test.ts
/**
 * The JSON schema compiles in strict mode, accepts the examples, rejects
 * malformed documents and agrees with the TypeScript constants.
 */

import { SCHEMA_VERSION } from '../document';
import { CUBIC_BEZIER_PATTERN, EASING_PRESETS } from '../easing';
import { compileSchema, EXAMPLE_NAMES, readExample, readSchema } from './fixtures/schema';

const validate = compileSchema();

/** Minimal valid document whose single layer and span can be overridden. */
function makeDoc(layerPatch: Record<string, unknown> = {}, spanPatch: Record<string, unknown> = {}): unknown {
  return {
    version: '2.0.0',
    settings: { fps: 24, totalFrames: 10 },
    layers: [
      {
        id: 'l1',
        type: 'layer',
        name: 'Layer',
        spans: [{ id: 's1', start: 1, end: 10, kind: 'tween', ...spanPatch }],
        ...layerPatch
      }
    ]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `anyOf` branches of `$defs.Easing`. */
function easingBranches(): readonly Record<string, unknown>[] {
  const defs = readSchema()['$defs'];
  const easing = isRecord(defs) ? defs['Easing'] : undefined;
  const anyOf = isRecord(easing) ? easing['anyOf'] : undefined;
  if (!Array.isArray(anyOf)) {
    throw new Error('$defs.Easing.anyOf missing');
  }
  return anyOf.filter(isRecord);
}

describe('timeline.schema.json', () => {
  it('compiles with Ajv 2020 in strict mode', () => {
    expect(typeof validate).toBe('function');
  });

  it('has the expected $id and draft', () => {
    const schema = readSchema();
    expect(schema['$id']).toBe('https://github.com/werddomain/JsAnimationTimeline/schema/timeline.schema.json');
    expect(schema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it.each(EXAMPLE_NAMES)('accepts example %s', (name) => {
    expect(validate(readExample(name))).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts the base document used by the negative tests', () => {
    expect(validate(makeDoc())).toBe(true);
  });

  it('accepts SCHEMA_VERSION and rejects other majors', () => {
    const doc = (version: string): unknown => ({ version, settings: { fps: 24, totalFrames: 1 }, layers: [] });
    expect(validate(doc(SCHEMA_VERSION))).toBe(true);
    expect(validate(doc('2.13.0'))).toBe(true);
    expect(validate(doc('1.0.0'))).toBe(false);
    expect(validate(doc('2.0'))).toBe(false);
  });

  it.each<[string, unknown]>([
    ['an unknown type discriminator', makeDoc({ type: 'group' })],
    ['a folder discriminator on a layer', makeDoc({ type: 'folder' })],
    ['easing on a static span', makeDoc({}, { kind: 'static', easing: 'linear' })],
    ['easing on a blank span', makeDoc({}, { kind: 'blank', easing: 'linear' })],
    ['tracks on a blank span', makeDoc({}, { kind: 'blank', tracks: {} })],
    ['a bad color', makeDoc({ color: '#12345' })],
    ['a named color', makeDoc({ color: 'red' })],
    ['an extra layer property', makeDoc({ extra: true })],
    ['an extra span property', makeDoc({}, { duration: 3 })],
    ['frame 0 as span start', makeDoc({}, { start: 0 })],
    ['frame 0 in a keyframe', makeDoc({}, { tracks: { x: [{ frame: 0, value: 1 }] } })],
    ['an extra keyframe property', makeDoc({}, { tracks: { x: [{ frame: 1, value: 1, easing: 'linear' }] } })],
    ['a non-integer frame', makeDoc({}, { end: 9.5 })],
    ['an invalid track name', makeDoc({}, { tracks: { 'margin-left': [{ frame: 1, value: 1 }] } })],
    ['a string keyframe value', makeDoc({}, { tracks: { x: [{ frame: 1, value: '1' }] } })],
    ['an unknown easing', makeDoc({}, { easing: 'bounce' })],
    ['a cubic-bezier with 3 numbers', makeDoc({}, { easing: 'cubic-bezier(0, 0, 1)' })],
    ['an unknown span kind', makeDoc({}, { kind: 'shape' })],
    ['an element target', makeDoc({ target: { element: {} } })],
    ['an empty selector', makeDoc({ target: { selector: '' } })],
    ['an empty icon', makeDoc({ icon: '' })],
    ['an empty id', makeDoc({ id: '' })],
    ['a missing spans array', makeDoc({ spans: undefined })]
  ])('rejects %s', (_label, doc) => {
    expect(validate(JSON.parse(JSON.stringify(doc)))).toBe(false);
  });

  it('accepts easing on tween spans and tracks on static spans', () => {
    expect(validate(makeDoc({}, { easing: 'cubic-bezier(0.1,0.2,0.3,0.4)' }))).toBe(true);
    expect(validate(makeDoc({}, { kind: 'static', tracks: { x: [{ frame: 1, value: 1 }] } }))).toBe(true);
    expect(validate(makeDoc({ color: '#ABCdef' }))).toBe(true);
  });

  it('rejects out-of-range settings', () => {
    const doc = (settings: unknown): unknown => ({ version: '2.0.0', settings, layers: [] });
    expect(validate(doc({ fps: 0, totalFrames: 1 }))).toBe(false);
    expect(validate(doc({ fps: 241, totalFrames: 1 }))).toBe(false);
    expect(validate(doc({ fps: 24.5, totalFrames: 1 }))).toBe(false);
    expect(validate(doc({ fps: 24, totalFrames: 0 }))).toBe(false);
    expect(validate(doc({ fps: 24, totalFrames: 1, loop: true }))).toBe(false);
  });

  it('rejects an extra property on a folder or the root', () => {
    const settings = { fps: 24, totalFrames: 1 };
    const folder = { id: 'f', type: 'folder', name: 'F', children: [], spans: [] };
    expect(validate({ version: '2.0.0', settings, layers: [folder] })).toBe(false);
    expect(validate({ version: '2.0.0', settings, layers: [], meta: {} })).toBe(false);
  });

  it('lists the same easing presets as EASING_PRESETS', () => {
    expect(easingBranches()[0]['enum']).toEqual(EASING_PRESETS);
  });

  it('uses a cubic-bezier pattern equivalent to CUBIC_BEZIER_PATTERN', () => {
    const schemaPattern = new RegExp(String(easingBranches()[1]['pattern']), 'u');
    const samples = [
      'cubic-bezier(0,0,1,1)', 'cubic-bezier( 0.1 , -2 , .3 , +4.5 )', 'cubic-bezier(0, 0, 1)',
      'cubic-bezier(a, 0, 1, 1)', 'cubic-bezier(1., 0, 1, 1)', ' cubic-bezier(0,0,1,1)', 'cubic-bezier(0,0,1,1,1)'
    ];
    for (const sample of samples) {
      expect(schemaPattern.test(sample)).toBe(CUBIC_BEZIER_PATTERN.test(sample));
    }
  });
});
