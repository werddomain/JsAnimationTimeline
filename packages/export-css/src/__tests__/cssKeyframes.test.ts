// packages/export-css/src/__tests__/cssKeyframes.test.ts
/**
 * Passage des images clés Web Animations au CSS : changements nets,
 * accélérations, pourcentages et mise en forme.
 */

import { camelCaseToCssName, formatFloor, formatKeyframesBlock, toCssKeyframes } from '../cssKeyframes';

describe('camelCaseToCssName', () => {
  it.each([['opacity', 'opacity'], ['borderRadius', 'border-radius'], ['WebkitMask', '-webkit-mask']])('%p → %p', (input, expected) => {
    expect(camelCaseToCssName(input)).toBe(expected);
  });
});

describe('formatFloor', () => {
  it.each([
    [100, 6, '100'],
    [0, 6, '0'],
    [66.66666666666667, 6, '66.666666'],
    [33.33333333333333, 6, '33.333333'],
    [49.99999999999999, 6, '50'],
    [12.5, 6, '12.5']
  ])('%p with %p decimals → %p', (value, decimals, expected) => {
    expect(formatFloor(value, decimals)).toBe(expected);
  });
});

describe('toCssKeyframes', () => {
  it('writes the declarations and the easing of each segment', () => {
    const result = toCssKeyframes([
      { offset: 0, easing: 'ease-in', opacity: '0', borderRadius: '2px' },
      { offset: 1, easing: 'linear', opacity: '1', borderRadius: '8px' }
    ]);

    expect(result).toEqual([
      { offset: 0, easing: 'ease-in', declarations: [['opacity', '0'], ['border-radius', '2px']] },
      { offset: 1, easing: 'linear', declarations: [['opacity', '1'], ['border-radius', '8px']] }
    ]);
  });

  it('turns two keyframes at the same offset into a step-end segment', () => {
    const result = toCssKeyframes([
      { offset: 0, easing: 'linear', opacity: '0' },
      { offset: 0.4, easing: 'linear', opacity: '1' },
      { offset: 0.5, easing: 'linear', opacity: '1' },
      { offset: 0.5, easing: 'ease', opacity: '0.2' },
      { offset: 1, easing: 'linear', opacity: '0.6' }
    ]);

    expect(result.map(({ offset, easing }) => [offset, easing])).toEqual([[0, 'linear'], [0.4, 'step-end'], [0.5, 'ease'], [1, 'linear']]);
    expect(result[2].declarations).toEqual([['opacity', '0.2']]);
  });

  it('holds a first keyframe that starts after 0%', () => {
    const result = toCssKeyframes([
      { offset: 0.3, easing: 'linear', opacity: '0', visibility: 'hidden' },
      { offset: 0.3, easing: 'linear', opacity: '1', visibility: 'visible' },
      { offset: 1, easing: 'linear', opacity: '1', visibility: 'visible' }
    ]);

    expect(result.map(({ offset, easing }) => [offset, easing])).toEqual([[0, 'step-end'], [0.3, 'linear'], [1, 'linear']]);
    expect(result[0].declarations).toEqual([['opacity', '0'], ['visibility', 'hidden']]);
  });

  it('keeps a held value that differs from the previous keyframe just before the change', () => {
    const result = toCssKeyframes([
      { offset: 0, easing: 'linear', opacity: '0' },
      { offset: 0.5, easing: 'linear', opacity: '0.5' },
      { offset: 0.5, easing: 'linear', opacity: '1' }
    ]);

    expect(result.map(({ offset, easing }) => [offset, easing])).toEqual([[0, 'linear'], [0.499999, 'step-end'], [0.5, 'linear']]);
  });

  it('writes linear instead of an easing that is not a valid timing function', () => {
    const [keyframe] = toCssKeyframes([{ offset: 0, easing: 'linear;} body { color: red', opacity: '1' }]);

    expect(keyframe.easing).toBe('linear');
  });

  it('throws for a declaration that could end the block', () => {
    expect(() => toCssKeyframes([{ offset: 0, opacity: '1; color: red' }])).toThrow('unsafe CSS declaration');
  });

  it('ignores the composite key and missing values', () => {
    expect(toCssKeyframes([{ composite: 'replace', opacity: '1', color: undefined }])).toEqual([
      { offset: 0, easing: 'linear', declarations: [['opacity', '1']] }
    ]);
  });
});

describe('formatKeyframesBlock', () => {
  it('writes percentages rounded down and the timing function when it is not linear', () => {
    const css = formatKeyframesBlock('tl-a', [
      { offset: 0, easing: 'ease-out', declarations: [['opacity', '0']] },
      { offset: 2 / 3, easing: 'linear', declarations: [['opacity', '1']] }
    ]);

    expect(css).toBe(
      '@keyframes tl-a {\n  0% {\n    opacity: 0;\n    animation-timing-function: ease-out;\n  }\n  66.666666% {\n    opacity: 1;\n  }\n}'
    );
  });
});
