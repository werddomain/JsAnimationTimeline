// packages/export-css/src/__tests__/exportCss.test.ts
/**
 * Export d'un document en CSS : fichier de référence, avertissements (cible
 * non sélecteur, propriété non CSS ou inconnue, calque invalide), options, et
 * accord avec l'évaluation du runtime à chaque image entière.
 */

import * as fs from 'fs';
import * as path from 'path';
import { computeCssDeclarations, createEasingFunction, createPropertyRegistry, evaluateLayer } from '@kazo-ca/timeline-runtime';
import type { ILayer, ITimelineDocument, LayerTarget } from '@kazo-ca/timeline-runtime';
import { exportCss } from '../exportCss';
import { RegistryWithValueProperty } from './registry';

function readFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8').replace(/\r\n/g, '\n');
}

function doc(layers: ITimelineDocument['layers'], totalFrames = 24, fps = 12): ITimelineDocument {
  return { version: '2.0.0', settings: { fps, totalFrames }, layers };
}

/** A mixed layer: selector target, a CSS track, a value-like track and an unknown track. */
const hero: ILayer = {
  id: 'hero',
  type: 'layer',
  name: 'Héros',
  target: { selector: '#hero' },
  spans: [
    {
      id: 'h1',
      start: 1,
      end: 12,
      kind: 'tween',
      easing: 'ease-out',
      tracks: {
        x: [{ frame: 1, value: 0 }, { frame: 12, value: 100 }],
        frameIndex: [{ frame: 1, value: 0 }, { frame: 12, value: 11 }],
        glow: [{ frame: 1, value: 0 }, { frame: 12, value: 1 }]
      }
    },
    { id: 'h2', start: 13, end: 18, kind: 'static', tracks: { opacity: [{ frame: 13, value: 0.5 }] } },
    { id: 'h3', start: 19, end: 24, kind: 'blank' }
  ]
};

const referenceDoc = doc([
  hero,
  {
    id: 'scene',
    type: 'folder',
    name: 'Scène',
    children: [
      {
        id: 'canvas-sprite',
        type: 'layer',
        name: 'Sprite',
        target: { ref: 'sprite', stage: 'canvas' } as unknown as LayerTarget,
        spans: [{ id: 'c1', start: 1, end: 24, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 24, value: 10 }] } }]
      },
      {
        id: 'badge',
        type: 'layer',
        name: 'Badge',
        target: { selector: '.badge > span' },
        spans: [
          {
            id: 'b1',
            start: 7,
            end: 24,
            kind: 'tween',
            tracks: { rotation: [{ frame: 7, value: 0 }, { frame: 24, value: 90 }], opacity: [{ frame: 7, value: 0 }, { frame: 24, value: 1 }] }
          }
        ]
      }
    ]
  },
  { id: 'no-target', type: 'layer', name: 'Sans cible', spans: [{ id: 'n1', start: 1, end: 24, kind: 'static' }] }
]);

describe('exportCss', () => {
  it('matches the reference file and lists what it skipped', () => {
    const result = exportCss(referenceDoc, { registry: new RegistryWithValueProperty() });

    expect(result.css).toBe(readFixture('reference.css'));
    expect(result.warnings.map(({ code, layerId, property }) => [code, layerId, property])).toEqual([
      ['non-css-property', 'hero', 'frameIndex'],
      ['unknown-property', 'hero', 'glow'],
      ['unsupported-target', 'canvas-sprite', undefined],
      ['unsupported-target', 'no-target', undefined]
    ]);
  });

  it('warns about a live element target and an unsafe selector, and never throws', () => {
    const element = { tagName: 'DIV' } as unknown as Element;
    const layers: ILayer[] = [
      { ...hero, id: 'live', target: { element } },
      { ...hero, id: 'unsafe', target: { selector: '#a { color: red }' } }
    ];

    const result = exportCss(doc(layers));

    expect(result.css).toBe('');
    expect(result.warnings.filter((w) => w.code === 'unsupported-target').map((w) => w.layerId)).toEqual(['live', 'unsafe']);
  });

  it('skips a layer that cannot be evaluated with an invalid-layer warning', () => {
    const broken: ILayer = {
      ...hero,
      id: 'broken',
      spans: [{ id: 'x1', start: 1, end: 10, kind: 'tween', easing: 'bounce' as 'ease', tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 5 }] } }]
    };

    const result = exportCss(doc([broken, { ...hero, id: 'ok' }]));

    expect(result.warnings.find((w) => w.code === 'invalid-layer')).toEqual(expect.objectContaining({ layerId: 'broken' }));
    expect(result.css).toContain('@keyframes tl-ok {');
    expect(result.css).not.toContain('tl-broken');
  });

  it('applies the prefix and the loop option, and skips layers that never change', () => {
    const still: ILayer = { id: 'still', type: 'layer', name: 'Fixe', target: { selector: '#still' }, spans: [{ id: 's', start: 1, end: 24, kind: 'static' }] };

    const result = exportCss(doc([still, { ...hero, id: 'hero' }]), { prefix: 'anim-', loop: true });

    expect(result.css).toContain('@keyframes anim-hero {');
    expect(result.css).toContain('animation-iteration-count: infinite;');
    expect(result.css).not.toContain('#still');
  });

  it('writes the duration from totalFrames / fps', () => {
    expect(exportCss(doc([hero], 24, 12)).css).toContain('animation-duration: 2000ms;');
    expect(exportCss(doc([hero], 10, 3)).css).toContain('animation-duration: 3333.3333ms;');
  });

  it('wraps the style sheet in a <style> element', () => {
    const { css, html } = exportCss(doc([hero]));

    expect(html).toBe(`<style>\n${css}</style>`);
  });

  it('refuses a selector that could close the <style> element', () => {
    const tricky: ILayer = { ...hero, target: { selector: '[data-x="</style"]' } };

    const { html, warnings } = exportCss(doc([tricky]));

    expect(html).toBe('<style>\n</style>');
    expect(warnings.map((w) => w.code)).toEqual(['unsupported-target']);
  });

  it('gives layers on the same selector one rule listing their animations', () => {
    const fade: ILayer = {
      id: 'fade',
      type: 'layer',
      name: 'Fondu',
      target: { selector: '#hero' },
      spans: [{ id: 'f1', start: 1, end: 24, kind: 'tween', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 24, value: 1 }] } }]
    };

    const { css } = exportCss(doc([hero, fade]));

    expect(css.match(/^#hero \{/gm)).toHaveLength(1);
    expect(css).toContain('animation-name: tl-hero, tl-fade;');
    expect(css).toContain('animation-duration: 2000ms, 2000ms;');
    expect(css).toContain('animation-fill-mode: both, both;');
  });

  it('skips a malformed layer with invalid-layer and keeps exporting the others', () => {
    const malformed = { ...hero, id: 'malformed', spans: [{ id: 'm', start: 1, end: 5, kind: 'tween', tracks: null }] } as unknown as ILayer;

    const result = exportCss(doc([malformed, { ...hero, id: 'ok' }]));

    expect(result.warnings.filter((w) => w.layerId === 'malformed').map((w) => w.code)).toEqual(['invalid-layer']);
    expect(result.css).toContain('@keyframes tl-ok {');
  });

  it.each([
    [{ fps: 0, totalFrames: 24 }],
    [{ fps: 12, totalFrames: Number.NaN }],
    [{ fps: Number.POSITIVE_INFINITY, totalFrames: 24 }]
  ])('exports nothing with an invalid-document warning for settings %p', (settings) => {
    const result = exportCss({ version: '2.0.0', settings, layers: [hero] });

    expect(result.css).toBe('');
    expect(result.warnings.map((w) => w.code)).toEqual(['invalid-document']);
  });

  it('returns an empty style sheet for an empty document', () => {
    expect(exportCss(doc([]))).toEqual({ css: '', html: '<style>\n</style>', warnings: [] });
  });
});

