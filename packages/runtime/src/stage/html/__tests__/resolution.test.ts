// packages/runtime/src/stage/html/__tests__/resolution.test.ts
import type { ILayer } from '../../../model/layer';
import type { IPropertyTimeline, TimelinePropertyValue } from '../../../model/propertyTimeline';
import { defaultPropertyRegistry, PropertyRegistry } from '../../../properties/PropertyRegistry';
import { docOf } from '../../__tests__/fakeStage';
import type { HtmlBeforeFirstPolicy, IHtmlAnimationContext, IHtmlResolvedLayer } from '../animationTypes';
import { resolveHtmlConflict } from '../conflicts';
import { prepareHtmlResolution } from '../resolution';

const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const track = (keys: readonly [number, number][], initial = 1): IPropertyTimeline => ({
  initialValue: number(initial), keys: keys.map(([frame, value]) => ({ frame, value: number(value) }))
});
const layer = (id: string, selector: string, properties: Readonly<Record<string, IPropertyTimeline>>): ILayer => ({
  id, type: 'layer', name: id, target: { selector }, spans: [], propertyTimelines: properties
});
function bindings(layers: readonly ILayer[]): IHtmlResolvedLayer[] {
  return layers.map((item) => ({ layerId: item.id, layer: item, target: item.target!,
    elements: Array.from(document.querySelectorAll('selector' in item.target! ? item.target!.selector : '')) }));
}
function plan(layers: readonly ILayer[], context: IHtmlAnimationContext = { version: 1 }) {
  return prepareHtmlResolution(docOf(layers, 100), bindings(layers), context, defaultPropertyRegistry);
}
function values(result: ReturnType<typeof plan>, frame: number, id: string) {
  return Object.fromEntries(result.evaluate(frame).find((state) => state.element.id === id)!.properties
    .map((property) => [property.property, property.value]));
}

beforeEach(() => {
  document.body.innerHTML = '<button id="one" class="button"></button><button id="two" class="button primary"></button>' +
    '<button id="three" class="primary"></button><button id="four" class="button"></button>';
});

test('case 59 is evaluated per overlapping element without changing keys or layer order', () => {
  const all = layer('all', '.button', { opacity: track([[1, 0.5]]) });
  const specific = layer('specific', '#two', { opacity: track([[50, 0.8]]) });
  const original = JSON.stringify([all, specific]);
  for (const layers of [[all, specific], [specific, all]]) {
    const result = plan(layers);
    expect(result.diagnostics).toEqual([]);
    for (const frame of [1, 20, 49, 50, 100]) {
      expect(values(result, frame, 'two').opacity).toEqual(number(0.8));
      expect(values(result, frame, 'one').opacity).toEqual(number(0.5));
    }
    expect(result.sample('specific', 'opacity', 20)).toEqual({ status: 'value', value: number(0.8) });
    expect(result.sample('all', 'opacity', 20).status).toBe('refused');
  }
  expect(JSON.stringify([all, specific])).toBe(original);
});

test('case 59 remains stable after capturing the same held value at an earlier frame', () => {
  const layers = [layer('all', '.button', { opacity: track([[1, 0.5]]) }),
    layer('specific', '#two', { opacity: track([[20, 0.8], [50, 0.8]]) })];
  expect(values(plan(layers), 1, 'two').opacity).toEqual(number(0.8));
});

test('compound selector priority is local to overlap and to each property', () => {
  const layers = [layer('all', '.button', { opacity: track([[1, 0.5]]), x: track([[1, 30]], 0) }),
    layer('primary', '.primary.primary', { opacity: track([[50, 0.8]]) })];
  const result = plan(layers);
  expect(values(result, 20, 'two')).toEqual({ opacity: number(0.8), x: number(30) });
  expect(values(result, 20, 'three')).toEqual({ opacity: number(1) });
  expect(values(result, 70, 'three').opacity).toEqual(number(0.8));
});

