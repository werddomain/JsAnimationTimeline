// packages/runtime/src/stage/html/__tests__/exportWork.test.ts
import { withPreparedHtmlExport } from '../exportPreparation';
import { compileHtmlPlayback } from '../../../playback/html/compileHtmlPlayback';
import { HtmlPropertyInspection } from '../propertyInspection';
import * as composition from '../cssCompose';
import type { ILayer } from '../../../model/layer';
import type { IHtmlAnimationContext } from '../animationTypes';
import { docOf } from '../../__tests__/fakeStage';

afterEach(() => jest.restoreAllMocks());

function fixture(count: number, keys: number, property = 'opacity') {
  document.head.innerHTML = '';
  document.body.innerHTML = `<main>${'<div class="item" style="opacity:1"></div>'.repeat(count)}</main>`;
  const layer: ILayer = { type: 'layer', id: 'layer', name: 'Layer', target: { selector: '.item' }, spans: [], propertyTimelines: {
    [property]: { initialValue: { kind: 'number', value: 1 }, keys: Array.from({ length: keys }, (_, index) => ({
      frame: index + 1, value: { kind: 'number' as const, value: index % 2 }
    })) }
  } };
  return { root: document.querySelector('main')!, doc: docOf([layer], keys), layer };
}

test.each(['css', 'playback'] as const)('rejects expensive target/value products before HTML inspection for %s', (kind) => {
  const { root, doc } = fixture(1000, 1000);
  const inspect = jest.spyOn(HtmlPropertyInspection.prototype, 'inspect').mockImplementation(() => { throw new Error('Unexpected inspection'); });
  const compose = jest.spyOn(composition, 'composeHtmlDeclarations');
  const action = jest.fn();
  const result = kind === 'css' ? withPreparedHtmlExport(doc, { root }, action) : compileHtmlPlayback(doc, { root });
  expect(result).toMatchObject({ status: 'refused', diagnostics: [{ code: 'resource-limit' }] });
  expect(inspect).not.toHaveBeenCalled(); expect(compose).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
});

test('counts gradient composition and repeated evaluation before inspecting its targets', () => {
  const { root, doc } = fixture(10, 400, 'angle');
  const context: IHtmlAnimationContext = { version: 1, bindings: { layer: { angle: { kind: 'gradient', gradientId: 'bg', component: 'angle' } } },
    gradients: { layer: [{ id: 'bg', cssName: 'background-image', type: 'linear', angle: 0, centerX: 50, centerY: 50, radiusX: 50, radiusY: 50,
      stops: [{ id: 'a', color: { kind: 'color', r: 1, g: 0, b: 0, a: 1 }, opacity: 1, position: 0, present: true },
        { id: 'b', color: { kind: 'color', r: 0, g: 0, b: 1, a: 1 }, opacity: 1, position: 100, present: true }] }] } };
  const inspect = jest.spyOn(HtmlPropertyInspection.prototype, 'inspect').mockImplementation(() => { throw new Error('Unexpected inspection'); });
  expect(withPreparedHtmlExport(doc, { root, animationContext: context }, () => undefined))
    .toMatchObject({ status: 'refused', diagnostics: [{ code: 'resource-limit' }] });
  expect(inspect).not.toHaveBeenCalled();
});

test('keeps a normal small group export available with its exact trajectories', () => {
  const { root, doc } = fixture(4, 10);
  const result = withPreparedHtmlExport(doc, { root }, (scene) => scene.trajectories.length);
  expect(result).toMatchObject({ status: 'exported', data: 4 });
});

test('counts text payload size multiplied by matching targets before CSS parsing', () => {
  const { root, layer } = fixture(100, 1);
  const text = { kind: 'text' as const, value: 'long-font-family-'.repeat(5000) };
  const doc = docOf([{ ...layer, propertyTimelines: { family: { initialValue: text, keys: [{ frame: 1, value: text }] } } }], 1);
  const inspect = jest.spyOn(HtmlPropertyInspection.prototype, 'inspect').mockImplementation(() => { throw new Error('Unexpected inspection'); });
  expect(withPreparedHtmlExport(doc, { root, animationContext: { version: 1, bindings: {
    layer: { family: { kind: 'style', cssName: 'font-family' } }
  } } }, () => undefined)).toMatchObject({ status: 'refused', diagnostics: [{ code: 'resource-limit' }] });
  expect(inspect).not.toHaveBeenCalled();
});

test('bounds orphaned HTML context data before semantic preparation', () => {
  const { root, doc } = fixture(1, 1);
  const inspect = jest.spyOn(HtmlPropertyInspection.prototype, 'inspect').mockImplementation(() => { throw new Error('Unexpected inspection'); });
  const bindings = Object.fromEntries(Array.from({ length: 5000 }, (_, index) => [`unused-${index}`, {
    value: { kind: 'style' as const, cssName: 'opacity' }
  }]));
  expect(withPreparedHtmlExport(doc, { root, animationContext: { version: 1, bindings } }, () => undefined))
    .toMatchObject({ status: 'refused', diagnostics: [{ code: 'resource-limit' }] });
  expect(inspect).not.toHaveBeenCalled();
});

test('bounds sampled HTML frame-by-target composition even with only one source key', () => {
  const { root, doc } = fixture(1000, 1);
  const inspect = jest.spyOn(HtmlPropertyInspection.prototype, 'inspect').mockImplementation(() => { throw new Error('Unexpected inspection'); });
  const result = compileHtmlPlayback({ ...doc, settings: { ...doc.settings, totalFrames: 1000 } }, { root });
  expect(result).toMatchObject({ status: 'refused', diagnostics: [{ code: 'resource-limit' }] });
  expect(inspect).not.toHaveBeenCalled();
});
