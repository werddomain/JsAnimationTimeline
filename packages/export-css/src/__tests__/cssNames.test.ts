// packages/export-css/src/__tests__/cssNames.test.ts
/**
 * Noms `@keyframes` et contrôle des sélecteurs.
 */

import { isSafeSelector, keyframesName } from '../cssNames';

describe('keyframesName', () => {
  it('prefixes the layer id and replaces characters that are not allowed', () => {
    expect(keyframesName('tl-', 'layer 1/é', new Set())).toBe('tl-layer_1__');
  });

  it.each([
    ['', '1abc', '_1abc'],
    ['', '-1abc', '_-1abc'],
    ['--', 'x', '_--x'],
    ['', '', '_'],
    ['', 'none', '_none'],
    ['', 'Inherit', '_Inherit']
  ])('never starts with a digit or `--` (prefix %p, id %p)', (prefix, id, expected) => {
    expect(keyframesName(prefix, id, new Set())).toBe(expected);
  });

  it('adds a suffix when the name is already used', () => {
    const used = new Set<string>();

    expect([keyframesName('tl-', 'a.b', used), keyframesName('tl-', 'a_b', used), keyframesName('tl-', 'a b', used)])
      .toEqual(['tl-a_b', 'tl-a_b-2', 'tl-a_b-3']);
  });
});

describe('isSafeSelector', () => {
  it.each(['#hero', '.a > .b', '[data-x="y"]', 'svg circle:nth-child(2)', '[title="a(b"]', '#a\\:b', ':is(.a, [x="]"])'])(
    'accepts %p',
    (selector) => {
      expect(isSafeSelector(selector)).toBe(true);
    }
  );

  it.each([
    '',
    '   ',
    '#a { color: red }',
    '#a; body',
    '</style><script>',
    '#a[',
    'a:not(',
    '.a)',
    '[x="y]',
    'x /* note',
    'x */',
    '#a\\',
    '@media print'
  ])('refuses %p', (selector) => {
    expect(isSafeSelector(selector)).toBe(false);
  });
});
