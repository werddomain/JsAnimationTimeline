// packages/runtime/src/properties/__tests__/PropertyRegistry.test.ts
/**
 * Property registry: built-ins, registration rules, lookup and transform order.
 */

import { BUILTIN_PROPERTIES, BUILTIN_PROPERTY_NAMES } from '../builtins';
import {
  assertValidDescriptor,
  createPropertyRegistry,
  defaultPropertyRegistry,
  PropertyRegistry,
  registerProperty
} from '../PropertyRegistry';
import type { PropertyDescriptor } from '../types';

const BORDER_RADIUS: PropertyDescriptor = {
  name: 'borderRadius', kind: 'style', cssName: 'border-radius', unit: 'px', defaultValue: 0
};

describe('built-in properties', () => {
  it('lists the v1 properties', () => {
    expect(BUILTIN_PROPERTY_NAMES).toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'skewY', 'opacity']);
  });

  it('has CSS defaults (identity transform, opaque)', () => {
    const defaults = Object.fromEntries(BUILTIN_PROPERTIES.map((d) => [d.name, d.defaultValue]));
    expect(defaults).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, opacity: 1 });
  });

  it('bounds opacity to [0, 1]', () => {
    const opacity = BUILTIN_PROPERTIES.find((d) => d.name === 'opacity');
    expect(opacity).toMatchObject({ kind: 'style', cssName: 'opacity', min: 0, max: 1 });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(BUILTIN_PROPERTIES)).toBe(true);
    expect(BUILTIN_PROPERTIES.every((d) => Object.isFrozen(d))).toBe(true);
  });

  it('are all valid descriptors', () => {
    for (const descriptor of BUILTIN_PROPERTIES) {
      expect(() => assertValidDescriptor(descriptor)).not.toThrow();
    }
  });
});

describe('PropertyRegistry', () => {
  it('starts empty without arguments', () => {
    expect(new PropertyRegistry().list()).toEqual([]);
  });

  it('holds the built-ins when created with createPropertyRegistry', () => {
    const registry = createPropertyRegistry();
    expect(registry.list().map((d) => d.name)).toEqual(BUILTIN_PROPERTY_NAMES);
    expect(registry.has('x')).toBe(true);
    expect(registry.get('rotation')).toMatchObject({ cssName: 'rotate', unit: 'deg' });
  });

  it('accepts extra properties at creation', () => {
    const registry = createPropertyRegistry([BORDER_RADIUS]);
    expect(registry.require('borderRadius')).toEqual(BORDER_RADIUS);
  });

  it('registers a plugin property and stores a frozen copy', () => {
    const source = { ...BORDER_RADIUS };
    const registry = createPropertyRegistry().register(source);
    const stored = registry.require('borderRadius');
    expect(stored).toEqual(source);
    expect(stored).not.toBe(source);
    expect(Object.isFrozen(stored)).toBe(true);
  });

  it('refuses a duplicate name', () => {
    expect(() => createPropertyRegistry().register({ ...BORDER_RADIUS, name: 'x' }))
      .toThrow('Property "x" is already registered.');
  });

  it('returns undefined from get and throws from require for an unknown name', () => {
    const registry = createPropertyRegistry();
    expect(registry.get('width')).toBeUndefined();
    expect(registry.has('width')).toBe(false);
    expect(() => registry.require('width')).toThrow('Unknown property "width"');
  });

  it('unregisters a property', () => {
    const registry = createPropertyRegistry([BORDER_RADIUS]);
    expect(registry.unregister('borderRadius')).toBe(true);
    expect(registry.unregister('borderRadius')).toBe(false);
    expect(registry.has('borderRadius')).toBe(false);
  });

  it('clones without sharing later registrations', () => {
    const original = createPropertyRegistry();
    const copy = original.clone().register(BORDER_RADIUS);
    expect(copy.has('borderRadius')).toBe(true);
    expect(original.has('borderRadius')).toBe(false);
  });

  it('orders transform properties by step then name, whatever the registration order', () => {
    const registry = new PropertyRegistry([
      { name: 'skewX', kind: 'transform', step: 'skew', cssName: 'skewX', unit: 'deg', defaultValue: 0 },
      { name: 'z', kind: 'transform', step: 'translate', cssName: 'translateZ', unit: 'px', defaultValue: 0 },
      { name: 'scale', kind: 'transform', step: 'scale', cssName: 'scale', unit: '', defaultValue: 1 },
      { name: 'rotation', kind: 'transform', step: 'rotate', cssName: 'rotate', unit: 'deg', defaultValue: 0 },
      { name: 'x', kind: 'transform', step: 'translate', cssName: 'translateX', unit: 'px', defaultValue: 0 },
      BORDER_RADIUS
    ]);
    expect(registry.transformProperties().map((d) => d.name)).toEqual(['x', 'z', 'rotation', 'scale', 'skewX']);
  });

  it('keeps the same transform order after unregister and register', () => {
    const registry = createPropertyRegistry();
    const x = registry.require('x');
    registry.unregister('x');
    registry.register(x);
    expect(registry.transformProperties().map((d) => d.name))
      .toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'skewY']);
  });

  it('refuses two properties writing the same CSS', () => {
    expect(() => createPropertyRegistry().register({ ...BORDER_RADIUS, name: 'alpha', cssName: 'opacity' }))
      .toThrow('Property "alpha" writes opacity, already written by "opacity".');
  });
});

