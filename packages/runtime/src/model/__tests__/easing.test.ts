// packages/runtime/src/model/__tests__/easing.test.ts
/**
 * Parsing of easing presets and cubic-bezier strings.
 */

import { DEFAULT_EASING, EASING_PRESETS, isEasingPreset, parseEasing } from '../easing';

describe('parseEasing', () => {
  it.each([
    ['linear', { x1: 0, y1: 0, x2: 1, y2: 1 }],
    ['ease', { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }],
    ['ease-in', { x1: 0.42, y1: 0, x2: 1, y2: 1 }],
    ['ease-out', { x1: 0, y1: 0, x2: 0.58, y2: 1 }],
    ['ease-in-out', { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }]
  ])('returns the CSS control points of %s', (preset, expected) => {
    expect(parseEasing(preset)).toEqual(expected);
  });

  it('parses every preset', () => {
    for (const preset of EASING_PRESETS) {
      expect(parseEasing(preset)).not.toBeNull();
    }
  });

  it.each([
    ['cubic-bezier(0.1, 0.2, 0.3, 0.4)', { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 }],
    ['cubic-bezier(0.1,0.2,0.3,0.4)', { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 }],
    ['cubic-bezier( .68 , -0.55 , .265 , 1.55 )', { x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 }],
    ['cubic-bezier(0, +2, 1, -3)', { x1: 0, y1: 2, x2: 1, y2: -3 }]
  ])('parses %s', (easing, expected) => {
    expect(parseEasing(easing)).toEqual(expected);
  });

  it.each([
    '', 'bounce', 'Linear', ' linear', 'cubic-bezier(0, 0, 1)', 'cubic-bezier(0, 0, 1, 1, 1)',
    'cubic-bezier(a, 0, 1, 1)', 'cubic-bezier(0 0 1 1)', 'cubic-bezier(1., 0, 1, 1)',
    'cubic-bezier(1.5, 0, 0.5, 1)', 'cubic-bezier(0, 0, -0.1, 1)', 'steps(4)'
  ])('returns null for %p', (easing) => {
    expect(parseEasing(easing)).toBeNull();
  });
});

describe('easing constants', () => {
  it('defaults to linear', () => {
    expect(DEFAULT_EASING).toBe('linear');
  });

  it('recognises preset names only', () => {
    expect(isEasingPreset('ease-out')).toBe(true);
    expect(isEasingPreset('cubic-bezier(0,0,1,1)')).toBe(false);
  });
});
