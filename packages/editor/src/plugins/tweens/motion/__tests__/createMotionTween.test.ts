// packages/editor/src/plugins/tweens/motion/__tests__/createMotionTween.test.ts
/**
 * Tests de la création pure d'une interpolation : depuis une plage (1 image
 * clé ou aucune) et entre deux images clés (fusion, valeurs explicites,
 * images clés absorbées, image clé vide d'arrivée, refus).
 */

import { evaluateLayer, validateDocument } from '@werddomain/timeline-runtime';
import type { ISpan, ITimelineDocument } from '@werddomain/timeline-runtime';
import { createDoc, createRegistry, deepFreeze, expectValid, layer, layerOf, shapeOf, spansOf } from '../../../../model/spans/__tests__/fixtures';
import { createMotionTween, createMotionTweenBetween, createMotionTweenFromSpan } from '../createMotionTween';
import { MotionTweenCodes, MotionTweenError } from '../MotionTweenError';
import { SpanOperationCodes, SpanOperationError } from '../../../../model/spans/SpanOperationError';

const registry = createRegistry();

function stat(id: string, start: number, end: number, tracks?: ISpan['tracks']): ISpan {
  return tracks === undefined ? { id, start, end, kind: 'static' } : { id, start, end, kind: 'static', tracks };
}

function three(): ITimelineDocument {
  return createDoc([
    layer('l1', [
      stat('s1', 1, 4, { x: [{ frame: 1, value: 0 }], opacity: [{ frame: 1, value: 1 }] }),
      stat('s2', 5, 8, { x: [{ frame: 5, value: 100 }], opacity: [{ frame: 5, value: 0.5 }] }),
      stat('s3', 9, 12, { x: [{ frame: 9, value: 200 }], opacity: [{ frame: 9, value: 0 }] })
    ])
  ]);
}

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof MotionTweenError || error instanceof SpanOperationError) return error.code;
    throw error;
  }
  throw new Error('aucun refus');
}

describe('createMotionTweenFromSpan', () => {
  it('turns a static span into a tween with the same id and tracks, without easing', () => {
    // Arrange
    const doc = three();

    // Act
    const next = createMotionTweenFromSpan(doc, 'l1', 6);

    // Assert
    expectValid(next);
    const [first, tween, last] = spansOf(next, 'l1');
    expect(tween).toEqual({ ...spansOf(doc, 'l1')[1], kind: 'tween' });
    expect(tween.easing).toBeUndefined();
    expect(first).toBe(spansOf(doc, 'l1')[0]);
    expect(last).toBe(spansOf(doc, 'l1')[2]);
  });

  it('works on a span without tracks and does not mutate the frozen input', () => {
    // Arrange
    const doc = deepFreeze(createDoc([layer('l1', [stat('s1', 1, 3)])]));

    // Act
    const next = createMotionTweenFromSpan(doc, 'l1', 1);

    // Assert
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-3']);
    expect(shapeOf(doc, 'l1')).toEqual(['static 1-3']);
    expectValid(next);
  });

  it('refuses a tween, a blank span, frames past the last span and unknown frames', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [{ id: 't', start: 1, end: 4, kind: 'tween' }, { id: 'b', start: 5, end: 8, kind: 'blank' }])
    ]);

    // Assert
    expect(codeOf(() => createMotionTweenFromSpan(doc, 'l1', 2))).toBe(MotionTweenCodes.ALREADY_TWEEN);
    expect(codeOf(() => createMotionTweenFromSpan(doc, 'l1', 6))).toBe(MotionTweenCodes.BLANK_SPAN);
    expect(codeOf(() => createMotionTweenFromSpan(doc, 'l1', 20))).toBe(MotionTweenCodes.NO_KEYFRAME);
    expect(codeOf(() => createMotionTweenFromSpan(doc, 'l1', 99))).toBe(SpanOperationCodes.INVALID_FRAME);
    expect(codeOf(() => createMotionTweenFromSpan(doc, 'nope', 1))).toBe(SpanOperationCodes.LAYER_NOT_FOUND);
  });

  it('refuses a one-frame static span, which could not move', () => {
    // Arrange
    const doc = createDoc([layer('l1', [stat('s1', 1, 1), stat('s2', 2, 4)])]);

    // Act
    const run = (): unknown => createMotionTweenFromSpan(doc, 'l1', 1);

    // Assert
    expect(run).toThrow('Une interpolation doit couvrir au moins deux images.');
    expect(codeOf(run)).toBe(MotionTweenCodes.ADJACENT_KEYFRAMES);
  });

  it('refuses a locked layer and a locked parent folder', () => {
    // Arrange
    const locked = createDoc([layer('l1', [stat('s1', 1, 3)], { locked: true })]);
    const inFolder = createDoc([{ id: 'f', type: 'folder', name: 'f', locked: true, children: [layer('l1', [stat('s1', 1, 3)])] }]);

    // Assert
    expect(codeOf(() => createMotionTweenFromSpan(locked, 'l1', 1))).toBe(SpanOperationCodes.LAYER_LOCKED);
    expect(codeOf(() => createMotionTweenFromSpan(inFolder, 'l1', 1))).toBe(SpanOperationCodes.LAYER_LOCKED);
  });
});

