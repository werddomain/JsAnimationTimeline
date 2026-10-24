// packages/runtime/src/stage/html/__tests__/htmlStage.test.ts
/**
 * Scène HTML : cibles acceptées, résolution (sélecteur, élément, refs, bind,
 * attribut `data-timeline-target`), sous-arbres exclus, liste des cibles,
 * mode `waapi` et mode `frame` (styles en ligne, compteur par élément).
 */

import type { ILayer } from '../../../model/layer';
import { installFakeAnimate } from '../../../player/__tests__/fakes';
import { createFakeStage, createHost, docOf, timeAt } from '../../__tests__/fakeStage';
import type { StageHost } from '../../StageHost';
import { createHtmlStage } from '../createHtmlStage';
import type { IHtmlStage, IHtmlStageOptions } from '../createHtmlStage';

let fake: ReturnType<typeof installFakeAnimate>;
let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<main id="root"><div id="box" style="color: red"></div><p data-timeline-target="logo"></p><section id="editor"><div id="inner"></div></section></main>';
  root = document.getElementById('root') as HTMLElement;
  fake = installFakeAnimate();
});

afterEach(() => fake.restore());

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function layer(id: string, target: ILayer['target'], kind: 'tween' | 'blank' | 'static' = 'tween'): ILayer {
  const tracks = kind === 'blank' ? undefined : { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }], opacity: [{ frame: 1, value: 1 }] };
  return { id, type: 'layer', name: id, target, spans: [{ id: `${id}-s`, start: 1, end: 10, kind, tracks }] };
}

function html(options: IHtmlStageOptions = {}): IHtmlStage {
  return createHtmlStage({ root, ...options });
}

function load(stage: IHtmlStage, layers: ILayer[]): StageHost {
  const host = createHost([stage]);
  host.load(docOf(layers));
  return host;
}

describe('createHtmlStage', () => {
  it('accepts selectors, elements and refs scoped to html only', () => {
    const stage = html();
    expect(stage.id).toBe('html');
    expect(stage.mode).toBe('waapi');
    expect(stage.accepts({ selector: '#box' })).toBe(true);
    expect(stage.accepts({ element: el('box') })).toBe(true);
    expect(stage.accepts({ ref: 'logo', stage: 'html' })).toBe(true);
    expect(stage.accepts({ ref: 'logo' })).toBe(false);
    expect(stage.accepts({ ref: 'logo', stage: 'canvas' })).toBe(false);
  });

  it('refuses an unknown mode', () => {
    expect(() => createHtmlStage({ mode: 'css' as unknown as 'frame' })).toThrow('The HTML stage mode must be "waapi" or "frame" (got css).');
  });

  it('defaults the root to document', () => {
    expect(createHtmlStage().resolve({ selector: '#box' })).toBe(el('box'));
  });

  it('does not take refs without stage from another stage', () => {
    const canvas = createFakeStage('canvas', { unscoped: true });
    canvas.objects.set('logo', { name: 'canvas logo' });
    const host = createHost([html(), canvas.stage]);
    host.load(docOf([layer('l1', { ref: 'logo' })]));
    expect(canvas.updates[0][0].object).toEqual({ name: 'canvas logo' });
  });
});

describe('resolution', () => {
  it('resolves selectors inside root and puts an invalid selector in missingTargets', () => {
    const host = load(html(), [layer('ok', { selector: '#box' }), layer('bad', { selector: '##' }), layer('none', { selector: '#nope' })]);
    expect(host.missingTargets).toEqual(['bad', 'none']);
    expect(fake.animations.map((a) => a.target)).toEqual([el('box')]);
  });

  it('resolves refs from the refs option (object or Map), bind, then the data attribute', () => {
    const extra = document.createElement('i');
    expect(html({ refs: { hero: extra } }).resolve({ ref: 'hero', stage: 'html' })).toBe(extra);
    expect(html({ refs: new Map([['hero', extra]]) }).resolve({ ref: 'hero', stage: 'html' })).toBe(extra);
    const stage = html();
    expect(stage.resolve({ ref: 'logo', stage: 'html' })).toBe(root.querySelector('p'));
    stage.bind('logo', extra);
    expect(stage.resolve({ ref: 'logo', stage: 'html' })).toBe(extra);
    stage.bind('logo', null);
    expect(stage.resolve({ ref: 'logo', stage: 'html' })).toBe(root.querySelector('p'));
    expect(stage.resolve({ ref: 'ghost', stage: 'html' })).toBeNull();
  });

  it('retries a missing ref when it is bound', () => {
    const stage = html();
    const host = load(stage, [layer('l1', { ref: 'later', stage: 'html' })]);
    expect(host.missingTargets).toEqual(['l1']);
    stage.bind('later', el('box'));
    expect(host.missingTargets).toEqual([]);
    expect(fake.animations.map((a) => a.target)).toEqual([el('box')]);
    host.destroy();
    stage.bind('other', el('box'));
  });

  it('never targets an excluded subtree, given as an element or a list', () => {
    const one = html({ exclude: el('editor') });
    expect(one.resolve({ selector: 'div' })).toBe(el('box'));
    expect(one.resolve({ selector: '#inner' })).toBeNull();
    expect(one.resolve({ element: el('inner') })).toBeNull();
    expect(one.resolve({ selector: 'section' })).toBeNull();
    const list = html({ exclude: [el('box'), el('editor')] });
    expect(list.resolve({ selector: 'div' })).toBeNull();
    expect(list.resolve({ selector: '##' })).toBeNull();
  });

  it('lists refs, data attributes and ids outside the excluded subtrees, and describes a target', () => {
    const stage = html({ exclude: el('editor'), refs: { hero: el('box'), hidden: el('inner') } });
    expect(stage.targets.list()).toEqual([
      { target: { ref: 'hero', stage: 'html' }, label: 'hero', group: 'HTML' },
      { target: { ref: 'logo', stage: 'html' }, label: 'logo', group: 'HTML' },
      { target: { selector: '#box' }, label: 'box', group: 'HTML' }
    ]);
    expect(stage.targets.describe?.({ selector: '#box' })).toEqual({ target: { selector: '#box' }, label: 'box', group: 'HTML' });
    expect(stage.targets.describe?.({ selector: 'p' })).toEqual({ target: { selector: 'p' }, label: 'p', group: 'HTML' });
    expect(stage.targets.describe?.({ selector: '#inner' })).toBeUndefined();
  });

  it('skips an empty data attribute in the list', () => {
    root.innerHTML = '<b data-timeline-target=""></b>';
    expect(html().targets.list()).toEqual([]);
  });
});

