// packages/export-css/src/__tests__/cssTracks.test.ts
/**
 * Copie d'un calque réduite à ses pistes CSS, avec un avertissement par piste
 * ignorée.
 */

import { createPropertyRegistry } from '@werddomain/timeline-runtime';
import type { ILayer } from '@werddomain/timeline-runtime';
import { keepCssTracks } from '../cssTracks';
import { RegistryWithValueProperty } from './registry';

const mixedLayer: ILayer = {
  id: 'hero',
  type: 'layer',
  name: 'Héros',
  target: { selector: '#hero' },
  spans: [
    {
      id: 's1',
      start: 1,
      end: 10,
      kind: 'tween',
      tracks: {
        x: [{ frame: 1, value: 0 }, { frame: 10, value: 100 }],
        frameIndex: [{ frame: 1, value: 0 }, { frame: 10, value: 11 }],
        glow: [{ frame: 1, value: 0 }]
      }
    },
    { id: 's2', start: 11, end: 20, kind: 'static', tracks: { glow: [{ frame: 11, value: 1 }], opacity: [{ frame: 11, value: 0.5 }] } },
    { id: 's3', start: 21, end: 30, kind: 'blank' }
  ]
};

describe('keepCssTracks', () => {
  it('keeps the transform and style tracks and warns once per skipped name', () => {
    const { layer, warnings } = keepCssTracks(mixedLayer, new RegistryWithValueProperty());

    expect(layer.spans.map((span) => Object.keys(span.tracks ?? {}))).toEqual([['x'], ['opacity'], []]);
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'non-css-property', layerId: 'hero', property: 'frameIndex' }),
      expect.objectContaining({ code: 'unknown-property', layerId: 'hero', property: 'glow' })
    ]);
    warnings.forEach((warning) => expect(warning.message).toContain('hero'));
  });

  it('never modifies the original layer', () => {
    const before = JSON.stringify(mixedLayer);

    keepCssTracks(mixedLayer, createPropertyRegistry());

    expect(JSON.stringify(mixedLayer)).toBe(before);
  });

  it('keeps spans without tracks as they are and returns no warning for a CSS-only layer', () => {
    const cssOnly: ILayer = { ...mixedLayer, spans: [mixedLayer.spans[2]] };

    const { layer, warnings } = keepCssTracks(cssOnly, createPropertyRegistry());

    expect(layer.spans[0]).toBe(cssOnly.spans[0]);
    expect(warnings).toEqual([]);
  });
});
