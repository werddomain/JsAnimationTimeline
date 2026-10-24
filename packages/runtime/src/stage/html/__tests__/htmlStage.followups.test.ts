// packages/runtime/src/stage/html/__tests__/htmlStage.followups.test.ts
/**
 * Scène HTML, deuxième suite de la revue R7 : propriété personnalisée
 * `border-radius` sur un coin posé par la page, deux calques sur le même
 * élément dont un seul change de ref, `visibility … !important` rendue après
 * l'œil et après `release`, `bind` avant le premier `load`, et document
 * refusé par une scène suivante après l'`update` du mode `frame`.
 */

import type { ILayer } from '../../../model/layer';
import type { PropertyTracks } from '../../../model/span';
import { installFakeAnimate } from '../../../player/__tests__/fakes';
import { createPropertyRegistry, defaultPropertyRegistry } from '../../../properties/PropertyRegistry';
import type { PropertyRegistry } from '../../../properties/PropertyRegistry';
import { createFakeStage, docOf, timeAt } from '../../__tests__/fakeStage';
import { StageDocumentError } from '../../reports';
import { StageHost } from '../../StageHost';
import type { IStage } from '../../types';
import { createHtmlStage } from '../createHtmlStage';

let fake: ReturnType<typeof installFakeAnimate>;

beforeEach(() => {
  document.body.innerHTML = '<main id="root"><div id="a" style="color: red"></div><div id="b"></div></main>';
  fake = installFakeAnimate();
});

afterEach(() => fake.restore());

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

const MOVE: PropertyTracks = { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] };
const FADE: PropertyTracks = { opacity: [{ frame: 1, value: 1 }, { frame: 10, value: 0 }] };

function layer(id: string, target: ILayer['target'], tracks: PropertyTracks = MOVE): ILayer {
  return { id, type: 'layer', name: id, target, spans: [{ id: `${id}-s`, start: 1, end: 10, kind: 'tween', tracks }] };
}

function hostOf(stages: readonly IStage[], options: { registry?: PropertyRegistry; isEditorVisible?: (layerId: string) => boolean } = {}): StageHost {
  return new StageHost({
    stages,
    registry: options.registry ?? defaultPropertyRegistry,
    onError: () => undefined,
    isEditorVisible: options.isEditorVisible,
    now: () => ({ time: timeAt(4), state: { playing: false, speed: 1 } })
  });
}

describe('custom shorthand property in frame mode', () => {
  it('keeps the corner the page set after release and detach', () => {
    el('a').setAttribute('style', 'border-top-left-radius: 4px; border-top-right-radius: 2px !important');
    const registry = createPropertyRegistry([{ name: 'radius', kind: 'style', cssName: 'border-radius', unit: 'px', defaultValue: 0 }]);
    const host = hostOf([createHtmlStage({ root: el('root'), mode: 'frame' })], { registry });
    const round = { radius: [{ frame: 1, value: 0 }, { frame: 10, value: 18 }] };
    host.load(docOf([layer('l1', { selector: '#a' }, round)]));
    host.render(timeAt(4));
    expect(el('a').style.getPropertyValue('border-radius')).toBe('6px');
    host.load(docOf([]));
    expect(el('a').style.getPropertyValue('border-top-left-radius')).toBe('4px');
    expect(el('a').style.getPropertyPriority('border-top-right-radius')).toBe('important');
    expect(el('a').style.getPropertyValue('border-radius')).toBe('');
    host.load(docOf([layer('l1', { selector: '#a' }, round)]));
    host.render(timeAt(4));
    host.destroy();
    expect(el('a').style.getPropertyValue('border-top-left-radius')).toBe('4px');
    expect(el('a').style.getPropertyValue('border-top-right-radius')).toBe('2px');
  });
});

describe('two layers on the same element, one ref rebound', () => {
  it('keeps the element styled by the other layer, then restores it when that one leaves', () => {
    const stage = createHtmlStage({ root: el('root'), mode: 'frame', refs: { logo: el('a') } });
    const host = hostOf([stage]);
    host.load(docOf([layer('l1', { ref: 'logo', stage: 'html' }), layer('l2', { selector: '#a' }, FADE)]));
    host.render(timeAt(4));
    stage.bind('logo', el('b'));
    expect(el('a').style.getPropertyValue('opacity')).toBe('0.6667');
    expect(el('a').style.getPropertyValue('transform')).toBe('');
    expect(el('b').style.getPropertyValue('transform')).toContain('translateX(30px)');
    // l1 already moved: releasing it on the old element again is ignored.
    stage.release?.('l1', el('a'));
    host.render(timeAt(7));
    expect(el('a').style.getPropertyValue('opacity')).toBe('0.3333');
    host.load(docOf([layer('l1', { ref: 'logo', stage: 'html' })]));
    expect(el('a').style.cssText).toBe('color: red;');
    host.render(timeAt(4));
    expect(el('b').style.getPropertyValue('transform')).toContain('translateX(30px)');
    host.destroy();
    expect(el('b').hasAttribute('style')).toBe(false);
  });
});