describe('createMotionTweenBetween', () => {
  it('merges the spans between two keyframes with explicit evaluated values', () => {
    // Arrange
    const doc = three();

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 1, 9, registry);

    // Assert
    expectValid(next);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-8', 'static 9-12']);
    const [tween, last] = spansOf(next, 'l1');
    expect(tween.id).toBe('s1');
    expect(tween.easing).toBeUndefined();
    expect(tween.tracks).toEqual({
      x: [{ frame: 1, value: 0 }, { frame: 5, value: 100 }, { frame: 8, value: 200 }],
      opacity: [{ frame: 1, value: 1 }, { frame: 5, value: 0.5 }, { frame: 8, value: 0 }]
    });
    expect(last).toBe(spansOf(doc, 'l1')[2]);
  });

  it('keeps the values at k2 and outside [k1, k2] unchanged', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [stat('a', 1, 2, { x: [{ frame: 1, value: 7 }] }), stat('b', 3, 6, { x: [{ frame: 3, value: 20 }] }), stat('c', 7, 10, { x: [{ frame: 7, value: 70 }] })])
    ]);

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 3, 7, registry);

    // Assert
    expectValid(next);
    const before = (frame: number): number => evaluateLayer(layerOf(doc, 'l1'), frame, { registry }).values.x;
    const after = (frame: number): number => evaluateLayer(layerOf(next, 'l1'), frame, { registry }).values.x;
    [1, 2, 3, 7, 8, 10].forEach((frame) => expect(after(frame)).toBe(before(frame)));
    expect(after(5)).toBeCloseTo(53.333, 2);
    expect(after(6)).toBe(70);
  });

  it('keeps the property keyframes of absorbed tweens and the evaluated end values win on k2 - 1', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [
        stat('s1', 1, 4, { x: [{ frame: 1, value: 0 }] }),
        {
          id: 't2',
          start: 5,
          end: 10,
          kind: 'tween',
          easing: 'ease-in',
          tracks: { x: [{ frame: 5, value: 100 }, { frame: 7, value: 150 }, { frame: 10, value: 160 }] }
        },
        stat('s3', 11, 14, { x: [{ frame: 11, value: 300 }] })
      ])
    ]);

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 1, 11, registry);

    // Assert
    expectValid(next);
    const [tween] = spansOf(next, 'l1');
    expect(tween).toEqual({
      id: 's1',
      start: 1,
      end: 10,
      kind: 'tween',
      tracks: { x: [{ frame: 1, value: 0 }, { frame: 5, value: 100 }, { frame: 7, value: 150 }, { frame: 10, value: 300 }] }
    });
  });

  it('ends on the values at k2 - 1 (no slide back) when k2 is a blank keyframe', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [stat('s1', 1, 4, { x: [{ frame: 1, value: 5 }] }), stat('s2', 5, 8, { x: [{ frame: 5, value: 50 }] }), { id: 'b', start: 9, end: 12, kind: 'blank' }])
    ]);

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 1, 9, registry);

    // Assert
    expectValid(next);
    expect(spansOf(next, 'l1')[0].tracks).toEqual({ x: [{ frame: 1, value: 5 }, { frame: 5, value: 50 }, { frame: 8, value: 50 }] });
    expect(spansOf(next, 'l1')[1]).toBe(spansOf(doc, 'l1')[2]);
  });

  it('does not bounce back to k1 with a blank k2 (static 0, static 100, blank)', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [stat('a', 1, 5, { x: [{ frame: 1, value: 0 }] }), stat('b', 6, 10, { x: [{ frame: 6, value: 100 }] }), { id: 'k', start: 11, end: 12, kind: 'blank' }])
    ]);

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 1, 11, registry);

    // Assert
    expectValid(next);
    expect(spansOf(next, 'l1')[0].tracks).toEqual({ x: [{ frame: 1, value: 0 }, { frame: 6, value: 100 }, { frame: 10, value: 100 }] });
  });

  it('aims a one-span tween at k2 instead of refusing it', () => {
    // Arrange
    const doc = createDoc([layer('l1', [stat('a', 1, 4, { x: [{ frame: 1, value: 0 }] }), stat('b', 5, 8, { x: [{ frame: 5, value: 100 }] })])]);
    const single = createMotionTweenFromSpan(doc, 'l1', 1);

    // Act
    const next = createMotionTweenBetween(single, 'l1', 1, 5, registry);

    // Assert
    expectValid(next);
    expect(spansOf(next, 'l1')[0].tracks).toEqual({ x: [{ frame: 1, value: 0 }, { frame: 4, value: 100 }] });
  });

  it('keeps the easing of a single absorbed tween when aiming it at k2', () => {
    // Arrange: eased tween [1, 4] holding x = 0, then a static x = 100 at 5.
    const doc = createDoc([
      layer('l1', [{ id: 't', start: 1, end: 4, kind: 'tween', easing: 'ease-in', tracks: { x: [{ frame: 1, value: 0 }] } }, stat('b', 5, 8, { x: [{ frame: 5, value: 100 }] })])
    ]);

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 1, 5, registry);

    // Assert
    expectValid(next);
    expect(spansOf(next, 'l1')[0]).toEqual({
      id: 't',
      start: 1,
      end: 4,
      kind: 'tween',
      easing: 'ease-in',
      tracks: { x: [{ frame: 1, value: 0 }, { frame: 4, value: 100 }] }
    });
  });

  it('refuses to re-create an eased tween whose merge changes nothing', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [{ id: 't', start: 1, end: 5, kind: 'tween', easing: 'ease-in', tracks: { x: [{ frame: 1, value: 0 }, { frame: 5, value: 9 }] } }, stat('b', 6, 8, { x: [{ frame: 6, value: 9 }] })])
    ]);

    // Assert
    expect(codeOf(() => createMotionTweenBetween(doc, 'l1', 1, 6, registry))).toBe(MotionTweenCodes.ALREADY_TWEEN);
  });

  it('drops the easing when several spans are absorbed', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [
        { id: 't', start: 1, end: 4, kind: 'tween', easing: 'ease-in', tracks: { x: [{ frame: 1, value: 0 }] } },
        stat('b', 5, 8, { x: [{ frame: 5, value: 100 }] }),
        stat('c', 9, 12, { x: [{ frame: 9, value: 200 }] })
      ])
    ]);

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 1, 9, registry);

    // Assert
    expect(spansOf(next, 'l1')[0].easing).toBeUndefined();
  });

  it('refuses a range whose merge would leave the tween unchanged', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [{ id: 't', start: 1, end: 5, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 5, value: 9 }] } }, stat('b', 6, 8, { x: [{ frame: 6, value: 9 }] })])
    ]);

    // Act
    const run = (): unknown => createMotionTweenBetween(doc, 'l1', 1, 6, registry);

    // Assert
    expect(run).toThrow('Déjà une interpolation.');
    expect(codeOf(run)).toBe(MotionTweenCodes.ALREADY_TWEEN);
  });

  it('works on a layer without tracks (a tween without keyframes)', () => {
    // Arrange
    const doc = createDoc([layer('l1', [stat('a', 1, 2), stat('b', 3, 5)])]);

    // Act
    const next = createMotionTweenBetween(doc, 'l1', 1, 3, registry);

    // Assert
    expect(spansOf(next, 'l1')[0]).toEqual({ id: 'a', start: 1, end: 2, kind: 'tween' });
    expectValid(next);
  });

  it('refuses adjacent keyframes with the French message', () => {
    // Arrange
    const doc = createDoc([layer('l1', [stat('a', 1, 4), stat('b', 5, 5), stat('c', 6, 9)])]);

    // Act
    const run = (): unknown => createMotionTweenBetween(doc, 'l1', 5, 6, registry);

    // Assert
    expect(run).toThrow('Une interpolation doit couvrir au moins deux images.');
    expect(codeOf(run)).toBe(MotionTweenCodes.ADJACENT_KEYFRAMES);
  });

  it('refuses a blank span inside the range, non keyframes and a reversed range', () => {
    // Arrange
    const doc = createDoc([layer('l1', [stat('a', 1, 4), { id: 'b', start: 5, end: 8, kind: 'blank' }, stat('c', 9, 12)])]);

    // Assert
    expect(() => createMotionTweenBetween(doc, 'l1', 1, 9, registry)).toThrow('Une plage vide ne peut pas être interpolée.');
    expect(codeOf(() => createMotionTweenBetween(doc, 'l1', 5, 9, registry))).toBe(MotionTweenCodes.BLANK_SPAN);
    expect(codeOf(() => createMotionTweenBetween(doc, 'l1', 2, 9, registry))).toBe(MotionTweenCodes.NOT_A_KEYFRAME);
    expect(codeOf(() => createMotionTweenBetween(doc, 'l1', 1, 7, registry))).toBe(MotionTweenCodes.NOT_A_KEYFRAME);
    expect(codeOf(() => createMotionTweenBetween(doc, 'l1', 9, 1, registry))).toBe(MotionTweenCodes.INVALID_RANGE);
    expect(codeOf(() => createMotionTweenBetween(doc, 'l1', 1, 99, registry))).toBe(SpanOperationCodes.INVALID_FRAME);
  });

  it('refuses a locked layer and a property unknown to the registry', () => {
    // Arrange
    const locked = createDoc([layer('l1', [stat('a', 1, 4), stat('b', 5, 8)], { locked: true })]);
    const unknown = createDoc([layer('l1', [stat('a', 1, 4, { glow: [{ frame: 1, value: 1 }] }), stat('b', 5, 8)])]);

    // Assert
    expect(codeOf(() => createMotionTweenBetween(locked, 'l1', 1, 5, registry))).toBe(SpanOperationCodes.LAYER_LOCKED);
    expect(codeOf(() => createMotionTweenBetween(unknown, 'l1', 1, 5, registry))).toBe(SpanOperationCodes.EVALUATION_FAILED);
  });
});

describe('createMotionTween', () => {
  it('dispatches on the target and produces valid documents', () => {
    // Arrange
    const doc = three();

    // Act
    const single = createMotionTween(doc, { layerId: 'l1', from: 5 }, registry);
    const range = createMotionTween(doc, { layerId: 'l1', from: 1, to: 9 }, registry);

    // Assert
    expect(shapeOf(single, 'l1')).toEqual(['static 1-4', 'tween 5-8', 'static 9-12']);
    expect(shapeOf(range, 'l1')).toEqual(['tween 1-8', 'static 9-12']);
    expect(validateDocument(single)).toEqual([]);
  });
});