describe('assertValidDescriptor', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['an empty name', { name: '' }, 'the name must be letters and digits'],
    ['a name with a dash', { name: 'border-radius' }, 'the name must be letters and digits'],
    ['a name with an underscore', { name: 'border_radius' }, 'the name must be letters and digits'],
    ['a name with a dollar', { name: '$x' }, 'the name must be letters and digits'],
    ['a name starting with a digit', { name: '1x' }, 'the name must be letters and digits'],
    ['the name __proto__', { name: '__proto__' }, 'the name must be letters and digits'],
    ['the name constructor', { name: 'constructor' }, '"constructor" and "prototype" are reserved'],
    ['the name prototype', { name: 'prototype' }, '"constructor" and "prototype" are reserved'],
    ['a non-string label', { label: 3 }, 'label and group must be strings'],
    ['a non-string group', { group: false }, 'label and group must be strings'],
    ['an unknown kind', { kind: 'color' }, 'unknown kind "color"'],
    ['an empty cssName', { cssName: '' }, 'cssName must be a CSS identifier'],
    ['a cssName with spaces', { cssName: 'border radius' }, 'cssName must be a CSS identifier'],
    ['a non-string unit', { unit: 3 }, 'unit must be a string'],
    ['a NaN default', { defaultValue: Number.NaN }, 'defaultValue must be a finite number'],
    ['min above max', { min: 2, max: 1 }, 'min is greater than max'],
    ['a NaN min', { min: Number.NaN }, 'min and max must be finite numbers'],
    ['a non-function interpolate', { interpolate: 'linear' }, 'interpolate must be a function'],
    ['a style named transform', { cssName: 'transform' }, 'cssName "transform" is reserved'],
    ['a style named __proto__', { cssName: '__proto__' }, 'cssName "__proto__" is reserved']
  ];

  it.each(cases)('rejects %s', (_label, override, message) => {
    const descriptor = { ...BORDER_RADIUS, ...override } as unknown as PropertyDescriptor;
    expect(() => assertValidDescriptor(descriptor)).toThrow(message);
  });

  it('rejects a transform without a valid step', () => {
    const descriptor = { name: 'z', kind: 'transform', step: 'perspective', cssName: 'translateZ', unit: 'px', defaultValue: 0 };
    expect(() => assertValidDescriptor(descriptor as unknown as PropertyDescriptor))
      .toThrow('step must be one of translate, rotate, scale, skew');
  });

  it('rejects a transform whose cssName is not a transform function', () => {
    const descriptor: PropertyDescriptor = { name: 'w', kind: 'transform', step: 'scale', cssName: 'width', unit: 'px', defaultValue: 0 };
    expect(() => assertValidDescriptor(descriptor)).toThrow('cssName must be a CSS transform function');
  });

  it.each([null, undefined])('rejects %p with a clear message', (value) => {
    expect(() => assertValidDescriptor(value as unknown as PropertyDescriptor)).toThrow('a descriptor must be an object');
  });

  it('accepts a vendor-prefixed cssName', () => {
    expect(() => assertValidDescriptor({ ...BORDER_RADIUS, cssName: '-webkit-text-stroke-width' })).not.toThrow();
  });
});

describe('default registry', () => {
  afterEach(() => {
    defaultPropertyRegistry.unregister('letterSpacing');
  });

  it('holds the built-ins', () => {
    expect(defaultPropertyRegistry.list().map((d) => d.name)).toEqual(BUILTIN_PROPERTY_NAMES);
  });

  it('receives properties from registerProperty', () => {
    registerProperty({ name: 'letterSpacing', kind: 'style', cssName: 'letter-spacing', unit: 'px', defaultValue: 0 });
    expect(defaultPropertyRegistry.require('letterSpacing').cssName).toBe('letter-spacing');
  });
});