describe('visibility !important set by the page', () => {
  it('comes back after the editor eye and after release', () => {
    el('a').setAttribute('style', 'visibility: collapse !important');
    let visible = false;
    const host = hostOf([createHtmlStage({ root: el('root'), mode: 'frame' })], { isEditorVisible: () => visible });
    host.load(docOf([layer('l1', { selector: '#a' })]));
    host.render(timeAt(2));
    expect(el('a').style.getPropertyValue('visibility')).toBe('hidden');
    visible = true;
    host.render(timeAt(3));
    expect(el('a').style.getPropertyValue('visibility')).toBe('collapse');
    expect(el('a').style.getPropertyPriority('visibility')).toBe('important');
    visible = false;
    host.render(timeAt(4));
    host.load(docOf([]));
    expect(el('a').style.getPropertyValue('visibility')).toBe('collapse');
    expect(el('a').style.getPropertyPriority('visibility')).toBe('important');
  });

  it('comes back after release of a layer managing visibility', () => {
    el('a').setAttribute('style', 'visibility: collapse !important');
    const host = hostOf([createHtmlStage({ root: el('root'), mode: 'frame' })]);
    const blinking: ILayer = { ...layer('l1', { selector: '#a' }), spans: [{ id: 's', start: 1, end: 2, kind: 'static' }, { id: 'b', start: 3, end: 10, kind: 'blank' }] };
    host.load(docOf([blinking]));
    host.render(timeAt(5));
    expect(el('a').style.getPropertyValue('visibility')).toBe('hidden');
    host.load(docOf([]));
    expect(el('a').style.getPropertyValue('visibility')).toBe('collapse');
    expect(el('a').style.getPropertyPriority('visibility')).toBe('important');
  });
});

describe('bind before the first load', () => {
  it.each(['waapi', 'frame'] as const)('resolves the bound element on load (%s)', (mode) => {
    const stage = createHtmlStage({ root: el('root'), mode });
    stage.bind('logo', el('b'));
    const host = hostOf([stage]);
    host.load(docOf([layer('l1', { ref: 'logo', stage: 'html' })]));
    host.render(timeAt(4));
    expect(host.missingTargets).toEqual([]);
    if (mode === 'frame') {
      expect(el('b').style.getPropertyValue('transform')).toContain('translateX(30px)');
    } else {
      expect(fake.animations.map((animation) => animation.target)).toEqual([el('b')]);
    }
    host.destroy();
    expect(el('b').hasAttribute('style')).toBe(false);
  });
});

describe('document refused by a later stage after the frame-mode update', () => {
  function refusingSecond(): IStage {
    const canvas = createFakeStage('canvas');
    let updates = 0;
    return { ...canvas.stage, update: () => {
      updates += 1;
      if (updates === 2) {
        throw new StageDocumentError('refused');
      }
    } };
  }

  it('styles the elements as for the previous document, and leaks nothing', () => {
    const stage = createHtmlStage({ root: el('root'), mode: 'frame' });
    const host = hostOf([stage, refusingSecond()]);
    host.load(docOf([layer('l1', { selector: '#a' }), layer('l2', { selector: '#a' }, FADE)]));
    host.render(timeAt(4));
    const before = el('a').style.cssText;
    // l1 moves to #b, l2 changes tracks (opacity no longer animated), l3 is new on #b.
    const refused = docOf([layer('l1', { selector: '#b' }), layer('l2', { selector: '#a' }), layer('l3', { selector: '#b' }, FADE)]);
    expect(() => host.load(refused)).toThrow('refused');
    expect(el('a').style.cssText).toBe(before);
    expect(el('b').hasAttribute('style')).toBe(false);
    host.render(timeAt(7));
    expect(el('a').style.getPropertyValue('opacity')).toBe('0.3333');
    expect(el('b').hasAttribute('style')).toBe(false);
    host.load(docOf([layer('l2', { selector: '#a' }, FADE)]));
    host.render(timeAt(4));
    expect(el('a').style.getPropertyValue('transform')).toBe('');
    host.destroy();
    expect(el('a').style.cssText).toBe('color: red;');
    expect(el('b').hasAttribute('style')).toBe(false);
  });
});
