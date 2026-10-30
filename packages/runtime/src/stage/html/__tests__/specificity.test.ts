// packages/runtime/src/stage/html/__tests__/specificity.test.ts
import { compareHtmlSpecificity, htmlSelectorSpecificity } from '../specificity';

test.each<[string, readonly [number, number, number]]>([
  ['#button-2', [1, 0, 0]], ['.button.primary', [0, 2, 0]], ['.button', [0, 1, 0]],
  ['main > section .button + button', [0, 1, 3]], ['*', [0, 0, 0]], ['button[data-x="a]b"].active', [0, 2, 1]],
  ['#épreuve.élève', [1, 1, 0]]
])('counts supported selector %s', (selector, expected) => {
  expect(htmlSelectorSpecificity(selector)).toEqual(expected);
});

test.each([':is(.button)', ':where(#button)', ':not(button)', 'svg|g', '.button\\:active', '#a, .b', '.a > > .b', '', 'button*'])(
  'returns unknown instead of guessing for %s', (selector) => { expect(htmlSelectorSpecificity(selector)).toBeUndefined(); });

test('specificity tuples cannot overflow into the next category', () => {
  expect(compareHtmlSpecificity([1, 0, 0], [0, 1000, 10])).toBeGreaterThan(0);
  expect(compareHtmlSpecificity([0, 1, 0], [0, 0, 1000])).toBeGreaterThan(0);
});
