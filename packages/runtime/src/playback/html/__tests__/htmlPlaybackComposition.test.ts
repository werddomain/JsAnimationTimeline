// packages/runtime/src/playback/html/__tests__/htmlPlaybackComposition.test.ts
import type { ILayer } from '../../../model/layer';
import type { IPropertyTimeline } from '../../../model/propertyTimeline';
import { docOf } from '../../../stage/__tests__/fakeStage';
import type { IHtmlAnimationContext } from '../../../stage/html/animationTypes';
import { createHtmlStage } from '../../../stage/html/createHtmlStage';
import { resolveHtmlConflict } from '../../../stage/html/conflicts';
import { createHost, timeAt } from '../../../stage/__tests__/fakeStage';
import { compileHtmlPlayback } from '../compileHtmlPlayback';
import { createHtmlPlaybackPlayer } from '../createHtmlPlaybackPlayer';

const track = (value: number): IPropertyTimeline => ({ initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value } }] });
function layer(id: string, selector: string, properties: Record<string, IPropertyTimeline>): ILayer {
  return { id, name: id, type: 'layer', target: { selector }, spans: [], propertyTimelines: properties };
}
beforeEach(() => {
  document.head.innerHTML = '<style>.button { opacity: 1 }</style>';
  document.body.innerHTML = '<main><div class="button primary" id="one"></div><div class="button" id="two"></div></main>';
});

test('exports saved conflict choices independently of layer order and rejects stale choices', () => {
  const root = document.querySelector('main')!;
  const doc = docOf([layer('all', '.button', { opacity: track(.4) }), layer('primary', '.primary', { opacity: track(.8) })]);
  const stage = createHtmlStage({ root, mode: 'frame' }); const host = createHost([stage]); host.load(doc); host.render(timeAt(1));
  const context = resolveHtmlConflict({ version: 1 }, stage.diagnostics[0], 'primary'); host.destroy();
  const compiled = compileHtmlPlayback({ ...doc, layers: [...doc.layers].reverse() }, { root, animationContext: context });
  expect(compiled.status).toBe('exported'); if (compiled.status !== 'exported') return;
  const player = createHtmlPlaybackPlayer(compiled.data, { root });
  expect(document.getElementById('one')!.style.opacity).toBe('0.8');
  expect(document.getElementById('two')!.style.opacity).toBe('0.4'); player.destroy();
  const changed = { ...doc, layers: [layer('all', '.button', { opacity: track(.3) }), doc.layers[1]] };
  const stale = compileHtmlPlayback(changed, { root, animationContext: context });
  expect(stale.status).toBe('refused'); expect(stale.diagnostics.some((issue) => issue.code === 'stale-resolution')).toBe(true);
});

test('refuses integer interpolation even when integer sample positions would appear valid', () => {
  document.getElementById('one')!.style.zIndex = '0';
  const doc = docOf([layer('integer', '#one', { order: { ...track(0), keys: [
    { frame: 1, value: { kind: 'number', value: 0 } }, { frame: 3, value: { kind: 'number', value: 2 } }
  ], transitions: [{ id: 'move', fromFrame: 1, toFrame: 3 }] } })], 3);
  const result = compileHtmlPlayback(doc, { root: document.querySelector('main')!, animationContext: { version: 1,
    bindings: { integer: { order: { kind: 'style', cssName: 'z-index', unit: '' } } } } });
  expect(result.status).toBe('refused'); expect(result.diagnostics[0].message).toMatch(/entier/);
});

test('exports a complete gradient but refuses a later invalid stop composition without partial data', () => {
  const context: IHtmlAnimationContext = { version: 1, bindings: { box: {
    angle: { kind: 'gradient', gradientId: 'fill', component: 'angle' },
    middle: { kind: 'gradient', gradientId: 'fill', component: 'present', stopId: 'middle' },
    right: { kind: 'gradient', gradientId: 'fill', component: 'present', stopId: 'right' }
  } }, gradients: { box: [{ id: 'fill', cssName: 'background-image', type: 'linear', angle: 0,
    centerX: 50, centerY: 50, radiusX: 50, radiusY: 50,
    stops: ['left', 'middle', 'right'].map((id, index) => ({ id, color: { kind: 'color', r: 1, g: 0, b: 0, a: 1 }, opacity: 1, position: index * 50, present: true }))
  }] } };
  const root = document.querySelector('main')!;
  const properties = { angle: track(90), middle: { initialValue: { kind: 'boolean' as const, value: true }, keys: [{ frame: 3, value: { kind: 'boolean' as const, value: false } }] } };
  const compiled = compileHtmlPlayback(docOf([layer('box', '#one', properties)], 4), { root, animationContext: context });
  expect(compiled.status).toBe('exported'); if (compiled.status !== 'exported') return;
  const css = compiled.data.frames['3']['group-1']['background-image'];
  expect(css).toContain('linear-gradient(90deg'); expect(css).not.toContain('50%');
  const invalid = compileHtmlPlayback(docOf([layer('box', '#one', { ...properties, right: properties.middle })], 4), { root, animationContext: context });
  expect(invalid.status).toBe('refused'); expect(invalid.diagnostics[0].message).toMatch(/deux points/); expect(invalid).not.toHaveProperty('data');
});

test('uses verified host selectors for differing transform bases without adding IDs', () => {
  const root = document.querySelector('main')!;
  const elements = Array.from(root.querySelectorAll<HTMLElement>('div'));
  elements.forEach((element, index) => { element.removeAttribute('id'); element.dataset.key = String(index); element.style.transform = `matrix(1,0,0,1,0,${index * 10})`; });
  const before = root.innerHTML;
  const doc = docOf([layer('move', '.button', { x: track(30) })]);
  const result = compileHtmlPlayback(doc, { root, selectorForElement: (element) => `[data-key="${(element as HTMLElement).dataset.key}"]` });
  expect(result.status).toBe('exported'); expect(root.innerHTML).toBe(before); if (result.status !== 'exported') return;
  const player = createHtmlPlaybackPlayer(result.data, { root });
  expect(elements[1].style.transform).toContain('translate(30px, 10px)'); player.destroy();
  expect(root.innerHTML).toBe(before); expect(compileHtmlPlayback(doc, { root, selectorForElement: () => '.button' }).status).toBe('refused');
});

test('supports an empty document as complete empty snapshots', () => {
  const root = document.querySelector('main')!;
  const result = compileHtmlPlayback(docOf([], 2), { root });
  expect(result.status).toBe('exported'); if (result.status !== 'exported') return;
  expect(result.data.groups).toEqual([]); expect(result.data.frames).toEqual({ 1: {}, 2: {} });
  const player = createHtmlPlaybackPlayer(result.data, { root }); player.seek(2); expect(player.currentFrame).toBe(2); player.destroy();
});
