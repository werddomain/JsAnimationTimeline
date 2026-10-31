// packages/runtime/src/playback/__tests__/parsePlayback.test.ts
import Ajv2020 from 'ajv/dist/2020';
import { readJson } from '../../model/__tests__/fixtures/schema';
import { parsePlayback } from '../parsePlayback';
import { samplePlayback } from '../samplePlayback';
import { compilePlayback } from '../compilePlayback';
import { parsedFixture, documentWith, timeline } from './fixtures';

const accepts = (input: unknown): boolean => { try { parsePlayback(input); return true; } catch { return false; } };

describe('playback input boundary', () => {
  it('creates frozen data and prototype-free dictionaries while samples remain detached', () => {
    const source = parsedFixture();
    const parsed = parsePlayback(source);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.frames['1'].object.values.gain)).toBe(true);
    expect(Object.getPrototypeOf(parsed.frames)).toBeNull();
    expect(Object.getPrototypeOf(parsed.objects)).toBeNull();
    expect(parsed).not.toBe(source);
    const sample = samplePlayback(parsed, 1);
    Reflect.set(sample.object.values.gain, 'value', 99);
    expect(samplePlayback(parsed, 1).object.values.gain).toEqual({ kind: 'number', value: 1 });
  });

  it('never executes getters or toJSON at reader or compiler boundaries', () => {
    const getter = jest.fn(() => 1);
    const source = { ...parsedFixture() };
    Object.defineProperty(source, 'version', { get: getter, enumerable: true });
    expect(accepts(source)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    const toJSON = jest.fn(() => parsedFixture());
    expect(accepts({ ...parsedFixture(), toJSON })).toBe(false);
    expect(toJSON).not.toHaveBeenCalled();
    const input = documentWith({ x: timeline(0, 1, 20) });
    Object.defineProperty(input, 'version', { get: getter, enumerable: true });
    expect(compilePlayback(input).status).toBe('refused');
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects the reserved field %s without pollution', (name) => {
    const source = JSON.parse(JSON.stringify(parsedFixture())) as Record<string, unknown>;
    Object.defineProperty(source, name, { value: { polluted: true }, enumerable: true });
    expect(accepts(source)).toBe(false);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('rejects cycles, functions, symbols, sparse arrays, inherited fields and hidden data', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(accepts(cycle)).toBe(false);
    expect(accepts({ ...parsedFixture(), [Symbol('hidden')]: 1 })).toBe(false);
    expect(accepts(Object.create(parsedFixture()))).toBe(false);
    const hidden = { ...parsedFixture() };
    Object.defineProperty(hidden, 'hidden', { value: 1 });
    expect(accepts(hidden)).toBe(false);
    expect(accepts({ ...parsedFixture(), frames: new Array<unknown>(2) })).toBe(false);
    let deep: unknown = {};
    for (let index = 0; index < 66; index++) deep = { child: deep };
    expect(accepts(deep)).toBe(false);
  });

  it('requires dense frame/object/property snapshots and stable value kinds', () => {
    const source = parsedFixture();
    expect(accepts({ ...source, frames: { '1': source.frames['1'] } })).toBe(false);
    expect(accepts({ ...source, frames: { '01': source.frames['1'], '2': source.frames['2'] } })).toBe(false);
    expect(accepts({ ...source, frames: { ...source.frames, '2': {} } })).toBe(false);
    expect(accepts({ ...source, frames: { ...source.frames, '2': { unknown: source.frames['2'].object } } })).toBe(false);
    expect(accepts({ ...source, frames: { ...source.frames, '2': { object: { active: true, values: {} } } } })).toBe(false);
    expect(accepts({ ...source, frames: { ...source.frames, '2': { object: { active: true, values: { gain: { kind: 'text', value: '2' } } } } } })).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite values %s before lookup', (value) => {
    const source = parsedFixture();
    expect(accepts({ ...source, frames: { ...source.frames, '2': { object: { active: true, values: { gain: { kind: 'number', value } } } } } })).toBe(false);
    expect(() => samplePlayback(source, value)).toThrow('fini');
  });
});

describe('playback JSON schema and runtime shape agreement', () => {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(readJson('playback-document.schema.json') as Record<string, unknown>);
  const source = parsedFixture();
  const invalidShapes: unknown[] = [
    null, [], {}, { ...source, version: 2 }, { ...source, sampling: 'linear' },
    { ...source, fps: 0 }, { ...source, fps: 2.5 }, { ...source, fps: 241 }, { ...source, totalFrames: 0 },
    { ...source, totalFrames: 100_001 }, { ...source, unknown: true },
    { ...source, objects: { object: { name: 'Object', target: { element: {} } } } },
    { ...source, objects: { object: { name: 'Object', target: { selector: '', ref: 'object' } } } },
    { ...source, objects: { object: { name: 'Object', target: { ref: '' } } } },
    { ...source, objects: { object: { name: 'Object', target: { ref: 'object', stage: '' } } } },
    { ...source, objects: { '': { name: 'Object' } } },
    { ...source, frames: { ...source.frames, '2': { object: { active: 1, values: {} } } } },
    ...[
      { kind: 'number', value: '1' }, { kind: 'boolean', value: 'true' }, { kind: 'text', value: false },
      { kind: 'color', r: 1.1, g: 0, b: 0, a: 1 }, { kind: 'color', r: 1, g: 0, b: 0 },
      { kind: 'number', value: 1, extra: true }, { kind: 'invalid', value: 1 }
    ].map((gain) => ({ ...source, frames: { ...source.frames, '2': { object: { active: true, values: { gain } } } } }))
  ];

  it.each(invalidShapes.map((data, index) => ({ index, data })))('rejects malformed shape $index in both validators', ({ data }) => {
    expect(validate(data)).toBe(false);
    expect(accepts(data)).toBe(false);
  });
  it('accepts all value variants and prototype-like valid property names', () => {
    const values = { gain: { kind: 'number', value: 1 }, label: { kind: 'text', value: '</script>\n"🌈' }, enabled: { kind: 'boolean', value: true }, color: { kind: 'color', r: 0.5, g: 0, b: 1, a: 0.2 }, toString: { kind: 'number', value: 2 } };
    const candidate = { ...source, frames: { '1': { object: { active: true, values } }, '2': { object: { active: false, values } } } };
    expect(validate(candidate)).toBe(true);
    expect(accepts(candidate)).toBe(true);
  });
});