test('a later specific tween diagnoses the uncovered prefix and keeps its normal later curve', () => {
  const opacity = { ...track([[50, 0.8], [100, 0.9]]), transitions: [{ id: 't', fromFrame: 50, toFrame: 100 }] };
  const result = plan([layer('all', '.button', { opacity: track([[1, 0.5]]) }), layer('specific', '#two', { opacity })]);
  expect(values(result, 20, 'two')).toEqual({});
  expect(result.diagnostics[0]).toMatchObject({ code: 'before-first-conflict', fromFrame: 1, toFrame: 50,
    toFrameExclusive: true, choices: ['specific'], policies: ['initial', 'first-key', 'underlying'] });
  expect(values(result, 75, 'two').opacity).toMatchObject({ kind: 'number', value: expect.closeTo(0.85) });
});

test.each<[HtmlBeforeFirstPolicy, number]>([['initial', 1], ['first-key', 0.8], ['underlying', 0.4]])(
  'a saved %s prefix decision changes no keys and ends at the first key', (policy, expected) => {
    const layers = [layer('all', '.button', { opacity: track([[1, 0.5], [20, 0.4]]) }),
      layer('specific', '#two', { opacity: track([[50, 0.8]]) })];
    const before = JSON.stringify(layers);
    const conflict = plan(layers).diagnostics[0];
    expect(() => resolveHtmlConflict({ version: 1 }, conflict, 'specific')).toThrow(/explicitement/);
    const context = resolveHtmlConflict({ version: 1 }, conflict, 'specific', policy);
    const resolved = plan(layers, JSON.parse(JSON.stringify(context)) as IHtmlAnimationContext);
    expect(resolved.diagnostics).toEqual([]);
    for (const frame of [20, 49, 49.99]) expect(values(resolved, frame, 'two').opacity).toEqual(number(expected));
    for (const frame of [50, 75, 100]) expect(values(resolved, frame, 'two').opacity).toEqual(number(0.8));
    expect(values(resolved, 20, 'one').opacity).toEqual(number(0.4));
    expect(resolved.sample('specific', 'opacity', 20)).toEqual({ status: 'value', value: number(expected) });
    expect(JSON.stringify(layers)).toBe(before);
  }
);

test('a lower edit after the first specific key does not make the earlier prefix ambiguous', () => {
  const result = plan([layer('all', '.button', { opacity: track([[1, 0.5], [70, 0.4]]) }),
    layer('specific', '#two', { opacity: track([[50, 0.8]]) })]);
  expect(result.diagnostics).toEqual([]);
  expect(values(result, 20, 'two').opacity).toEqual(number(0.8));
  expect(values(result, 80, 'one').opacity).toEqual(number(0.4));
});

test('a hidden constant lower layer cannot mask an ambiguous effective contribution', () => {
  const result = plan([layer('all', '.button', { opacity: track([[1, 0.5]]) }),
    layer('middle', '.button.primary', { opacity: track([[1, 0.6], [20, 0.7]]) }),
    layer('specific', '#two', { opacity: track([[50, 0.8]]) })]);
  expect(result.diagnostics[0]).toMatchObject({ code: 'before-first-conflict', layerIds: ['middle', 'specific'] });
  expect(values(result, 20, 'two')).toEqual({});
});

test('an explicit first-key temporal policy is respected without another confirmation', () => {
  const opacity: IPropertyTimeline = { ...track([[50, 0.8], [100, 0.9]]), beforeFirst: 'first-key' };
  const result = plan([layer('all', '.button', { opacity: track([[1, 0.5], [20, 0.4]]) }), layer('specific', '#two', { opacity })]);
  expect(result.diagnostics).toEqual([]);
  expect(values(result, 20, 'two').opacity).toEqual(number(0.8));
});

