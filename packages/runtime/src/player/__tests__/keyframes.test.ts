// packages/runtime/src/player/__tests__/keyframes.test.ts
/**
 * Web Animations keyframes of a layer: offsets, span boundaries, visibility,
 * easing on segments, sampling, and agreement with `evaluateLayer`.
 */

import { createEasingFunction } from '../../evaluate/easingFunction';
import { evaluateLayer } from '../../evaluate/evaluateLayer';
import type { ILayer } from '../../model/layer';
import type { ISpan } from '../../model/span';
import { createPropertyRegistry } from '../../properties/PropertyRegistry';
import { buildLayerKeyframes, frameToOffset } from '../keyframes';

const registry = createPropertyRegistry();

function layer(spans: ISpan[]): ILayer {
  return { id: 'l1', type: 'layer', name: 'L', target: { selector: '#t' }, spans };
}

function build(spans: ISpan[], totalFrames: number): Keyframe[] {
  const keyframes = buildLayerKeyframes(layer(spans), { fps: 10, totalFrames }, registry);
  if (keyframes === null) {
    throw new Error('expected keyframes');
  }
  return keyframes;
}

/**
 * Opacity the browser would compute at `offset`: the last keyframe at or
 * before the offset, eased towards the next one (same rules as Web Animations
 * for keyframes with explicit offsets).
 */
function opacityAt(keyframes: Keyframe[], offset: number): number {
  let index = 0;
  while (index < keyframes.length - 1 && (keyframes[index + 1].offset as number) <= offset) {
    index++;
  }
  const a = keyframes[index];
  const b = keyframes[index + 1];
  if (b === undefined || (b.offset as number) === (a.offset as number)) {
    return Number(a.opacity);
  }
  const t = (offset - (a.offset as number)) / ((b.offset as number) - (a.offset as number));
  const eased = createEasingFunction(a.easing ?? 'linear')(t);
  return Number(a.opacity) + (Number(b.opacity) - Number(a.opacity)) * eased;
}

describe('frameToOffset', () => {
  it.each([[1, 10, 0], [6, 10, 0.5], [10, 10, 0.9], [11, 10, 1]])('frame %p of %p → %p', (frame, total, expected) => {
    expect(frameToOffset(frame, total)).toBeCloseTo(expected, 12);
  });
});

