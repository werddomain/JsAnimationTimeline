// packages/runtime/src/stage/html/__tests__/cssBindings.test.ts
import { defaultPropertyRegistry } from '../../../properties/PropertyRegistry';
import type { TimelinePropertyValue } from '../../../model/propertyTimeline';
import { htmlBindingDestination, isHtmlPropertyBinding, resolveHtmlBinding } from '../cssBindings';
import { captureHtmlTransformBase, readHtmlPropertyBase } from '../cssBaseline';
import { composeHtmlDeclarations } from '../cssCompose';
import type { HtmlPropertyBinding, IHtmlResolvedBinding } from '../cssTypes';

const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
function binding(name: string, kind: TimelinePropertyValue['kind'], explicit?: HtmlPropertyBinding): IHtmlResolvedBinding {
  const result = resolveHtmlBinding(name, kind, defaultPropertyRegistry, explicit);
  if (result.status !== 'value') throw new Error(result.reason);
  return result.value;
}
function element(css: string): HTMLElement {
  const result = document.createElement('div');
  result.style.cssText = css;
  document.body.append(result);
  return result;
}
afterEach(() => { document.body.replaceChildren(); });

describe('HTML typed CSS bindings and baselines', () => {
  it('maps built-ins and kebab CSS names while rejecting plain object-only properties', () => {
    expect(binding('x', 'number').binding).toEqual({ kind: 'transform', component: 'x' });
    expect(binding('opacity', 'number').binding).toEqual({ kind: 'style', cssName: 'opacity', unit: '' });
    expect(binding('background-color', 'color').binding).toEqual({ kind: 'style', cssName: 'background-color' });
    expect(resolveHtmlBinding('not A CSS name', 'number', defaultPropertyRegistry).status).toBe('unsupported');
    expect(resolveHtmlBinding('display', 'boolean', defaultPropertyRegistry).status).toBe('unsupported');
  });

  it('validates serialized bindings and uses unambiguous destination identities', () => {
    expect(isHtmlPropertyBinding({ kind: 'style', cssName: 'opacity; color', unit: '' })).toBe(false);
    expect(isHtmlPropertyBinding({ kind: 'style', cssName: 'all' })).toBe(false);
    expect(isHtmlPropertyBinding({ kind: 'style', cssName: 'margin-top', unit: 'px;display:none' })).toBe(false);
    expect(isHtmlPropertyBinding({ kind: 'gradient', gradientId: 'g', component: 'color' })).toBe(false);
    expect(isHtmlPropertyBinding({ kind: 'transform', component: 'x', surprise: true })).toBe(false);
    expect(htmlBindingDestination({ kind: 'style', cssName: 'opacity' })).toBe(htmlBindingDestination(binding('opacity', 'number').binding));
    expect(htmlBindingDestination({ kind: 'gradient', gradientId: 'g/a', stopId: 'b', component: 'position' }))
      .not.toBe(htmlBindingDestination({ kind: 'gradient', gradientId: 'g', stopId: 'a/b', component: 'position' }));
  });

  it('normalizes effective CSS colors to the timeline 0..1 color model', () => {
    const target = element('background-color: rgba(255, 128, 0, 0.25); color: blue');
    expect(readHtmlPropertyBase(target, binding('background-color', 'color'))).toEqual({ status: 'value',
      value: { kind: 'color', r: 1, g: 128 / 255, b: 0, a: 0.25 } });
    expect(readHtmlPropertyBase(target, binding('color', 'color'))).toEqual({ status: 'value',
      value: { kind: 'color', r: 0, g: 0, b: 1, a: 1 } });
  });

  it('requires exact numeric units and does not silently convert a relative length', () => {
    const target = element('margin-top: 12px; width: 50%; opacity: 0.8');
    expect(readHtmlPropertyBase(target, binding('margin-top', 'number', { kind: 'style', cssName: 'margin-top', unit: 'px' })))
      .toEqual({ status: 'value', value: number(12) });
    expect(readHtmlPropertyBase(target, binding('width', 'number', { kind: 'style', cssName: 'width', unit: 'px' })).status).toBe('unsupported');
    expect(readHtmlPropertyBase(target, binding('opacity', 'number'))).toEqual({ status: 'value', value: number(.8) });
    expect(readHtmlPropertyBase(target, binding('width', 'text'))).toEqual({ status: 'value', value: { kind: 'text', value: '50%' } });
  });

  it('keeps unrelated 2D transform components while changing only translation', () => {
    const target = element('transform: matrix(0, 2, -3, 0, 12, 15); color: red');
    const initial = captureHtmlTransformBase(target);
    expect(initial.status).toBe('value');
    if (initial.status !== 'value') throw new Error(initial.reason);
    expect(initial.value.x).toBe(12);
    expect(initial.value.y).toBe(15);
    expect(initial.value.rotation).toBeCloseTo(90);
    expect(initial.value.scaleX).toBeCloseTo(2);
    expect(initial.value.scaleY).toBeCloseTo(3);
    const css = composeHtmlDeclarations(target, { x: number(40) }, { x: binding('x', 'number') }, [], initial.value);
    expect(css.diagnostics).toEqual([]);
    expect(css.declarations.transform).toContain('translate(40px, 15px)');
    expect(css.declarations.transform).toContain('rotate(90deg)');
    expect(css.declarations.transform).toContain('scale(2, 3)');
    expect(target.style.transform).toBe('matrix(0, 2, -3, 0, 12, 15)');
    expect(target.style.color).toBe('red');
  });

  it('represents a reflected and sheared matrix exactly in its canonical composition', () => {
    const target = element('transform: matrix(2, 0, 3, -4, 8, 9)');
    const base = captureHtmlTransformBase(target);
    expect(base.status).toBe('value');
    if (base.status !== 'value') throw new Error(base.reason);
    expect(base.value.scaleX).toBe(2);
    expect(base.value.scaleY).toBe(-4);
    expect(Math.tan(base.value.skewX * Math.PI / 180) * base.value.scaleY).toBeCloseTo(3);
    expect(base.value.skewY).toBe(0);
  });

  it('refuses unsupported 3D and singular transforms instead of losing source geometry', () => {
    for (const transform of ['matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', 'matrix(0,0,0,1,0,0)']) {
      const target = element(`transform: ${transform}`);
      expect(captureHtmlTransformBase(target).status).toBe('unsupported');
      const result = composeHtmlDeclarations(target, { x: number(20) }, { x: binding('x', 'number') });
      expect(result.declarations.transform).toBeUndefined();
      expect(result.diagnostics).toHaveLength(1);
      expect(target.style.transform).toBe(transform);
    }
  });

  it('captures equivalent 2D function lists and angle units without losing reflections', () => {
    const first = captureHtmlTransformBase(element('transform: translate(12px, 15px) rotate(100grad) scale(2, -3)'));
    expect(first.status).toBe('value');
    if (first.status !== 'value') throw new Error(first.reason);
    expect(first.value.rotation).toBeCloseTo(90);
    expect(first.value.scaleY).toBeCloseTo(-3);
    expect(first.value.x).toBe(12);
    expect(first.value.y).toBe(15);
    expect(captureHtmlTransformBase(element('transform: translateX(50%)')).status).toBe('unsupported');
    expect(captureHtmlTransformBase(element('transform: translateX(var(--offset))')).status).toBe('unsupported');
  });

  it('keeps supported independent properties when a transform is not representable', () => {
    const target = element('transform: perspective(200px) rotateY(30deg); opacity: 1');
    const result = composeHtmlDeclarations(target, { x: number(40), opacity: number(.6) },
      { x: binding('x', 'number'), opacity: binding('opacity', 'number') });
    expect(result.declarations).toEqual({ opacity: '0.6' });
    expect(result.diagnostics).toEqual([expect.objectContaining({ property: 'x' })]);
  });

  it('never injects a second declaration or evaluates CSS payload text', () => {
    const target = element('display: block');
    const before = target.getAttribute('style');
    for (const text of ['none; color:red', 'expression(alert(1))', 'url(javascript:alert(1))', '@import url(test)', 'none } body { display: none']) {
      const result = composeHtmlDeclarations(target, { display: { kind: 'text', value: text } }, { display: binding('display', 'text') });
      expect(result.declarations).toEqual({});
      expect(result.diagnostics).toHaveLength(1);
    }
    expect(target.getAttribute('style')).toBe(before);
  });

  it('uses the supplied source transform even if the target already shows an animated frame', () => {
    const target = element('transform: matrix(1,0,0,1,8,12)');
    const baseline = captureHtmlTransformBase(target);
    if (baseline.status !== 'value') throw new Error(baseline.reason);
    target.style.transform = 'translate(999px,999px)';
    const result = composeHtmlDeclarations(target, { x: number(20) }, { x: binding('x', 'number') }, [], baseline.value);
    expect(result.declarations.transform).toContain('translate(20px, 12px)');
    expect(target.style.transform).toBe('translate(999px,999px)');
  });

  it('serializes colors, plain numbers and held CSS text without writing the target', () => {
    const target = element('opacity: 1; display: block');
    const result = composeHtmlDeclarations(target,
      { color: { kind: 'color', r: 1, g: 0, b: .5, a: .25 }, opacity: number(.4), display: { kind: 'text', value: 'none' } },
      { color: binding('color', 'color'), opacity: binding('opacity', 'number'), display: binding('display', 'text') });
    expect(result.diagnostics).toEqual([]);
    expect(result.declarations).toEqual({ color: 'rgba(255, 0, 127.5, 0.25)', opacity: '0.4', display: 'none' });
    expect(target.style.opacity).toBe('1');
    expect(target.style.display).toBe('block');
  });

  it('reports invalid declarations and duplicate CSS destinations without partial overriding', () => {
    const target = element('color: blue');
    const result = composeHtmlDeclarations(target,
      { color: { kind: 'text', value: 'red; background: black' }, one: number(.3), two: number(.5) },
      { color: binding('color', 'text'), one: binding('opacity', 'number'), two: binding('opacity', 'number') });
    expect(result.declarations).toEqual({});
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
    expect(target.style.color).toBe('blue');
  });
});