test('equal specificity is diagnosed for the entire duration, not just equal current values', () => {
  const a = { ...track([[1, 0], [100, 1]]), transitions: [{ id: 'a', fromFrame: 1, toFrame: 100 }] };
  const b = { ...track([[1, 0], [100, 1]]), transitions: [{ id: 'b', fromFrame: 1, toFrame: 100,
    easing: { kind: 'effect' as const, family: 'quadratic' as const, mode: 'in' as const } }] };
  const layers = [layer('all', '.button', { opacity: a }), layer('primary', '.primary', { opacity: b })];
  const result = plan(layers);
  expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'priority-conflict', fromFrame: 1, toFrame: 100,
    layerIds: ['all', 'primary'], choices: ['all', 'primary'], blocking: true })]);
  expect(values(result, 1, 'two')).toEqual({});
  const diagnostic = result.diagnostics[0];
  const context = resolveHtmlConflict({ version: 1 }, diagnostic, 'primary');
  const resolved = plan([...layers].reverse(), JSON.parse(JSON.stringify(context)) as IHtmlAnimationContext);
  expect(resolved.diagnostics).toEqual([]);
  expect(values(resolved, 50.5, 'two').opacity).toEqual(number(0.25));
  expect(context.resolutions).toHaveLength(1);
  const changed = [layers[0], { ...layers[1], target: { selector: '.primary.other' } }];
  document.getElementById('two')!.classList.add('other');
  expect(plan(changed, context).diagnostics.some((item) => item.code === 'stale-resolution')).toBe(true);
});

test('equivalent curves ignore transition identifiers and do not create arbitrary conflicts', () => {
  const a = { ...track([[1, 0], [100, 1]]), transitions: [{ id: 'a', fromFrame: 1, toFrame: 100 }] };
  const b = { ...a, transitions: [{ id: 'b', fromFrame: 1, toFrame: 100 }] };
  const result = plan([layer('all', '.button', { opacity: a }), layer('primary', '.primary', { opacity: b })]);
  expect(result.diagnostics).toEqual([]);
  expect(values(result, 50.5, 'two').opacity).toEqual(number(0.5));
});

test('unsupported selector specificity becomes an explicit overlap decision', () => {
  const result = plan([layer('all', '.button', { opacity: track([[1, 0.5]]) }),
    layer('primary', ':is(.primary)', { opacity: track([[1, 0.8]]) })]);
  expect(result.diagnostics[0]).toMatchObject({ code: 'unsupported-specificity', choices: ['all', 'primary'] });
  expect(values(result, 20, 'two')).toEqual({});
});

test('legacy contributions remain in a mixed plan', () => {
  const old: ILayer = { id: 'old', name: 'old', type: 'layer', target: { selector: '.button' },
    spans: [{ id: 'oldSpan', start: 1, end: 100, kind: 'static', tracks: { x: [{ frame: 1, value: 25 }] } }] };
  const result = plan([old, layer('specific', '#two', { opacity: track([[1, 0.8]]) })]);
  expect(values(result, 20, 'two')).toEqual({ x: number(25), opacity: number(0.8) });
});

test('CSS aliases arbitrate one actual property rather than overriding by iteration order', () => {
  const layers = [layer('all', '.button', { fade: track([[1, 0.5]]) }),
    layer('specific', '#two', { opacity: track([[1, 0.8]]) })];
  const result = plan(layers, { version: 1, bindings: { all: { fade: { kind: 'style', cssName: 'opacity' } } } });
  expect(values(result, 20, 'two')).toEqual({ opacity: number(0.8) });
  expect(result.sample('all', 'fade', 20).status).toBe('refused');
});

test('two aliases in the same object require a binding correction, not an ambiguous winner choice', () => {
  const result = plan([layer('all', '.button', { fade: track([[1, 0.5]]), opacity: track([[1, 0.8]]) })], {
    version: 1, bindings: { all: { fade: { kind: 'style', cssName: 'opacity' } } }
  });
  expect(result.diagnostics[0]).toMatchObject({ choices: [], blocking: true });
  expect(values(result, 20, 'one')).toEqual({});
  expect(() => resolveHtmlConflict({ version: 1 }, result.diagnostics[0], 'all')).toThrow();
});

