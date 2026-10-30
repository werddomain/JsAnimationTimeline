// packages/runtime/src/stage/html/__tests__/htmlStage.propertyTimelines.test.ts
import type { ILayer } from '../../../model/layer';
import { installFakeAnimate } from '../../../player/__tests__/fakes';
import { defaultPropertyRegistry } from '../../../properties/PropertyRegistry';
import { createFakeStage, createHost, docOf, timeAt } from '../../__tests__/fakeStage';
import { StageDocumentError } from '../../reports';
import type { IStageLayer } from '../../types';
import { createHtmlStage } from '../createHtmlStage';
import { buildLayerKeyframes } from '../keyframes';

const legacy: ILayer = {
  id: 'legacy', type: 'layer', name: 'Legacy', target: { selector: '#box' },
  spans: [{ id: 'held', start: 1, end: 10, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.4 }] } }]
};
const modern: ILayer = {
  id: 'modern', type: 'layer', name: 'Modern', target: { selector: '#box' }, spans: [],
  propertyTimelines: { opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame: 5, value: { kind: 'number', value: 0.2 } }] } }
};

let fake: ReturnType<typeof installFakeAnimate>;
let element: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="box" style="opacity: 0.8; color: red"></div>';
  element = document.getElementById('box') as HTMLElement;
  fake = installFakeAnimate();
});
afterEach(() => fake.restore());

function bound(layer: ILayer): IStageLayer<Element> {
  return { layerId: layer.id, layer, object: element, target: { selector: '#box' } };
}

describe.each(['frame', 'waapi'] as const)('modern property timeline refusal in %s HTML mode', (mode) => {
  it('refuses the first document explicitly without changing its target', () => {
    const host = createHost([createHtmlStage({ mode })]);
    const original = element.getAttribute('style');
    expect(() => host.load(docOf([modern]))).toThrow(StageDocumentError);
    expect(host.document).toBeNull();
    expect(element.getAttribute('style')).toBe(original);
    expect(fake.animations).toHaveLength(0);
    host.destroy();
  });

  it('validates every layer before restoring styles or creating animations', () => {
    const stage = createHtmlStage({ mode });
    stage.update?.(docOf([legacy]), [bound(legacy)]);
    stage.render?.(timeAt(1), [{ layerId: legacy.id, object: element, target: { selector: '#box' },
      values: { opacity: 0.4 }, active: true, editorVisible: true }]);
    const original = element.getAttribute('style');
    const previous = fake.animations.slice();
    expect(() => stage.update?.(docOf([legacy, modern]), [bound(legacy), bound(modern)]))
      .toThrow(/adaptateur HTML.*indisponible/i);
    expect(element.getAttribute('style')).toBe(original);
    expect(fake.animations).toEqual(previous);
    expect(previous.every((animation) => animation.playState !== 'idle')).toBe(true);
    stage.detach?.();
  });

  it('rolls back to the previous document after a refused update', () => {
    const host = createHost([createHtmlStage({ mode })]);
    const previous = docOf([legacy]);
    host.load(previous);
    host.render(timeAt(1));
    expect(() => host.load(docOf([{ ...modern, id: legacy.id }]))).toThrow(StageDocumentError);
    expect(host.document).toBe(previous);
    host.render(timeAt(1));
    if (mode === 'frame') expect(element.style.opacity).toBe('0.4');
    else expect(fake.animations.filter((animation) => animation.playState !== 'idle')).toHaveLength(1);
    host.destroy();
    expect(element.style.opacity).toBe('0.8');
    expect(fake.animations.every((animation) => animation.playState === 'idle')).toBe(true);
  });

  it('allows empty dictionaries and modern tracks routed to a generic stage', () => {
    const objects = createFakeStage('objects');
    objects.objects.set('item', { name: 'item' });
    const host = createHost([createHtmlStage({ mode }), objects.stage]);
    expect(() => host.load(docOf([
      { ...legacy, propertyTimelines: {} },
      { ...modern, target: { ref: 'item', stage: 'objects' } }
    ]))).not.toThrow();
    host.render(timeAt(5));
    expect(objects.renders[0].states[0].values.opacity).toBe(0.2);
    host.destroy();
  });

  it('never renders a refused late-bound layer through another layer holding the same element', () => {
    const stage = createHtmlStage({ mode });
    const errors: unknown[] = [];
    const host = createHost([stage], errors);
    host.load(docOf([legacy, { ...modern, target: { ref: 'late', stage: 'html' } }]));
    host.render(timeAt(6));
    stage.bind('late', element);
    expect(errors.some((error) => error instanceof StageDocumentError)).toBe(true);
    host.render(timeAt(6));
    if (mode === 'frame') expect(element.style.opacity).toBe('0.4');
    else expect(fake.animations.filter((animation) => animation.playState !== 'idle')).toHaveLength(1);
    stage.bind('late', null);
    host.render(timeAt(6));
    if (mode === 'frame') expect(element.style.opacity).toBe('0.4');
    host.destroy();
    expect(element.style.opacity).toBe('0.8');
  });
});

describe('public Web Animations keyframe builder', () => {
  it('refuses numeric and nonnumeric modern tracks rather than sampling them as legacy spans', () => {
    for (const layer of [modern, { ...modern, propertyTimelines: {
      color: { initialValue: { kind: 'color' as const, r: 1, g: 0, b: 0, a: 1 }, keys: [] }
    } }]) {
      expect(() => buildLayerKeyframes(layer, docOf([]).settings, defaultPropertyRegistry)).toThrow(StageDocumentError);
    }
  });

  it('keeps an empty dictionary equivalent to a legacy layer', () => {
    expect(buildLayerKeyframes({ ...legacy, propertyTimelines: {} }, docOf([]).settings, defaultPropertyRegistry))
      .toEqual(buildLayerKeyframes(legacy, docOf([]).settings, defaultPropertyRegistry));
  });
});