describe('buildLayerKeyframes', () => {
  it('returns null for a layer that never changes', () => {
    expect(buildLayerKeyframes(layer([{ id: 'a', start: 1, end: 10, kind: 'static' }]), { fps: 10, totalFrames: 10 }, registry))
      .toBeNull();
  });

  it('builds a linear tween with a keyframe at each property keyframe', () => {
    const keyframes = build([
      { id: 'a', start: 1, end: 10, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }], opacity: [{ frame: 1, value: 0 }, { frame: 4, value: 1 }] } }
    ], 10);
    expect(keyframes.map((k) => k.offset)).toEqual([0, 0.3, 0.9, 1]);
    expect(keyframes[0]).toEqual({
      offset: 0, easing: 'linear', opacity: '0',
      transform: 'translateX(0px) translateY(0px) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg)'
    });
    expect(keyframes[1]).toMatchObject({ opacity: '1', transform: expect.stringContaining('translateX(30px)') });
    expect(keyframes[3]).toMatchObject({ offset: 1, opacity: '1', transform: expect.stringContaining('translateX(90px)') });
    expect(keyframes.every((k) => k.visibility === undefined)).toBe(true);
  });

  it('writes only the animated properties', () => {
    const keyframes = build([{ id: 'a', start: 1, end: 10, kind: 'tween', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 10, value: 1 }] } }], 10);
    keyframes.forEach((k) => expect(Object.keys(k).sort()).toEqual(['easing', 'offset', 'opacity']));
  });

  it('carries the easing on the first keyframe of an eased tween without inner keyframes', () => {
    const keyframes = build([
      { id: 'a', start: 1, end: 10, kind: 'tween', easing: 'ease-in', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 10, value: 1 }] } }
    ], 10);
    expect(keyframes.map((k) => [k.offset, k.easing])).toEqual([[0, 'ease-in'], [0.9, 'linear'], [1, 'linear']]);
  });

  it('samples every frame of an eased tween with inner keyframes', () => {
    const keyframes = build([
      { id: 'a', start: 1, end: 6, kind: 'tween', easing: 'ease-out', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 3, value: 0.2 }, { frame: 6, value: 1 }] } }
    ], 6);
    expect(keyframes.map((k) => k.offset)).toEqual([0, 1, 2, 3, 4, 5, 6].map((n) => n / 6));
    expect(keyframes.every((k) => k.easing === 'linear')).toBe(true);
  });

  it('changes values sharply at a span start (two keyframes at the same offset)', () => {
    const keyframes = build([
      { id: 'a', start: 1, end: 5, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.2 }] } },
      { id: 'b', start: 6, end: 10, kind: 'static', tracks: { opacity: [{ frame: 6, value: 0.8 }] } }
    ], 10);
    expect(keyframes.map((k) => [k.offset, k.opacity])).toEqual([[0, '0.2'], [0.5, '0.2'], [0.5, '0.8'], [1, '0.8']]);
  });

  it('hides the target in a blank span', () => {
    const keyframes = build([
      { id: 'a', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 5 }] } },
      { id: 'b', start: 5, end: 10, kind: 'blank' }
    ], 10);
    expect(keyframes.map((k) => [k.offset, k.visibility])).toEqual([[0, 'visible'], [0.4, 'visible'], [0.4, 'hidden'], [1, 'hidden']]);
  });

  it('animates visibility alone for a blank span without tracks', () => {
    const keyframes = build([{ id: 'a', start: 1, end: 10, kind: 'blank' }], 10);
    expect(keyframes).toEqual([{ offset: 0, easing: 'linear', visibility: 'hidden' }, { offset: 1, easing: 'linear', visibility: 'hidden' }]);
  });

  it('hides the target after the last span', () => {
    const keyframes = build([{ id: 'a', start: 1, end: 6, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.5 }] } }], 10);
    expect(keyframes.map((k) => [k.offset, k.visibility, k.opacity])).toEqual([
      [0, 'visible', '0.5'], [0.6, 'visible', '0.5'], [0.6, 'hidden', '0.5'], [1, 'hidden', '0.5']
    ]);
  });

  it('hides a layer without spans', () => {
    expect(build([], 4)).toEqual([{ offset: 0, easing: 'linear', visibility: 'hidden' }, { offset: 1, easing: 'linear', visibility: 'hidden' }]);
  });

  it('ignores spans beyond the timeline', () => {
    const keyframes = build([
      { id: 'a', start: 1, end: 8, kind: 'tween', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 8, value: 1 }] } },
      { id: 'b', start: 9, end: 12, kind: 'blank' }
    ], 5);
    expect(keyframes.map((k) => k.offset)).toEqual([0, 0.8, 1]);
    expect(keyframes.every((k) => k.visibility === undefined)).toBe(true);
  });

  it('keeps offsets in [0, 1] and never decreasing', () => {
    const keyframes = build([
      { id: 'a', start: 1, end: 3, kind: 'tween', easing: 'ease', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 2, value: 0.5 }, { frame: 3, value: 1 }] } },
      { id: 'b', start: 4, end: 4, kind: 'blank' },
      { id: 'c', start: 5, end: 7, kind: 'tween', tracks: { x: [{ frame: 5, value: 1 }] } }
    ], 9);
    const offsets = keyframes.map((k) => k.offset as number);
    offsets.forEach((offset, i) => {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1);
      if (i > 0) {
        expect(offset).toBeGreaterThanOrEqual(offsets[i - 1]);
      }
    });
  });
});

describe('agreement with evaluateLayer at every frame', () => {
  const cases: Array<[string, ISpan[]]> = [
    ['linear tween with an inner keyframe', [
      { id: 'a', start: 1, end: 20, kind: 'tween', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 7, value: 0.9 }, { frame: 20, value: 0.1 }] } }
    ]],
    ['eased tween without inner keyframes', [
      { id: 'a', start: 1, end: 20, kind: 'tween', easing: 'ease-in-out', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 20, value: 1 }] } }
    ]],
    ['eased tween with inner keyframes', [
      { id: 'a', start: 1, end: 20, kind: 'tween', easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', tracks: { opacity: [{ frame: 1, value: 0 }, { frame: 5, value: 0.3 }, { frame: 20, value: 1 }] } }
    ]],
    ['static, tween starting late, blank, then static', [
      { id: 'a', start: 1, end: 5, kind: 'static', tracks: { opacity: [{ frame: 1, value: 0.4 }] } },
      { id: 'b', start: 6, end: 14, kind: 'tween', easing: 'ease', tracks: { opacity: [{ frame: 10, value: 1 }] } },
      { id: 'c', start: 15, end: 17, kind: 'blank' },
      { id: 'd', start: 18, end: 20, kind: 'static' }
    ]]
  ];

  it.each(cases)('%s', (_label, spans) => {
    const totalFrames = 20;
    const target = layer(spans);
    const keyframes = build(spans, totalFrames);
    for (let frame = 1; frame <= totalFrames; frame++) {
      const expected = evaluateLayer(target, frame, { registry }).values.opacity;
      expect(opacityAt(keyframes, frameToOffset(frame, totalFrames))).toBeCloseTo(expected, 3);
    }
  });
});