test('first capture on an untracked object resolves an existing winning contribution', () => {
  const all = layer('all', '.button', { opacity: track([[1, 0.5]]) });
  const specific = layer('specific', '#two', {});
  const result = plan([all, specific]);
  expect(result.sample('specific', 'opacity', 20, number(1))).toEqual({ status: 'value', value: number(0.5) });
  expect(result.sample('specific', 'x', 20, number(0))).toMatchObject({ status: 'refused', code: 'unrecorded' });
  expect(result.sample('absent', 'opacity', 20, number(1))).toMatchObject({ status: 'refused', code: 'unavailable' });
});

test('first capture refuses partial overlap instead of taking a member value or baseline', () => {
  const result = plan([layer('all', '.button', { opacity: track([[1, 0.5]]) }), layer('primary', '.primary', {})]);
  expect(result.sample('primary', 'opacity', 20, number(1))).toMatchObject({ status: 'refused', code: 'unavailable' });
});

test('capture refuses incompatible units from the winning property', () => {
  const context: IHtmlAnimationContext = { version: 1, bindings: {
    all: { offset: { kind: 'style', cssName: 'margin-top', unit: 'px' } },
    specific: { offset: { kind: 'style', cssName: 'margin-top', unit: 'em' } }
  } };
  const result = plan([layer('all', '#two.primary', { offset: track([[1, 12]], 0) }), layer('specific', '#two', {})], context);
  expect(result.sample('specific', 'offset', 1, number(0))).toMatchObject({ status: 'refused', code: 'unavailable' });
});

test('shorthand/longhand overlap requires a choice and preserves unrelated contributions', () => {
  const layers = [layer('all', '.button', { margin: track([[1, 10]], 0), opacity: track([[1, 0.5]]) }),
    layer('specific', '#two', { top: track([[1, 20]], 0) })];
  const context: IHtmlAnimationContext = { version: 1, bindings: {
    all: { margin: { kind: 'style', cssName: 'margin', unit: 'px' } },
    specific: { top: { kind: 'style', cssName: 'margin-top', unit: 'px' } }
  } };
  const result = plan(layers, context);
  expect(result.diagnostics[0]).toMatchObject({ code: 'composition-conflict', choices: ['all', 'specific'] });
  expect(values(result, 20, 'two')).toEqual({ opacity: number(0.5) });
  expect(values(plan(layers, resolveHtmlConflict(context, result.diagnostics[0], 'specific')), 20, 'two'))
    .toEqual({ opacity: number(0.5), top: number(20) });
});

test('incompatible gradient structures are not silently assembled into one background', () => {
  const definition = { id: 'bg', cssName: 'background-image' as const, type: 'linear' as const,
    angle: 0, centerX: 50, centerY: 50, radiusX: 50, radiusY: 50, stops: [
      { id: 'a', position: 0, present: true, opacity: 1, color: { kind: 'color' as const, r: 1, g: 0, b: 0, a: 1 } },
      { id: 'b', position: 100, present: true, opacity: 1, color: { kind: 'color' as const, r: 0, g: 0, b: 1, a: 1 } }
    ] };
  const binding = { kind: 'gradient' as const, gradientId: 'bg', component: 'angle' as const };
  const layers = [layer('all', '.button', { angle: track([[1, 30]], 0) }), layer('specific', '#two', { angle: track([[1, 60]], 0) })];
  const context: IHtmlAnimationContext = { version: 1, bindings: { all: { angle: binding }, specific: { angle: binding } },
    gradients: { all: [definition], specific: [{ ...definition, type: 'conic' }] } };
  const result = plan(layers, context);
  expect(result.diagnostics[0]).toMatchObject({ code: 'composition-conflict' });
  expect(values(result, 20, 'two')).toEqual({});
  expect(values(plan(layers, resolveHtmlConflict(context, result.diagnostics[0], 'specific')), 20, 'two')).toEqual({ angle: number(60) });
});

