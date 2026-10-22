// packages/runtime/src/properties/__tests__/compose.test.ts
/**
 * Composition of the transform string and of the CSS declarations.
 */

import { composeTransform, computeCssDeclarations, cssNameToCamelCase } from '../compose';
import { createPropertyRegistry } from '../PropertyRegistry';

const IDENTITY = 'translateX(0px) translateY(0px) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg)';

describe('composeTransform', () => {
  const registry = createPropertyRegistry();

  it('writes every transform with its default when values are empty', () => {
    expect(composeTransform({}, registry)).toBe(IDENTITY);
  });

  it('always uses the order translate → rotate → scale → skew', () => {
    const values = { skewY: 5, scaleY: 2, rotation: 90, y: -10, skewX: 1, scaleX: 0.5, x: 20 };
    expect(composeTransform(values, registry))
      .toBe('translateX(20px) translateY(-10px) rotate(90deg) scaleX(0.5) scaleY(2) skewX(1deg) skewY(5deg)');
  });

  it('ignores style properties', () => {
    expect(composeTransform({ opacity: 0.5 }, registry)).toBe(IDENTITY);
  });

  it('places a plugin transform at its step', () => {
    const withZ = createPropertyRegistry([
      { name: 'z', kind: 'transform', step: 'translate', cssName: 'translateZ', unit: 'px', defaultValue: 0 }
    ]);
    expect(composeTransform({ z: 4 }, withZ))
      .toBe('translateX(0px) translateY(0px) translateZ(4px) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg)');
  });

  it('can be applied to an element as is', () => {
    const element = document.createElement('div');
    element.style.transform = composeTransform({ x: 10, rotation: 45 }, registry);
    expect(element.style.transform).toContain('translateX(10px)');
    expect(element.style.transform).toContain('rotate(45deg)');
  });
});

describe('computeCssDeclarations', () => {
  const registry = createPropertyRegistry([
    { name: 'borderRadius', kind: 'style', cssName: 'border-radius', unit: 'px', defaultValue: 0 }
  ]);

  it('returns nothing for empty values', () => {
    expect(computeCssDeclarations({}, registry)).toEqual({});
  });

  it('writes only style properties when no transform is animated', () => {
    expect(computeCssDeclarations({ opacity: 0.25, borderRadius: 8 }, registry))
      .toEqual({ 'opacity': '0.25', 'border-radius': '8px' });
  });

  it('writes the full transform as soon as one transform property is present', () => {
    expect(computeCssDeclarations({ x: 100, opacity: 0.5 }, registry)).toEqual({
      transform: 'translateX(100px) translateY(0px) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg)',
      opacity: '0.5'
    });
  });

  it('applies bounds', () => {
    expect(computeCssDeclarations({ opacity: 2 }, registry)).toEqual({ opacity: '1' });
  });

  it('throws for an unknown property', () => {
    expect(() => computeCssDeclarations({ width: 10 }, registry)).toThrow('Unknown property "width"');
  });
});

describe('cssNameToCamelCase', () => {
  it.each([
    ['opacity', 'opacity'],
    ['border-radius', 'borderRadius'],
    ['border-top-left-radius', 'borderTopLeftRadius']
  ])('%s → %s', (input, expected) => {
    expect(cssNameToCamelCase(input)).toBe(expected);
  });
});
