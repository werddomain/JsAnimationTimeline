// packages/runtime/src/properties/__tests__/valueProperties.test.ts
/**
 * `value` properties (no CSS name), label and group, and the ready-made
 * interpolators.
 */

import { computeCssDeclarations } from '../compose';
import { floorInterpolator, interpolators, roundInterpolator, stepInterpolator } from '../interpolators';
import { assertValidDescriptor, createPropertyRegistry } from '../PropertyRegistry';
import { isCssProperty } from '../types';
import type { IValuePropertyDescriptor, PropertyDescriptor } from '../types';
import { interpolateValue, lerp } from '../values';

const FRAME_INDEX: IValuePropertyDescriptor = {
  name: 'frameIndex', kind: 'value', unit: '', defaultValue: 0, label: 'Image', group: 'Sprite', interpolate: floorInterpolator
};
const VOLUME: IValuePropertyDescriptor = { name: 'volume', kind: 'value', unit: '%', defaultValue: 100, min: 0, max: 100 };

describe('interpolators', () => {
  it('step holds the start value until t reaches 1', () => {
    expect([0, 0.5, 0.999, 1, 1.2].map((t) => stepInterpolator(2, 8, t))).toEqual([2, 2, 2, 8, 8]);
    expect(stepInterpolator(2, 8, -0.5)).toBe(2);
  });

  it('floor and round round the linear value', () => {
    expect(floorInterpolator(0, 11, 0.5)).toBe(5);
    expect(roundInterpolator(0, 11, 0.5)).toBe(6);
    expect(floorInterpolator(0, -3, 0.5)).toBe(-2);
    expect(roundInterpolator(0, 10, 0.24)).toBe(2);
  });

  it('are reachable by name in a frozen table', () => {
    expect(interpolators).toEqual({ linear: lerp, step: stepInterpolator, floor: floorInterpolator, round: roundInterpolator });
    expect(Object.isFrozen(interpolators)).toBe(true);
    expect(interpolateValue({ ...VOLUME, interpolate: interpolators.step }, 0, 50, 0.5)).toBe(0);
  });
});

describe('value properties in the registry', () => {
  it('registers value properties next to the built-ins, without CSS checks', () => {
    const registry = createPropertyRegistry([FRAME_INDEX, VOLUME]);
    expect(registry.require('frameIndex')).toEqual(FRAME_INDEX);
    expect(registry.require('volume').cssName).toBeUndefined();
    expect(registry.transformProperties().map((d) => d.name)).not.toContain('frameIndex');
  });

  it('does not apply cssName uniqueness to value properties', () => {
    const registry = createPropertyRegistry([FRAME_INDEX]);
    expect(() => registry.register({ ...VOLUME, name: 'pan' })).not.toThrow();
    expect(() => registry.register({ ...FRAME_INDEX })).toThrow('Property "frameIndex" is already registered.');
  });

  it('refuses a value property with a cssName', () => {
    const descriptor = { ...VOLUME, cssName: 'volume' } as unknown as PropertyDescriptor;
    expect(() => assertValidDescriptor(descriptor)).toThrow('a value property has no cssName');
  });

  it('keeps label and group on CSS properties too', () => {
    const registry = createPropertyRegistry([
      { name: 'borderRadius', kind: 'style', cssName: 'border-radius', unit: 'px', defaultValue: 0, label: 'Radius', group: 'Box' }
    ]);
    expect(registry.require('borderRadius')).toMatchObject({ label: 'Radius', group: 'Box' });
  });

  it('tells CSS properties from value properties', () => {
    const registry = createPropertyRegistry([VOLUME]);
    expect(isCssProperty(registry.require('x'))).toBe(true);
    expect(isCssProperty(registry.require('opacity'))).toBe(true);
    expect(isCssProperty(registry.require('volume'))).toBe(false);
  });
});

describe('computeCssDeclarations with value properties', () => {
  const registry = createPropertyRegistry([FRAME_INDEX, VOLUME]);

  it('ignores value properties', () => {
    expect(computeCssDeclarations({ frameIndex: 3, volume: 50 }, registry)).toEqual({});
    expect(computeCssDeclarations({ frameIndex: 3, opacity: 0.5 }, registry)).toEqual({ opacity: '0.5' });
  });

  it('still throws for unknown names', () => {
    expect(() => computeCssDeclarations({ pitch: 1 }, registry)).toThrow('Unknown property "pitch"');
  });
});