describe('waapi mode', () => {
  it('builds one animation per changing layer, syncs them and cancels them on detach', () => {
    const stage = html();
    const host = load(stage, [layer('l1', { selector: '#box' }), layer('still', { element: root.querySelector('p') as Element }, 'static')]);
    expect(fake.animations).toHaveLength(2);
    host.sync({ timeMs: 300, frame: 4, integerFrame: 4 }, { playing: true, speed: 2 });
    expect(fake.animations.map((a) => [a.currentTime, a.playbackRate, a.playState])).toEqual([[300, 2, 'running'], [300, 2, 'running']]);
    host.sync({ timeMs: 1000, frame: 11, integerFrame: 10 }, { playing: true, speed: 1 });
    expect(fake.animations[0].playState).toBe('paused');
    host.destroy();
    expect(fake.animations.every((a) => a.playState === 'idle')).toBe(true);
  });

  it('reports two layers on the same element as duplicate-target', () => {
    const host = load(html(), [layer('a', { selector: '#box' }), layer('b', { element: el('box') })]);
    expect(host.warnings).toEqual([expect.objectContaining({ code: 'duplicate-target', stageId: 'html', layerId: 'b' })]);
  });

  it('refuses the document when a target has no Element.animate, keeping the old animations', () => {
    const host = load(html(), [layer('a', { selector: '#box' })]);
    const broken = document.createElement('div');
    Object.defineProperty(broken, 'animate', { value: undefined });
    expect(() => host.load(docOf([layer('a', { selector: '#box' }), layer('b', { element: broken })]))).toThrow('The Web Animations API (Element.animate) is not available.');
    expect(fake.animations.map((a) => a.playState)).toEqual(['paused', 'idle']);
  });
});

describe('frame mode', () => {
  it('writes the CSS of the current values inline on render', () => {
    const stage = html({ mode: 'frame' });
    const host = load(stage, [layer('l1', { selector: '#box' })]);
    expect(stage.mode).toBe('frame');
    expect(fake.animations).toHaveLength(0);
    host.render(timeAt(4));
    expect(el('box').style.getPropertyValue('transform')).toContain('translateX(30px)');
    expect(el('box').style.getPropertyValue('opacity')).toBe('1');
    expect(el('box').style.getPropertyValue('visibility')).toBe('');
  });

  it('writes visibility for layers that hide their target', () => {
    const blank: ILayer = { ...layer('l1', { selector: '#box' }), spans: [{ id: 's', start: 1, end: 2, kind: 'static' }, { id: 'b', start: 3, end: 10, kind: 'blank' }] };
    const host = load(html({ mode: 'frame' }), [blank]);
    host.render(timeAt(1));
    expect(el('box').style.getPropertyValue('visibility')).toBe('visible');
    host.render(timeAt(5));
    expect(el('box').style.getPropertyValue('visibility')).toBe('hidden');
  });

  it('restores the inline style only when the last layer on an element is released', () => {
    const host = load(html({ mode: 'frame' }), [layer('a', { selector: '#box' }), layer('b', { element: el('box') })]);
    expect(host.warnings.map((w) => [w.code, w.layerId])).toEqual([['duplicate-target', 'b']]);
    host.render(timeAt(4));
    host.load(docOf([layer('b', { element: el('box') })]));
    host.render(timeAt(4));
    expect(el('box').style.getPropertyValue('transform')).toContain('translateX(30px)');
    host.load(docOf([]));
    expect(el('box').style.cssText).toBe('color: red;');
  });

  it('removes the style attribute it added, and restores everything on detach', () => {
    const host = load(html({ mode: 'frame' }), [layer('p', { ref: 'logo', stage: 'html' })]);
    host.render(timeAt(2));
    expect(root.querySelector('p')?.hasAttribute('style')).toBe(true);
    host.destroy();
    expect(root.querySelector('p')?.hasAttribute('style')).toBe(false);
  });

  it('hides a layer hidden in the editor and puts its visibility back', () => {
    el('box').style.setProperty('visibility', 'collapse');
    const stage = html({ mode: 'frame' });
    const host = load(stage, [layer('a', { selector: '#box' })]);
    const base = { layerId: 'a', target: { selector: '#box' }, object: el('box') as Element, values: { x: 1 }, active: true };
    stage.render?.(timeAt(1), [{ ...base, editorVisible: false }]);
    expect(el('box').style.getPropertyValue('visibility')).toBe('hidden');
    stage.render?.(timeAt(1), [{ ...base, editorVisible: true }]);
    expect(el('box').style.getPropertyValue('visibility')).toBe('collapse');
    host.destroy();
  });

  it('skips elements without inline style', () => {
    const node = document.createElementNS('urn:x', 'thing');
    root.appendChild(node);
    const host = load(html({ mode: 'frame' }), [layer('a', { element: node })]);
    host.render(timeAt(3));
    expect(node.hasAttribute('style')).toBe(false);
    host.destroy();
  });
});
