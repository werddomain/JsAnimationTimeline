// packages/runtime/src/stage/html/__tests__/parity.test.ts
/**
 * Parité des deux modes de la scène HTML aux images entières : la valeur
 * qu'un navigateur calculerait à partir des images clés Web Animations
 * (mode `waapi`) égale le style en ligne écrit par le mode `frame`.
 * Entre deux images, un calque échantillonné image par image peut différer
 * (le navigateur interpole en ligne droite entre deux échantillons) : le
 * dernier test le montre.
 */

import { createEasingFunction } from '../../../evaluate/easingFunction';
import type { ILayer } from '../../../model/layer';
import type { ISpan } from '../../../model/span';
import { interpolators } from '../../../properties/interpolators';
import { createPropertyRegistry } from '../../../properties/PropertyRegistry';
import type { PropertyRegistry } from '../../../properties/PropertyRegistry';
import { installFakeAnimate } from '../../../player/__tests__/fakes';
import { docOf, timeAt } from '../../__tests__/fakeStage';
import { StageHost } from '../../StageHost';
import { createHtmlStage } from '../createHtmlStage';
import { frameToOffset } from '../keyframes';

const TOTAL = 12;
const NUMBER = /-?\d+(\.\d+)?(e-?\d+)?/g;

function registryWithRadius(): PropertyRegistry {
  return createPropertyRegistry([
    { name: 'radius', kind: 'style', cssName: 'border-radius', unit: 'px', defaultValue: 0, interpolate: interpolators.floor }
  ]);
}

function numbers(value: string): number[] {
  return (value.match(NUMBER) ?? []).map(Number);
}

/** `a` with its numbers moved towards those of `b` (same structure: full transform strings). */
function lerpString(a: string, b: string, t: number): string {
  const target = numbers(b);
  let index = 0;
  return a.replace(NUMBER, (match) => String(Number(match) + (target[index++] - Number(match)) * t));
}

const SKIPPED = new Set(['offset', 'easing', 'composite']);

/** CSS a browser computes from `keyframes` at `offset` (explicit offsets, per-segment easing). */
function sample(keyframes: Keyframe[], offset: number): Record<string, string> {
  let index = 0;
  while (index < keyframes.length - 1 && (keyframes[index + 1].offset as number) <= offset + 1e-12) {
    index++;
  }
  const a = keyframes[index];
  const b = keyframes[index + 1];
  const result: Record<string, string> = {};
  const span = b === undefined ? 0 : (b.offset as number) - (a.offset as number);
  const t = span <= 0 ? 0 : createEasingFunction(a.easing ?? 'linear')((offset - (a.offset as number)) / span);
  for (const [key, value] of Object.entries(a)) {
    if (SKIPPED.has(key)) {
      continue;
    }
    const next = b === undefined || t === 0 ? String(value) : String(b[key]);
    if (key === 'visibility') {
      result[key] = t === 0 || value === next ? String(value) : 'visible';
    } else {
      result[key] = t === 0 ? String(value) : lerpString(String(value), next, t);
    }
  }
  return result;
}

function inline(element: HTMLElement, keys: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  keys.forEach((key) => {
    result[key] = element.style.getPropertyValue(key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
  });
  return result;
}

function expectSameCss(actual: Record<string, string>, expected: Record<string, string>): void {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const key of Object.keys(expected)) {
    const want = numbers(expected[key]);
    const got = numbers(actual[key]);
    expect(got).toHaveLength(want.length);
    // CSS values are rounded to CSS_VALUE_PRECISION (4 decimals).
    want.forEach((n, i) => expect(got[i]).toBeCloseTo(n, 3));
    expect(actual[key].replace(NUMBER, '#')).toBe(expected[key].replace(NUMBER, '#'));
  }
}

let fake: ReturnType<typeof installFakeAnimate>;

beforeEach(() => {
  document.body.innerHTML = '<div id="w"><b id="t"></b></div><div id="f"><b id="t"></b></div>';
  fake = installFakeAnimate();
});

afterEach(() => fake.restore());

/** Loads `spans` in both modes; returns the keyframes and a renderer of frame mode. */
function setup(spans: ISpan[]): { keyframes: Keyframe[]; renderFrame: (frame: number) => Record<string, string> } {
  const registry = registryWithRadius();
  const layer: ILayer = { id: 'l', type: 'layer', name: 'L', target: { selector: '#t' }, spans };
  const doc = docOf([layer], TOTAL);
  const make = (root: string, mode: 'waapi' | 'frame'): StageHost => {
    const host = new StageHost({
      stages: [createHtmlStage({ root: document.getElementById(root) as HTMLElement, mode })],
      registry,
      onError: (error) => {
        throw error;
      },
      now: () => ({ time: timeAt(1), state: { playing: false, speed: 1 } })
    });
    host.load(doc);
    return host;
  };
  make('w', 'waapi');
  const frameHost = make('f', 'frame');
  expect(fake.animations).toHaveLength(1);
  const keyframes = fake.animations[0].keyframes;
  const element = document.querySelector('#f #t') as HTMLElement;
  const keys = Object.keys(keyframes[0]).filter((key) => !SKIPPED.has(key));
  return {
    keyframes,
    renderFrame: (frame) => {
      frameHost.render(timeAt(frame));
      return inline(element, keys);
    }
  };
}

const CASES: Array<[string, ISpan[]]> = [
  ['a linear tween', [{ id: 'a', start: 1, end: TOTAL, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: TOTAL, value: 110 }], opacity: [{ frame: 1, value: 0.2 }, { frame: 6, value: 1 }] } }]],
  ['an eased tween without inner keyframe', [{ id: 'a', start: 1, end: TOTAL, kind: 'tween', easing: 'ease-in-out', tracks: { rotation: [{ frame: 1, value: 0 }, { frame: TOTAL, value: 360 }] } }]],
  ['an eased tween with inner keyframes (sampled)', [{ id: 'a', start: 1, end: TOTAL, kind: 'tween', easing: 'ease-out', tracks: { y: [{ frame: 1, value: 0 }, { frame: 5, value: 40 }, { frame: TOTAL, value: -20 }] } }]],
  ['static, blank and uncovered frames', [
    { id: 'a', start: 1, end: 3, kind: 'static', tracks: { x: [{ frame: 1, value: 5 }] } },
    { id: 'b', start: 4, end: 6, kind: 'blank' },
    { id: 'c', start: 7, end: 9, kind: 'tween', tracks: { x: [{ frame: 7, value: 10 }, { frame: 9, value: 30 }] } }
  ]],
  ['a custom interpolator (sampled)', [{ id: 'a', start: 1, end: TOTAL, kind: 'tween', tracks: { radius: [{ frame: 1, value: 0 }, { frame: TOTAL, value: 7 }] } }]]
];

describe('waapi / frame parity at integer frames', () => {
  it.each(CASES)('%s', (_name, spans) => {
    const { keyframes, renderFrame } = setup(spans);
    for (let frame = 1; frame <= TOTAL; frame++) {
      expectSameCss(renderFrame(frame), sample(keyframes, frameToOffset(frame, TOTAL)));
    }
  });

  it('may differ between two frames for a sampled layer (documented)', () => {
    const [, spans] = CASES[2];
    const { keyframes, renderFrame } = setup(spans);
    const between = renderFrame(1.5).transform;
    const browser = sample(keyframes, frameToOffset(1.5, TOTAL)).transform;
    expect(numbers(between)[1]).not.toBeCloseTo(numbers(browser)[1], 3);
  });
});
