// packages/runtime/src/model/__tests__/legacyPropertySource.test.ts
import { checkDocumentShape, validateDocument } from '..';
import { compileSchema } from './fixtures/schema';

const key = (frame: number, value: number) => ({ frame, value: { kind: 'number', value } });
const source = { start: 1, end: 100, keys: [key(1, 0), key(100, 100)], legacyEasing: 'ease-in' };
const document = (curve: unknown) => ({ version: '2.0.0', settings: { fps: 24, totalFrames: 100 }, layers: [
  { id: 'object', type: 'layer', name: 'Object', spans: [], propertyTimelines: { x: {
    initialValue: { kind: 'number', value: 0 }, keys: [key(1, 0), key(100, 100)],
    transitions: [{ id: 'motion', fromFrame: 1, toFrame: 100, source: curve }]
  } } }
] });

describe('legacy source schema and guards', () => {
  const schema = compileSchema();
  it('accepts an explicit legacy numeric source', () => {
    expect(schema(document(source))).toBe(true);
    expect(validateDocument(document(source))).toEqual([]);
  });
  it.each([
    ['both easing representations', { ...source, easing: { kind: 'effect', family: 'linear', mode: 'in' } }],
    ['invalid string', { ...source, legacyEasing: 'bounce' }],
    ['nonstring easing', { ...source, legacyEasing: 4 }],
    ['nonnumeric source', { ...source, keys: [{ frame: 1, value: { kind: 'text', value: 'hello' } }, { frame: 100, value: { kind: 'text', value: 'bye' } }] }]
  ])('rejects %s in schema and shape', (_label, curve) => {
    expect(schema(document(curve))).toBe(false);
    expect(checkDocumentShape(document(curve)).length).toBeGreaterThan(0);
  });
  it('rejects out-of-range legacy Bézier coordinates semantically', () => {
    expect(validateDocument(document({ ...source, legacyEasing: 'cubic-bezier(2, 0, 0, 1)' })).length).toBeGreaterThan(0);
  });
});
