// packages/runtime/src/stage/html/__tests__/htmlContextSchema.test.ts
import Ajv2020 from 'ajv/dist/2020';
import { readJson } from '../../../model/__tests__/fixtures/schema';
import { cloneHtmlAnimationContext } from '../animationContext';
import type { IHtmlAnimationContext } from '../animationTypes';

const schema = readJson('html-animation-context.schema.json');
if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) throw new Error('HTML context schema must be an object.');
const validate = new Ajv2020({ strict: true, allErrors: true }).compile({ ...schema });

const makeContext = (): IHtmlAnimationContext => ({
  version: 1,
  bindings: { card: {
    alpha: { kind: 'style', cssName: 'opacity' }, position: { kind: 'transform', component: 'x' },
    angle: { kind: 'gradient', gradientId: 'background', component: 'angle' },
    firstColor: { kind: 'gradient', gradientId: 'background', component: 'color', stopId: 'first' }
  } },
  gradients: { card: [{ id: 'background', cssName: 'background-image', type: 'linear', angle: 45,
    centerX: 50, centerY: 50, radiusX: 100, radiusY: 100, stops: [
      { id: 'first', color: { kind: 'color', r: 1, g: 0, b: 0, a: 1 }, opacity: 0.5, position: 0, present: true },
      { id: 'second', color: { kind: 'color', r: 0, g: 0, b: 1, a: 1 }, opacity: 1, position: 100, present: true }
    ] }] },
  resolutions: [{ conflictId: 'conflict', signature: 'current-signature', winnerLayerId: 'card', beforeFirst: 'first-key' }]
});

function acceptsBoth(value: unknown): void {
  expect(validate(value)).toBe(true);
  expect(validate.errors).toBeNull();
  expect(() => cloneHtmlAnimationContext(value)).not.toThrow();
}

test('compiles strictly as draft 2020-12 and accepts detached JSON round trips', () => {
  expect(schema).toMatchObject({ $comment: 'schema/html-animation-context.schema.json', $schema: 'https://json-schema.org/draft/2020-12/schema' });
  acceptsBoth({ version: 1 });
  acceptsBoth(makeContext());
  const roundTrip: unknown = JSON.parse(JSON.stringify(cloneHtmlAnimationContext(makeContext())));
  acceptsBoth(roundTrip);
});

test.each(['initial', 'first-key', 'underlying'])('accepts saved before-first policy %s', (beforeFirst) => {
  acceptsBoth({ version: 1, resolutions: [{ conflictId: 'a', signature: 'b', winnerLayerId: 'card', beforeFirst }] });
});

test.each(['px', '%', 'em', 'rem', 'ex', 'ch', 'lh', 'rlh', 'cap', 'ic', 'rex', 'rch', 'rcap', 'ric',
  'vw', 'vh', 'vmin', 'vmax', 'vi', 'vb', 'svw', 'svh', 'svmin', 'svmax', 'svi', 'svb',
  'lvw', 'lvh', 'lvmin', 'lvmax', 'lvi', 'lvb', 'dvw', 'dvh', 'dvmin', 'dvmax', 'dvi', 'dvb',
  'cm', 'mm', 'q', 'in', 'pt', 'pc', 'deg', 'grad', 'rad', 'turn', 's', 'ms', ''])(
  'agrees with the runtime on unit %s', (unit) => acceptsBoth({ version: 1, bindings: { card: { offset: { kind: 'style', cssName: 'margin-top', unit } } } })
);

test.each<unknown>([
  { version: 2 }, { version: '1' }, { version: 1, unknown: true }, { version: 1, bindings: [] },
  { version: 1, bindings: { '': {} } }, { version: 1, bindings: { card: { '': { kind: 'transform', component: 'x' } } } },
  { version: 1, bindings: { card: { x: { kind: 'transform', component: 'perspective' } } } },
  { version: 1, bindings: { card: { x: { kind: 'style', cssName: 'all' } } } },
  { version: 1, bindings: { card: { x: { kind: 'style', cssName: 'color; opacity' } } } },
  { version: 1, bindings: { card: { x: { kind: 'style', cssName: 'opacity', unit: 'javascript:' } } } },
  { version: 1, bindings: { card: { x: { kind: 'style', cssName: 'opacity', unexpected: 1 } } } },
  { version: 1, bindings: { card: { x: { kind: 'gradient', gradientId: 'g', component: 'color' } } } },
  { version: 1, bindings: { card: { x: { kind: 'gradient', gradientId: 'g', component: 'angle', stopId: 'a' } } } },
  { version: 1, gradients: { card: [{}] } }, { version: 1, resolutions: [{}] },
  { version: 1, resolutions: [{ conflictId: 'a', signature: 'b', winnerLayerId: 'c', beforeFirst: ['first-key'] }] },
  { version: 1, resolutions: [{ conflictId: 'a', signature: 'b', winnerLayerId: 'c', beforeFirst: 'guess' }] },
  JSON.parse('{"version":1,"bindings":{"__proto__":{}}}') as unknown,
  JSON.parse('{"version":1,"bindings":{"card":{"constructor":{"kind":"style","cssName":"color"}}}}') as unknown,
  JSON.parse('{"version":1,"gradients":{"prototype":[]}}') as unknown
])('rejects malformed serialized context in schema and runtime: %p', (value) => {
  expect(validate(value)).toBe(false);
  expect(() => cloneHtmlAnimationContext(value)).toThrow();
});

test('valid identifier strings named after Object members remain safe dictionary keys', () => {
  acceptsBoth({ version: 1, bindings: { toString: { valueOf: { kind: 'style', cssName: 'color' } },
    hasOwnProperty: { toString: { kind: 'style', cssName: 'opacity' } } }, gradients: {} });
});

test('schema shape validation is followed by runtime cross-reference and uniqueness checks', () => {
  const context = makeContext();
  const definition = context.gradients!.card[0];
  const semanticCases: readonly unknown[] = [
    { ...context, gradients: {} },
    { ...context, bindings: { card: { color: { kind: 'gradient', gradientId: 'background', component: 'color', stopId: 'missing' } } } },
    { ...context, gradients: { card: [definition, { ...definition, angle: 90 }] } },
    { ...context, gradients: { card: [{ ...definition, stops: [definition.stops[0], { ...definition.stops[1], id: 'first' }] }] } },
    { ...context, resolutions: [...context.resolutions!, { ...context.resolutions![0], winnerLayerId: 'different' }] }
  ];
  semanticCases.forEach((value) => {
    expect(validate(value)).toBe(true);
    expect(() => cloneHtmlAnimationContext(value)).toThrow();
  });
});

test('gradient geometry and canonical alpha constraints agree with the runtime', () => {
  const context = makeContext();
  const definition = context.gradients!.card[0];
  const invalid = [
    { ...definition, radiusX: -1 },
    { ...definition, stops: definition.stops.slice(0, 1) },
    { ...definition, stops: definition.stops.map((stop) => ({ ...stop, present: false })) },
    { ...definition, stops: definition.stops.map((stop) => ({ ...stop, opacity: 2 })) },
    { ...definition, stops: definition.stops.map((stop) => ({ ...stop, color: { ...stop.color, a: 0.5 } })) }
  ];
  invalid.forEach((gradient) => {
    const value = { ...context, gradients: { card: [gradient] } };
    expect(validate(value)).toBe(false);
    expect(() => cloneHtmlAnimationContext(value)).toThrow();
  });
});
