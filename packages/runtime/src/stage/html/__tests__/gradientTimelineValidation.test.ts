// packages/runtime/src/stage/html/__tests__/gradientTimelineValidation.test.ts
import type { IPropertyTimeline, TimelinePropertyValue } from '../../../model/propertyTimeline';
import { createPropertyRegistry } from '../../../properties/PropertyRegistry';
import type { IHtmlAnimationContext, IHtmlResolvedLayer } from '../animationTypes';
import { HtmlPropertyInspection } from '../propertyInspection';

const boolean = (value: boolean): TimelinePropertyValue => ({ kind: 'boolean', value });
const context: IHtmlAnimationContext = { version: 1, bindings: { box: {
  left: { kind: 'gradient', gradientId: 'fill', component: 'present', stopId: 'left' },
  right: { kind: 'gradient', gradientId: 'fill', component: 'present', stopId: 'right' }
} }, gradients: { box: [{ id: 'fill', cssName: 'background-image', type: 'linear', angle: 90,
  centerX: 50, centerY: 50, radiusX: 50, radiusY: 50, stops: ['left', 'middle', 'right'].map((id, index) => ({
    id, color: { kind: 'color', r: 1, g: 0, b: 0, a: 1 }, opacity: 1, position: index * 50, present: true
  })) }] } };

function validate(left: IPropertyTimeline, right: IPropertyTimeline | undefined, previousRight?: IPropertyTimeline): string | undefined {
  const element = document.createElement('div');
  const layer: IHtmlResolvedLayer = { layerId: 'box', target: { element }, elements: [element],
    layer: { id: 'box', name: 'Box', type: 'layer', spans: [],
      propertyTimelines: { left, ...(previousRight === undefined ? {} : { right: previousRight }) } } };
  return new HtmlPropertyInspection().validate(layer, 'right', right, context, createPropertyRegistry());
}

it('checks the combined initial state before either track has its first key', () => {
  expect(validate(
    { initialValue: boolean(false), keys: [{ frame: 20, value: boolean(true) }] },
    { initialValue: boolean(false), keys: [{ frame: 30, value: boolean(true) }] }
  )).toMatch(/deux points/);
});

it('evaluates the explicit before-first policy instead of blindly composing initial values', () => {
  expect(validate(
    { initialValue: boolean(false), keys: [{ frame: 20, value: boolean(true) }], beforeFirst: 'first-key' },
    { initialValue: boolean(false), keys: [{ frame: 30, value: boolean(true) }] }
  )).toBeUndefined();
});

it('still rejects an invalid typed source value hidden by before-first evaluation', () => {
  expect(validate(
    { initialValue: boolean(true), keys: [] },
    { initialValue: boolean(true), keys: [{ frame: 20, value: { kind: 'text', value: 'false' } }] }
  )).toMatch(/type/i);
});

it('removes a deleted track instead of applying its previous initial value over the gradient base', () => {
  expect(validate(
    { initialValue: boolean(true), keys: [{ frame: 30, value: boolean(false) }] },
    undefined,
    { initialValue: boolean(false), keys: [{ frame: 20, value: boolean(true) }] }
  )).toBeUndefined();
});
