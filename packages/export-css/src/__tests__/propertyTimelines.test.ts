// packages/export-css/src/__tests__/propertyTimelines.test.ts
import type { ILayer, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { exportCss } from '../exportCss';

const legacy: ILayer = {
  id: 'legacy', type: 'layer', name: 'Legacy', target: { selector: '#legacy' },
  spans: [{ id: 'held', start: 1, end: 10, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.4 }] } }]
};
const modern: ILayer = {
  id: 'modern', type: 'layer', name: 'Modern', target: { selector: '#modern' }, spans: [],
  propertyTimelines: { opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame: 5, value: { kind: 'number', value: 0.2 } }] } }
};
const doc = (layers: ITimelineDocument['layers']): ITimelineDocument => ({
  version: '2.0.0', settings: { fps: 10, totalFrames: 10 }, layers
});

describe('CSS export with modern property timelines', () => {
  it('refuses the complete export when any layer needs the modern HTML adapter', () => {
    const document = doc([legacy, modern]);
    const original = JSON.stringify(document);
    const result = exportCss(document);
    expect(result.css).toBe('');
    expect(result.html).not.toContain('@keyframes');
    expect(result.warnings).toEqual([{ code: 'unsupported-property-timeline', layerId: 'modern',
      message: expect.stringMatching(/adaptateur HTML.*indisponible/i) }]);
    expect(JSON.stringify(document)).toBe(original);
  });

  it('reports every affected nested layer even with a generic target or no keys', () => {
    const result = exportCss(doc([{ id: 'folder', type: 'folder', name: 'Folder', children: [
      modern, { ...modern, id: 'object', target: { ref: 'item', stage: 'objects' },
        propertyTimelines: { label: { initialValue: { kind: 'text', value: 'Hello' }, keys: [] } } }
    ] }, legacy]));
    expect(result.css).toBe('');
    expect(result.warnings.map(({ code, layerId }) => [code, layerId]))
      .toEqual([['unsupported-property-timeline', 'modern'], ['unsupported-property-timeline', 'object']]);
  });

  it('keeps empty dictionaries equivalent to legacy exports', () => {
    expect(exportCss(doc([{ ...legacy, propertyTimelines: {} }]))).toEqual(exportCss(doc([legacy])));
  });
});