test('prepared evaluation rejects nonfinite frames and returns detached evaluated values', () => {
  const result = plan([layer('all', '.button', { opacity: track([[1, 0.5]]) })]);
  expect(() => result.evaluate(NaN)).toThrow();
  const first = result.evaluate(1)[0].properties[0].value;
  if (first.kind === 'number') Object.assign(first, { value: 0.9 });
  expect(values(result, 1, 'one').opacity).toEqual(number(0.5));
});

test('HTML opacity aliases bound overshoot before rendering and resolved capture', () => {
  const fade = { ...track([[1, 0], [100, 1]], 0), transitions: [{ id: 'overshoot', fromFrame: 1, toFrame: 100,
    easing: { kind: 'effect' as const, family: 'back' as const, mode: 'out' as const, parameters: { amplitude: 3 } } }] };
  const context: IHtmlAnimationContext = { version: 1, bindings: { all: { fade: { kind: 'style', cssName: 'opacity' } } } };
  const result = plan([layer('all', '.button', { fade })], context);
  expect(values(result, 70, 'one').fade).toEqual(number(1));
  expect(result.sample('all', 'fade', 70)).toEqual({ status: 'value', value: number(1) });
  const registry = new PropertyRegistry();
  const interpolate = jest.fn(() => 1.5);
  registry.register({ name: 'fade', kind: 'value', unit: '', defaultValue: 0, interpolate });
  const layers = [layer('all', '.button', { fade })];
  const custom = prepareHtmlResolution(docOf(layers, 100), bindings(layers), context, registry);
  expect(custom.sample('all', 'fade', 70)).toEqual({ status: 'value', value: number(1) });
  expect(interpolate).toHaveBeenCalled();
});

test('gradient alpha and radius use the same bounded evaluated value for rendering and capture', () => {
  const definition = { id: 'bg', cssName: 'background-image' as const, type: 'radial' as const,
    angle: 0, centerX: 50, centerY: 50, radiusX: 50, radiusY: 50, stops: [
      { id: 'a', position: 0, present: true, opacity: 1, color: { kind: 'color' as const, r: 1, g: 0, b: 0, a: 1 } },
      { id: 'b', position: 100, present: true, opacity: 1, color: { kind: 'color' as const, r: 0, g: 0, b: 1, a: 1 } }
    ] };
  const animated = (mode: 'in' | 'out'): IPropertyTimeline => ({ ...track([[1, 0], [100, 1]], 0), transitions: [{
    id: mode, fromFrame: 1, toFrame: 100, easing: { kind: 'effect', family: 'back', mode, parameters: { amplitude: 3 } }
  }] });
  const result = plan([layer('all', '.button', { alpha: animated('out'), radius: animated('in') })], {
    version: 1, bindings: { all: { alpha: { kind: 'gradient', gradientId: 'bg', component: 'opacity', stopId: 'a' },
      radius: { kind: 'gradient', gradientId: 'bg', component: 'radiusX' } } }, gradients: { all: [definition] }
  });
  expect(values(result, 70, 'one').alpha).toEqual(number(1));
  expect(result.sample('all', 'alpha', 70)).toEqual({ status: 'value', value: number(1) });
  expect(values(result, 30, 'one').radius).toEqual(number(0));
  expect(result.sample('all', 'radius', 30)).toEqual({ status: 'value', value: number(0) });
});

test('changing an otherwise redundant key invalidates a saved decision ticket', () => {
  const layers = [layer('a', '.button', { opacity: track([[1, 0.5]]) }), layer('b', '.primary', { opacity: track([[1, 0.8]]) })];
  const context = resolveHtmlConflict({ version: 1 }, plan(layers).diagnostics[0], 'a');
  const changed = [layer('a', '.button', { opacity: track([[1, 0.5], [50, 0.5]]) }), layers[1]];
  const result = plan(changed, context);
  expect(result.diagnostics.map((item) => item.code)).toEqual(['priority-conflict', 'stale-resolution']);
  expect(values(result, 20, 'two')).toEqual({});
});
