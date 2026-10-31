// packages/export-css/src/continuous/__tests__/exportHtmlCss.browser.test.ts
import type { ILayer, ITimelineDocument, IPropertyTimeline, PropertyEasing } from '@kazo-ca/timeline-runtime';
import { createPropertyRegistry } from '@kazo-ca/timeline-runtime';
import { exportHtmlCss } from '../../exportHtmlCss';

const number = (value: number) => ({ kind: 'number' as const, value });
function scene(easing?: PropertyEasing): { readonly root: Element; readonly doc: ITimelineDocument } {
  document.head.innerHTML = '<style>.button { opacity:1 }</style>';
  document.body.innerHTML = '<main id="scene"><button class="button" id="first"></button><button class="button" id="specific"></button></main><button class="button" id="outside"></button>';
  const timeline: IPropertyTimeline = { initialValue: number(1), keys: [{ frame: 10, value: number(0.2) }, { frame: 80, value: number(0.9) }],
    transitions: [{ id: 'opacity', fromFrame: 10, toFrame: 80, ...(easing === undefined ? {} : { easing }) }] };
  const layer: ILayer = { type: 'layer', id: 'group', name: 'Group', target: { selector: '.button' }, spans: [], propertyTimelines: { opacity: timeline } };
  return { root: document.querySelector('#scene')!, doc: { version: '2.0.0', settings: { fps: 29, totalFrames: 97 }, layers: [layer] } };
}

describe('strict CSS export public boundary', () => {
  it('emits a complete continuous stylesheet with non-integral duration and exact unrounded offsets', () => {
    const { root, doc } = scene({ kind: 'bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 });
    const before = JSON.stringify(doc);
    const dom = document.documentElement.outerHTML;
    const result = exportHtmlCss(doc, { root, loop: true, prefix: 'example-' });
    expect(result.status).toBe('exported');
    if (result.status !== 'exported') throw new Error(JSON.stringify(result));
    expect(result.fidelity).toBe('continuous');
    expect(result.css).toContain(`animation-duration: ${97 / 29}s`);
    expect(result.css).toContain(`${9 * 100 / 97}% { opacity: 0.2; animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1); }`);
    expect(result.css).toContain('100% { opacity: 0.9;');
    expect(result.css).toContain('animation-iteration-count: infinite');
    expect(result.html).toBe(`<style>\n${result.css}\n</style>`);
    expect(JSON.stringify(doc)).toBe(before);
    expect(document.documentElement.outerHTML).toBe(dom);
  });

  it('refuses the whole document when only one object has an unsupported curve', () => {
    const { root, doc } = scene();
    const extra: ILayer = { type: 'layer', id: 'specific', name: 'Specific', target: { selector: '#specific' }, spans: [], propertyTimelines: {
      x: { initialValue: number(0), keys: [{ frame: 1, value: number(0) }, { frame: 97, value: number(100) }],
        transitions: [{ id: 'elastic', fromFrame: 1, toFrame: 97, easing: { kind: 'effect', family: 'elastic', mode: 'out' } }] }
    } };
    const result = exportHtmlCss({ ...doc, layers: [...doc.layers, extra] }, { root });
    expect(result).toMatchObject({ status: 'refused', css: '', html: '', alternatives: ['javascript', 'json'] });
    expect(result.diagnostics[0]).toMatchObject({ code: 'unsupported-easing', layerId: 'specific', property: 'x' });
  });

  it('reports important classes, resource limits and unsafe prefixes without a partial artifact', () => {
    const { root, doc } = scene();
    expect(exportHtmlCss(doc, { root, maxKeyframes: 2 })).toMatchObject({ status: 'refused', css: '', html: '', diagnostics: [expect.objectContaining({ code: 'resource-limit' })] });
    expect(exportHtmlCss(doc, { root, prefix: 'x</style>' })).toMatchObject({ status: 'refused', css: '', html: '' });
    document.head.innerHTML = '<style>.button { opacity:1 !important }</style>';
    expect(exportHtmlCss(doc, { root })).toMatchObject({ status: 'refused', css: '', html: '' });
  });

  it('keeps the source preview wrapped and rejects an executable interpolator', () => {
    const { root, doc } = scene();
    const entered = jest.fn();
    const sourceStage = { withSourceStyles<T>(action: () => T): T { entered(); return action(); } };
    const registry = createPropertyRegistry();
    registry.unregister('opacity');
    registry.register({ name: 'opacity', kind: 'style', cssName: 'opacity', unit: '', defaultValue: 1, min: 0, max: 1, interpolate: (a, b, p) => a + (b - a) * p * p });
    expect(exportHtmlCss(doc, { root, sourceStage, registry })).toMatchObject({ status: 'refused', diagnostics: [expect.objectContaining({ code: 'custom-interpolator' })] });
    expect(entered).toHaveBeenCalledTimes(1);
  });

  it('refuses a known keyframes name collision and accepts an explicit distinct prefix', () => {
    const { root, doc } = scene();
    document.head.innerHTML += '<style>@keyframes jst-1-opacity { from { opacity:1 } to { opacity:0 } }</style>';
    expect(exportHtmlCss(doc, { root })).toMatchObject({ status: 'refused', css: '', html: '',
      diagnostics: [expect.objectContaining({ code: 'keyframes-name-conflict' })] });
    expect(exportHtmlCss(doc, { root, prefix: 'another-' }).status).toBe('exported');
  });
});
