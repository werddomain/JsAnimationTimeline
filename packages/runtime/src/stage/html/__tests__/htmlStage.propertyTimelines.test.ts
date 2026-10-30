// packages/runtime/src/stage/html/__tests__/htmlStage.propertyTimelines.test.ts
import type { ILayer } from '../../../model/layer';
import { installFakeAnimate } from '../../../player/__tests__/fakes';
import { defaultPropertyRegistry } from '../../../properties/PropertyRegistry';
import { createFakeStage, createHost, docOf, timeAt } from '../../__tests__/fakeStage';
import { StageDocumentError } from '../../reports';
import { createHtmlStage } from '../createHtmlStage';
import { buildLayerKeyframes } from '../keyframes';
import type { IHtmlAnimationContext } from '../animationTypes';

const legacy: ILayer = { id: 'legacy', type: 'layer', name: 'Legacy', target: { selector: '#box' },
  spans: [{ id: 'held', start: 1, end: 10, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.4 }] } }] };
const modern: ILayer = { id: 'modern', type: 'layer', name: 'Modern', target: { selector: '#box' }, spans: [],
  propertyTimelines: { opacity: { initialValue: { kind: 'number', value: 0.8 }, keys: [{ frame: 5, value: { kind: 'number', value: 0.2 } }] } } };
let fake: ReturnType<typeof installFakeAnimate>;
let element: HTMLElement;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="box" style="opacity: 0.8; color: red"></div>';
  element = document.getElementById('box') as HTMLElement;
  fake = installFakeAnimate();
});
afterEach(() => fake.restore());

describe.each(['frame', 'waapi'] as const)('modern property timelines in %s HTML mode', (mode) => {
  it('uses exact rendering, holds the source before the first key and restores owned styles', () => {
    const stage = createHtmlStage({ mode });
    const host = createHost([stage]);
    host.load(docOf([modern]));
    expect(stage.effectiveMode).toBe('frame');
    host.render(timeAt(3)); expect(element.style.opacity).toBe('0.8');
    host.render(timeAt(6.25)); expect(element.style.opacity).toBe('0.2');
    expect(fake.animations).toHaveLength(0);
    element.style.borderWidth = '3px';
    host.destroy();
    expect(element.style.opacity).toBe('0.8'); expect(element.style.color).toBe('red'); expect(element.style.borderWidth).toBe('3px');
  });

  it('rejects invalid context before changing the document, preview or existing animations', () => {
    const stage = createHtmlStage({ mode }); const host = createHost([stage]);
    const previous = docOf([legacy]); host.load(previous); host.render(timeAt(1));
    const style = element.getAttribute('style'); const animations = fake.animations.slice();
    expect(() => stage.setAnimationContext({ version: 5 } as unknown as IHtmlAnimationContext)).toThrow();
    expect(host.document).toBe(previous); expect(element.getAttribute('style')).toBe(style);
    expect(fake.animations).toEqual(animations); expect(animations.every((animation) => animation.playState !== 'idle')).toBe(true);
    host.destroy();
  });

  it('switches between legacy and modern documents without losing original styles', () => {
    const stage = createHtmlStage({ mode }); const host = createHost([stage]);
    host.load(docOf([legacy])); host.render(timeAt(1));
    host.load(docOf([{ ...modern, id: legacy.id }])); host.render(timeAt(6));
    expect(element.style.opacity).toBe('0.2'); expect(stage.effectiveMode).toBe('frame');
    host.load(docOf([legacy])); host.render(timeAt(1));
    expect(stage.effectiveMode).toBe(mode);
    if (mode === 'frame') expect(element.style.opacity).toBe('0.4');
    host.destroy(); expect(element.style.opacity).toBe('0.8');
    expect(fake.animations.every((animation) => animation.playState === 'idle')).toBe(true);
  });

  it('keeps empty dictionaries and generic stage routing compatible', () => {
    const objects = createFakeStage('objects'); objects.objects.set('item', { name: 'item' });
    const host = createHost([createHtmlStage({ mode }), objects.stage]);
    host.load(docOf([{ ...legacy, propertyTimelines: {} }, { ...modern, target: { ref: 'item', stage: 'objects' } }]));
    host.render(timeAt(5)); expect(objects.renders[0].states[0].values.opacity).toBe(0.2); host.destroy();
  });

  it('resolves a modern layer bound after load and restores it on unbind', () => {
    const stage = createHtmlStage({ mode }); const host = createHost([stage]);
    host.load(docOf([{ ...modern, target: { ref: 'late', stage: 'html' } }]));
    expect(host.missingTargets).toEqual(['modern']); stage.bind('late', element); host.render(timeAt(6));
    expect(element.style.opacity).toBe('0.2'); stage.bind('late', null); host.render(timeAt(6));
    expect(host.missingTargets).toEqual(['modern']); expect(element.style.opacity).toBe('0.8'); host.destroy();
  });
});

describe('public Web Animations keyframe builder', () => {
  it('continues refusing lossy modern conversion; exact HTML stage handles modern playback', () => {
    expect(() => buildLayerKeyframes(modern, docOf([]).settings, defaultPropertyRegistry)).toThrow(StageDocumentError);
  });
  it('keeps an empty dictionary equivalent to a legacy layer', () => {
    expect(buildLayerKeyframes({ ...legacy, propertyTimelines: {} }, docOf([]).settings, defaultPropertyRegistry))
      .toEqual(buildLayerKeyframes(legacy, docOf([]).settings, defaultPropertyRegistry));
  });
});