/** Keyframes of the first `@keyframes` block of `css`: offset → declarations. */
function parseKeyframes(css: string): Array<{ offset: number; declarations: Record<string, string> }> {
  const body = css.slice(css.indexOf('{') + 1, css.indexOf('\n}\n'));
  return Array.from(body.matchAll(/([\d.]+)% \{([^}]*)\}/g), ([, percent, block]) => {
    const declarations: Record<string, string> = {};
    for (const [, name, value] of block.matchAll(/([a-z-]+): ([^;]+);/g)) {
      declarations[name] = value;
    }
    return { offset: Number(percent) / 100, declarations };
  });
}

/** Number read by `read` from the declarations at `offset`, as a browser computes it. */
function cssNumberAt(css: string, offset: number, read: (d: Record<string, string>) => number): number {
  const keyframes = parseKeyframes(css);
  let index = 0;
  while (index < keyframes.length - 1 && keyframes[index + 1].offset <= offset) {
    index++;
  }
  const a = keyframes[index];
  const b = keyframes[index + 1];
  if (b === undefined) {
    return read(a.declarations);
  }
  const easing = a.declarations['animation-timing-function'] ?? 'linear';
  const t = (offset - a.offset) / (b.offset - a.offset);
  const eased = easing === 'step-end' ? 0 : createEasingFunction(easing)(t);
  return read(a.declarations) + (read(b.declarations) - read(a.declarations)) * eased;
}

describe('agreement with the runtime evaluation', () => {
  const registry = createPropertyRegistry();
  const layer: ILayer = {
    id: 'parity',
    type: 'layer',
    name: 'Parité',
    target: { selector: '#parity' },
    spans: [
      {
        id: 'p1',
        start: 1,
        end: 10,
        kind: 'tween',
        easing: 'ease-in-out',
        tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 5, value: 0.8 }, { frame: 10, value: 1 }], x: [{ frame: 1, value: 0 }, { frame: 10, value: 50 }] }
      },
      { id: 'p2', start: 11, end: 15, kind: 'static', tracks: { opacity: [{ frame: 11, value: 0.3 }] } },
      { id: 'p3', start: 16, end: 18, kind: 'blank' },
      { id: 'p4', start: 19, end: 24, kind: 'tween', easing: 'ease-in', tracks: { x: [{ frame: 19, value: 0 }, { frame: 24, value: 120 }] } }
    ]
  };
  const { css } = exportCss(doc([layer]), { registry });
  const opacity = (d: Record<string, string>): number => Number(d.opacity);
  const translateX = (d: Record<string, string>): number => Number(/translateX\((-?[\d.]+)px\)/.exec(d.transform)?.[1]);
  const hidden = (d: Record<string, string>): number => (d.visibility === 'hidden' ? 1 : 0);

  it.each(Array.from({ length: 24 }, (_, i) => i + 1))('frame %p has the same values in CSS and in evaluateLayer', (frame) => {
    const offset = (frame - 1) / 24;
    const state = evaluateLayer(layer, frame, { registry });
    const expected = computeCssDeclarations(state.values, registry);

    expect(cssNumberAt(css, offset, opacity)).toBeCloseTo(Number(expected.opacity), 3);
    expect(cssNumberAt(css, offset, translateX)).toBeCloseTo(Number(/translateX\((-?[\d.]+)px\)/.exec(expected.transform)?.[1]), 3);
    expect(cssNumberAt(css, offset, hidden)).toBe(state.visible ? 0 : 1);
  });
});
