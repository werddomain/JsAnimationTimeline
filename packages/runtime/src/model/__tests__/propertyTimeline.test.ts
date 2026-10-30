// packages/runtime/src/model/__tests__/propertyTimeline.test.ts
import { checkDocumentShape, validateDocument } from '..';
import { compileSchema } from './fixtures/schema';

const number = (value: number) => ({ kind: 'number', value });
const key = (frame: number, value: number) => ({ frame, value: number(value) });
const track = () => ({ initialValue: number(0), keys: [key(1, 0), key(50, 50), key(100, 100)] });
const document = (propertyTimelines: unknown, spans: unknown[] = []) => ({
  version: '2.0.0', settings: { fps: 24, totalFrames: 100 },
  layers: [{ id: 'layer', type: 'layer', name: 'Object', spans, propertyTimelines }]
});

describe('independent typed property timelines', () => {
  const schema = compileSchema();

  it('accepts independent typed values without modifying legacy examples', () => {
    const value = document({
      x: { ...track(), beforeFirst: 'initial', label: 'X', group: 'Transform', transitions: [{ id: 'move', fromFrame: 1, toFrame: 50 }] },
      caption: { initialValue: { kind: 'text', value: '' }, keys: [{ frame: 10, value: { kind: 'text', value: 'Hello' } }] },
      enabled: { initialValue: { kind: 'boolean', value: true }, keys: [] },
      color: { initialValue: { kind: 'color', r: 0, g: 0.5, b: 1, a: 1 }, keys: [] }
    });
    expect(schema(value)).toBe(true);
    expect(validateDocument(value)).toEqual([]);
  });

  it('accepts a preserved curve source and parameterized easing', () => {
    const value = document({ x: { ...track(), transitions: [{
      id: 'slice', fromFrame: 1, toFrame: 50,
      easing: { kind: 'effect', family: 'elastic', mode: 'out', parameters: { oscillations: 3, springiness: 4 } },
      source: { start: 1, end: 100, keys: [key(1, 0), key(100, 100)], easing: { kind: 'bezier', x1: 0.2, y1: -1, x2: 0.8, y2: 2 } }
    }] } });
    expect(schema(value)).toBe(true);
    expect(validateDocument(value)).toEqual([]);
  });

  it.each([
    ['linear', {}], ['sine', {}], ['circle', {}], ['quadratic', {}], ['cubic', {}],
    ['quartic', {}], ['quintic', {}], ['power', { power: 0.1 }],
    ['exponential', { exponent: 30 }], ['back', { amplitude: 10 }],
    ['bounce', { bounces: 32, bounciness: 1 }], ['elastic', { oscillations: 0, springiness: 30 }]
  ])('keeps schema and runtime aligned for effect family %s', (family, parameters) => {
    const value = document({ x: { ...track(), transitions: [{
      id: 'effect', fromFrame: 1, toFrame: 50, easing: { kind: 'effect', family, mode: 'in-out', parameters }
    }] } });
    expect(schema(value)).toBe(true);
    expect(checkDocumentShape(value)).toEqual([]);
  });

  it('never inserts defaults or mutates the property document during validation', () => {
    const value = document({ x: track() });
    const original = JSON.stringify(value);
    expect(validateDocument(value)).toEqual([]);
    expect(JSON.stringify(value)).toBe(original);
  });

  it.each([
    ['unknown track field', { x: { ...track(), extra: true } }],
    ['reserved property', { constructor: track() }],
    ['invalid property name', { 'margin-top': track() }],
    ['unknown value field', { x: { initialValue: { ...number(0), extra: true }, keys: [] } }],
    ['out-of-range color', { x: { initialValue: { kind: 'color', r: 2, g: 0, b: 0, a: 1 }, keys: [] } }],
    ['unknown value kind', { x: { initialValue: { kind: 'object', value: {} }, keys: [] } }],
    ['invalid first-key policy', { x: { ...track(), beforeFirst: 'hold' } }],
    ['invalid easing parameter', { x: { ...track(), transitions: [{ id: 'bad', fromFrame: 1, toFrame: 50, easing: { kind: 'effect', family: 'power', mode: 'in', parameters: { power: 0 } } }] } }],
    ['parameter from another family', { x: { ...track(), transitions: [{ id: 'bad', fromFrame: 1, toFrame: 50, easing: { kind: 'effect', family: 'sine', mode: 'in', parameters: { amplitude: 1 } } }] } }],
    ['non-finite value', { x: { initialValue: number(Infinity), keys: [] } }]
  ])('rejects malformed shape: %s', (_label, tracks) => {
    const value = document(tracks);
    expect(schema(value)).toBe(false);
    expect(checkDocumentShape(value).length).toBeGreaterThan(0);
  });

  it.each([
    ['unordered keys', { x: { ...track(), keys: [key(50, 50), key(1, 0)] } }],
    ['duplicate keys', { x: { ...track(), keys: [key(1, 0), key(1, 1)] } }],
    ['key past duration', { x: { ...track(), keys: [key(101, 0)] } }],
    ['missing endpoint', { x: { ...track(), transitions: [{ id: 'bad', fromFrame: 1, toFrame: 30 }] } }],
    ['non-consecutive endpoints', { x: { ...track(), transitions: [{ id: 'bad', fromFrame: 1, toFrame: 100 }] } }],
    ['backward transition', { x: { ...track(), transitions: [{ id: 'bad', fromFrame: 50, toFrame: 1 }] } }],
    ['duplicate transition', { x: { ...track(), transitions: [{ id: 'one', fromFrame: 1, toFrame: 50 }, { id: 'two', fromFrame: 1, toFrame: 50 }] } }],
    ['duplicate id', { x: { ...track(), transitions: [{ id: 'layer', fromFrame: 1, toFrame: 50 }] } }],
    ['discrete tween', { caption: { initialValue: { kind: 'text', value: '' }, keys: [{ frame: 1, value: { kind: 'text', value: 'a' } }, { frame: 50, value: { kind: 'text', value: 'b' } }], transitions: [{ id: 'bad', fromFrame: 1, toFrame: 50 }] } }],
    ['incompatible kinds', { x: { ...track(), keys: [key(1, 0), { frame: 50, value: { kind: 'boolean', value: true } }] } }],
    ['source does not cover transition', { x: { ...track(), transitions: [{ id: 'bad', fromFrame: 1, toFrame: 50, source: { start: 10, end: 100, keys: [key(10, 0), key(100, 100)] } }] } }],
    ['source keys omit boundaries', { x: { ...track(), transitions: [{ id: 'bad', fromFrame: 1, toFrame: 50, source: { start: 1, end: 100, keys: [key(1, 0), key(50, 50)] } }] } }]
  ])('rejects invalid semantics: %s', (_label, tracks) => {
    const value = document(tracks);
    expect(checkDocumentShape(value)).toEqual([]);
    expect(validateDocument(value).length).toBeGreaterThan(0);
  });

  it('rejects two timelines for the same property while allowing distinct legacy tracks', () => {
    const spans = [{ id: 'span', start: 1, end: 100, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } }];
    expect(validateDocument(document({ x: track() }, spans)).length).toBeGreaterThan(0);
    expect(validateDocument(document({ y: track() }, spans))).toEqual([]);
  });
});
