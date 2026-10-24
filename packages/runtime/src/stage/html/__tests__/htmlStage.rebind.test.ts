// packages/runtime/src/stage/html/__tests__/htmlStage.rebind.test.ts
/**
 * Scène HTML, suites de la revue R7 : `bind` sur une ref déjà résolue
 * (chemin `ElementReference` de Blazor) dans les deux modes, et styles en
 * ligne du mode `frame` limités aux propriétés écrites (un style posé par la
 * page après coup survit à `update`, `release` et `detach`).
 */

import type { ILayer } from '../../../model/layer';
import { installFakeAnimate } from '../../../player/__tests__/fakes';
import { createHost, docOf, timeAt } from '../../__tests__/fakeStage';
import type { StageHost } from '../../StageHost';
import { createHtmlStage } from '../createHtmlStage';
import type { IHtmlStage } from '../createHtmlStage';

let fake: ReturnType<typeof installFakeAnimate>;

beforeEach(() => {
  document.body.innerHTML = '<main id="root"><div id="a" style="color: red"></div><div id="b"></div></main>';
  fake = installFakeAnimate();
});

afterEach(() => fake.restore());

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

const MOVE = { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] };

function layer(id: string, target: ILayer['target'], tracks: NonNullable<ILayer['spans'][number]['tracks']> = MOVE): ILayer {
  return { id, type: 'layer', name: id, target, spans: [{ id: `${id}-s`, start: 1, end: 10, kind: 'tween', tracks }] };
}

const LOGO = { ref: 'logo', stage: 'html' };

function setup(mode: 'waapi' | 'frame'): { stage: IHtmlStage; host: StageHost } {
  const stage = createHtmlStage({ root: el('root'), mode, refs: { logo: el('a') } });
  const host = createHost([stage]);
  host.load(docOf([layer('l1', LOGO)]));
  return { stage, host };
}

function running(): Element[] {
  return fake.animations.filter((animation) => animation.playState !== 'idle').map((animation) => animation.target);
}

describe('bind on a resolved ref, waapi mode', () => {
  it('moves the animation to the new element and cancels the old one', () => {
    const { stage, host } = setup('waapi');
    expect(running()).toEqual([el('a')]);
    stage.bind('logo', el('b'));
    expect(running()).toEqual([el('b')]);
    expect(host.missingTargets).toEqual([]);
    host.destroy();
    expect(running()).toEqual([]);
  });

  it('cancels the animation and lists the layer as missing when the ref is unbound, then binds it again', () => {
    const { stage, host } = setup('waapi');
    stage.bind('logo', null);
    expect(running()).toEqual([]);
    expect(host.missingTargets).toEqual(['l1']);
    stage.bind('logo', el('a'));
    expect(running()).toEqual([el('a')]);
    expect(host.missingTargets).toEqual([]);
  });

  it('keeps the animation when the ref is bound to the same element', () => {
    const { stage } = setup('waapi');
    stage.bind('logo', el('a'));
    expect(fake.animations).toHaveLength(1);
  });
});

describe('bind on a resolved ref, frame mode', () => {
  it('moves the styles to the new element and restores the old one', () => {
    const { stage, host } = setup('frame');
    host.render(timeAt(4));
    expect(el('a').style.getPropertyValue('transform')).toContain('translateX(30px)');
    stage.bind('logo', el('b'));
    expect(el('a').style.cssText).toBe('color: red;');
    expect(el('b').style.getPropertyValue('transform')).toContain('translateX(0px)');
    host.render(timeAt(4));
    expect(el('b').style.getPropertyValue('transform')).toContain('translateX(30px)');
    expect(el('a').style.getPropertyValue('transform')).toBe('');
  });

  it('releases the element and lists the layer as missing when the ref is unbound', () => {
    const { stage, host } = setup('frame');
    host.render(timeAt(4));
    stage.bind('logo', null);
    expect(host.missingTargets).toEqual(['l1']);
    expect(el('a').style.cssText).toBe('color: red;');
    host.render(timeAt(5));
    expect(el('a').style.getPropertyValue('transform')).toBe('');
    host.destroy();
    expect(el('a').style.cssText).toBe('color: red;');
  });
});

describe('frame mode keeps the styles the page sets', () => {
  it('saves only the written properties, with their priority', () => {
    el('a').setAttribute('style', 'color: red; opacity: 0.25 !important');
    const stage = createHtmlStage({ root: el('root'), mode: 'frame' });
    const host = createHost([stage]);
    const fade = { ...MOVE, opacity: [{ frame: 1, value: 1 }] };
    host.load(docOf([layer('l1', { selector: '#a' }, fade)]));
    host.render(timeAt(4));
    expect(el('a').style.getPropertyValue('opacity')).toBe('1');
    el('a').style.setProperty('margin-left', '5px');
    // update (a new document), then render
    host.load(docOf([layer('l1', { selector: '#a' }, { x: [{ frame: 1, value: 10 }, { frame: 10, value: 100 }] })]));
    expect(el('a').style.getPropertyValue('margin-left')).toBe('5px');
    expect(el('a').style.getPropertyValue('opacity')).toBe('0.25');
    expect(el('a').style.getPropertyPriority('opacity')).toBe('important');
    host.render(timeAt(4));
    el('a').style.setProperty('padding-top', '2px');
    // release (layer removed)
    host.load(docOf([]));
    expect(el('a').style.getPropertyValue('margin-left')).toBe('5px');
    expect(el('a').style.getPropertyValue('padding-top')).toBe('2px');
    expect(el('a').style.getPropertyValue('transform')).toBe('');
    expect(el('a').style.getPropertyValue('color')).toBe('red');
    // detach
    host.load(docOf([layer('l1', { selector: '#a' })]));
    host.render(timeAt(4));
    el('a').style.setProperty('border-top-width', '3px');
    host.destroy();
    expect(el('a').style.getPropertyValue('border-top-width')).toBe('3px');
    expect(el('a').style.getPropertyValue('margin-left')).toBe('5px');
    expect(el('a').style.getPropertyValue('transform')).toBe('');
  });

  it('keeps a page style set on an element that had no style attribute', () => {
    const host = createHost([createHtmlStage({ root: el('root'), mode: 'frame' })]);
    host.load(docOf([layer('l1', { selector: '#b' })]));
    host.render(timeAt(3));
    el('b').style.setProperty('margin-left', '5px');
    host.destroy();
    expect(el('b').style.cssText).toBe('margin-left: 5px;');
  });
});
