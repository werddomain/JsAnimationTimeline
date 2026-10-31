// packages/export-css/src/continuous/__tests__/htmlScene.browser.test.ts
import type { ILayer, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { prepareHtmlCssScene } from '../htmlScene';

function layer(selector: string, id: string, frame = 1, value = 0.5): ILayer {
  return { type: 'layer', id, name: id, target: { selector }, spans: [], propertyTimelines: {
    opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame, value: { kind: 'number', value } }] }
  } };
}
const documentOf = (layers: readonly ILayer[]): ITimelineDocument => ({ version: '2.0.0', settings: { fps: 10, totalFrames: 10 }, layers });
function fixture(style = ''): HTMLElement {
  document.head.innerHTML = `<style>.button { opacity:1 } ${style}</style>`;
  document.body.innerHTML = '<main id="scene"><button class="button" id="one"></button><button class="button" id="two"></button></main><button class="button" id="outside"></button>';
  return document.querySelector<HTMLElement>('main')!;
}

test('scopes exact membership groups, keeps the case 59 policy and never matches outside root', () => {
  const root = fixture();
  const result = prepareHtmlCssScene(documentOf([layer('.button', 'group'), layer('#two', 'specific', 5, 0.8)]), { root });
  if (result.status !== 'exported') throw new Error(JSON.stringify(result));
  expect(result.status).toBe('exported');
  expect(result.data.targets).toHaveLength(2);
  expect(result.data.targets.flatMap((target) => [...document.querySelectorAll(target.selector)].map((element) => element.id)).sort()).toEqual(['one', 'two']);
  expect(result.data.targets.find((target) => target.element.id === 'two')!.trajectories[0].timeline.beforeFirst).toBe('first-key');
});

test.each(['.button { opacity:.2 !important }', '#one { all:initial !important }', '.button { animation:spin 1s linear infinite }'])('refuses incompatible source cascade: %s', (style) => {
  const root = fixture(style);
  const before = document.documentElement.outerHTML;
  expect(prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root }).status).toBe('refused');
  expect(document.documentElement.outerHTML).toBe(before);
});

test('refuses inline important, unscopable roots, duplicated root IDs and unsafe explicit selectors', () => {
  const root = fixture();
  root.querySelector<HTMLElement>('#one')!.style.setProperty('opacity', '1', 'important');
  expect(prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root }).status).toBe('refused');
  root.querySelector<HTMLElement>('#one')!.style.removeProperty('opacity');
  root.id = '';
  expect(prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root }).status).toBe('refused');
  expect(prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root, rootSelector: 'main' }).status).toBe('exported');
  expect(prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root, rootSelector: 'main</style>' }).status).toBe('refused');
  root.id = 'scene'; document.querySelector('#outside')!.id = 'scene';
  expect(prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root }).status).toBe('refused');
});

test('refuses an inaccessible stylesheet before claiming cascade equivalence', () => {
  const root = fixture();
  Object.defineProperty(document.styleSheets[0], 'cssRules', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError'); } });
  expect(prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root })).toMatchObject({ status: 'refused' });
});

test('separates differing transform bases by stable Unicode ID rather than DOM order', () => {
  const root = fixture('.button { transform:translateX(0px) } #one { transform:rotate(30deg) }');
  root.querySelector('#one')!.id = 'one-💫';
  root.querySelector('#two')!.id = 'two-𝄞';
  root.querySelector<HTMLElement>('#one-💫')!.style.transform = 'rotate(30deg)';
  const source: ILayer = { ...layer('.button', 'group'), propertyTimelines: { x: {
    initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value: 20 } }]
  } } };
  const result = prepareHtmlCssScene(documentOf([source]), { root });
  if (result.status !== 'exported') throw new Error(JSON.stringify(result));
  expect(result.status).toBe('exported');
  expect(result.data.targets).toHaveLength(2);
  root.prepend(root.lastElementChild!);
  for (const target of result.data.targets) expect([...document.querySelectorAll(target.selector)]).toEqual([target.element]);
});

test('reports existing keyframe names and refuses source transitions affecting animated properties', () => {
  const root = fixture('@keyframes taken { from { opacity:0 } to { opacity:1 } }');
  const doc = documentOf([layer('.button', 'group')]);
  const result = prepareHtmlCssScene(doc, { root });
  expect(result).toMatchObject({ status: 'exported', data: { existingKeyframeNames: ['taken'] } });
  root.querySelector<HTMLElement>('#one')!.style.transitionProperty = 'opacity';
  root.querySelector<HTMLElement>('#one')!.style.transitionDuration = '1s';
  expect(prepareHtmlCssScene(doc, { root })).toMatchObject({ status: 'refused', diagnostics: [{ code: 'existing-transition' }] });
});

test('a held shorthand still refuses a conflicting important longhand', () => {
  const root = fixture('.button { border-color:rgb(0,0,0) } #one { border-top-color: red !important }');
  const source: ILayer = { ...layer('.button', 'group'), propertyTimelines: {
    border: { initialValue: { kind: 'text', value: 'rgb(0, 0, 0)' }, keys: [{ frame: 1, value: { kind: 'text', value: 'blue' } }] }
  } };
  expect(prepareHtmlCssScene(documentOf([source]), { root, animationContext: { version: 1, bindings: {
    group: { border: { kind: 'style', cssName: 'border-color' } }
  } } }).status).toBe('refused');
});

test('exports blank-span visibility as exact held boundaries without modifying property keys', () => {
  const root = fixture();
  const source: ILayer = { ...layer('.button', 'group'), spans: [
    { id: 'before', start: 1, end: 3, kind: 'blank' }, { id: 'visible', start: 4, end: 7, kind: 'static' }, { id: 'after', start: 8, end: 10, kind: 'blank' }
  ] };
  const doc = documentOf([source]); const before = JSON.stringify(doc);
  const result = prepareHtmlCssScene(doc, { root });
  if (result.status !== 'exported') throw new Error(JSON.stringify(result));
  expect(result.data.targets[0].trajectories.find((item) => item.property === 'visibility')?.timeline.keys).toEqual([
    { frame: 1, value: { kind: 'text', value: 'hidden' } }, { frame: 4, value: { kind: 'text', value: 'visible' } },
    { frame: 8, value: { kind: 'text', value: 'hidden' } }
  ]);
  expect(JSON.stringify(doc)).toBe(before);
});

test.each(['animation-duration:99s;animation-play-state:paused', 'animation-name:none', 'animation-timeline:scroll()',
  'animation-range:20% 80%', 'all:initial'])('refuses authored animation configuration even without an active name: %s', (declarations) => {
  for (const inline of [true, false]) {
    const root = fixture(inline ? '' : `.button { ${declarations} }`);
    if (inline) root.querySelector<HTMLElement>('#one')!.setAttribute('style', declarations);
    const original = document.documentElement.outerHTML;
    const result = prepareHtmlCssScene(documentOf([layer('.button', 'group')]), { root });
    expect(result.status).toBe('refused');
    expect(document.documentElement.outerHTML).toBe(original);
  }
});

