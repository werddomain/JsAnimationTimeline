// packages/runtime/src/stage/html/__tests__/htmlStage.inspection.test.ts
import type { ILayer } from '../../../model/layer';
import { createHost, docOf, timeAt } from '../../__tests__/fakeStage';
import { createHtmlStage } from '../createHtmlStage';
import type { IHtmlAnimationContext } from '../animationTypes';

const layer: ILayer = { type: 'layer', id: 'buttons', name: 'Buttons', target: { selector: '.button' }, spans: [], propertyTimelines: {
  opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame: 1, value: { kind: 'number', value: 0.4 } }] }
} };
const context: IHtmlAnimationContext = { version: 1, bindings: { buttons: { marginTop: { kind: 'style', cssName: 'margin-top', unit: 'px' } } } };

beforeEach(() => {
  document.head.innerHTML = '<style>.button { opacity: 1; margin-top: 10px }</style>';
  document.body.innerHTML = '<main><button class="button" id="a"></button><button class="button" id="b" style="margin-top:20px"></button></main>';
});

it('keeps original common values and reports divergent properties during preview', () => {
  const stage = createHtmlStage({ mode: 'frame', animationContext: context }); const host = createHost([stage]);
  host.load(docOf([layer])); host.render(timeAt(6));
  expect(stage.inspectProperty(layer.target!, 'opacity').initialValue).toEqual({ kind: 'number', value: 1 });
  expect(stage.inspectProperty(layer.target!, 'marginTop')).toMatchObject({ editable: false, reason: expect.stringMatching(/ID/) });
  expect(document.getElementById('a')?.style.opacity).toBe('0.4');
  expect(stage.targets.describe?.(layer.target!)?.properties).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'marginTop', editable: false })
  ]));
  host.destroy();
});

it('refreshes existing group bindings when members enter or leave, restoring the removed member', () => {
  const stage = createHtmlStage({ mode: 'frame' }); const host = createHost([stage]);
  host.load(docOf([layer])); host.render(timeAt(6));
  const removed = document.getElementById('a')!; removed.className = '';
  const added = document.createElement('button'); added.className = 'button'; document.querySelector('main')!.append(added);
  stage.refresh(); host.render(timeAt(6));
  expect(stage.resolveElements(layer.target!)).toHaveLength(2);
  expect((removed as HTMLElement).style.opacity).toBe(''); expect(added.style.opacity).toBe('0.4');
  host.destroy(); expect(added.getAttribute('style')).toBeNull();
});

it('recaptures CSS source edits without preserving an animated value as a base', () => {
  const stage = createHtmlStage({ mode: 'frame' }); const host = createHost([stage]);
  host.load(docOf([layer])); host.render(timeAt(6));
  const result = stage.withSourceStyles(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.button'));
    expect(elements.every((element) => element.style.opacity === '')).toBe(true);
    elements.forEach((element) => element.style.setProperty('opacity', '0.7', 'important'));
    return 'source changed';
  });
  expect(result).toBe('source changed');
  expect(stage.inspectProperty(layer.target!, 'opacity').initialValue).toEqual({ kind: 'number', value: 0.7 });
  expect(document.getElementById('a')?.style.opacity).toBe('0.4');
  host.destroy();
  expect(document.getElementById('a')?.style.opacity).toBe('0.7');
  expect(document.getElementById('a')?.style.getPropertyPriority('opacity')).toBe('important');
});

it('blocks only a newly divergent property after stylesheet refresh, then restores preview after errors', () => {
  const stage = createHtmlStage({ mode: 'frame' }); const host = createHost([stage]);
  host.load(docOf([layer])); host.render(timeAt(6));
  document.head.innerHTML += '<style>#b { opacity: .9 }</style>';
  stage.refresh(); host.render(timeAt(6));
  expect(stage.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'opacity', blocking: true })]));
  expect(document.getElementById('a')?.style.opacity).toBe('');
  expect(document.getElementById('b')?.style.opacity).toBe('');
  expect(() => stage.withSourceStyles(() => { throw new Error('Host error'); })).toThrow('Host error');
  expect(document.getElementById('a')?.style.opacity).toBe(''); host.destroy();
});

it('does not resurrect a legacy preview destroyed inside a source-edit callback', () => {
  const stage = createHtmlStage({ mode: 'frame' }); const host = createHost([stage]);
  host.load(docOf([{ ...layer, target: { selector: '#a' }, propertyTimelines: undefined, spans: [{ id: 'hold', kind: 'static', start: 1, end: 10,
    tracks: { opacity: [{ frame: 1, value: 0.4 }] } }] }]));
  host.render(timeAt(6));
  expect(() => stage.withSourceStyles(() => host.destroy())).not.toThrow();
  expect(document.getElementById('a')?.style.opacity).toBe('');
});

it('restores the source when the first frame after a document update enters a newly unresolved period', () => {
  const specific: ILayer = { ...layer, id: 'specific', target: { selector: '#b' }, propertyTimelines: {
    opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame: 50, value: { kind: 'number', value: 0.8 } }] }
  } };
  const stage = createHtmlStage({ mode: 'frame' }); const host = createHost([stage]);
  host.load(docOf([layer, specific], 100)); host.render(timeAt(100));
  const changed: ILayer = { ...layer, propertyTimelines: { opacity: { ...layer.propertyTimelines!.opacity,
    keys: [...layer.propertyTimelines!.opacity.keys, { frame: 20, value: { kind: 'number', value: 0.6 } }] } } };
  host.load(docOf([changed, specific], 100)); host.render(timeAt(20));
  expect(stage.diagnostics.some((issue) => issue.code === 'before-first-conflict')).toBe(true);
  expect(document.getElementById('b')?.style.opacity).toBe(''); host.destroy();
});

it.each([false, true])('keeps nested source inspection outside preview (legacy=%s)', (legacy) => {
  const target = { selector: '#a' };
  const data = legacy ? { ...layer, target, propertyTimelines: undefined, spans: [{ id: 'hold', kind: 'static' as const,
    start: 1, end: 10, tracks: { opacity: [{ frame: 1, value: 0.4 }] } }] } : { ...layer, target };
  const stage = createHtmlStage({ mode: 'frame' }); const host = createHost([stage]);
  host.load(docOf([data])); host.render(timeAt(6));
  const element = document.getElementById('a')!;
  stage.withSourceStyles(() => {
    expect(element.style.opacity).toBe('');
    expect(stage.inspectProperty(target, 'opacity').initialValue).toEqual({ kind: 'number', value: 1 });
    expect(element.style.opacity).toBe('');
    stage.withSourceStyles(() => {
      stage.inspectProperty(target, 'opacity');
      expect(element.style.opacity).toBe('');
    });
    expect(element.style.opacity).toBe('');
  });
  expect(stage.inspectProperty(target, 'opacity').initialValue).toEqual({ kind: 'number', value: 1 });
  expect(element.style.opacity).toBe('0.4'); host.destroy();
});

it('advertises integer CSS properties as editable holds, not continuous tweens', () => {
  document.getElementById('a')!.style.zIndex = '1';
  const stage = createHtmlStage({ mode: 'frame', animationContext: { version: 1, bindings: { buttons: {
    zIndex: { kind: 'style', cssName: 'z-index', unit: '' }
  } } } });
  expect(stage.inspectProperty({ selector: '#a' }, 'zIndex', { layerId: 'buttons' })).toMatchObject({
    editable: true, interpolable: false, reason: expect.stringMatching(/entier/)
  });
});
