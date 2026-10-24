// packages/editor/src/model/spans/__tests__/moveKeyframe.test.ts
/**
 * Tests du déplacement d'une image clé (glisser) : frontière entre deux
 * plages, première image clé et images clés de propriété.
 */

import { moveKeyframe } from '../moveKeyframe';
import { SpanOperationCodes, SpanOperationError } from '../SpanOperationError';
import { createDoc, expectValid, layer, shapeOf, spansOf, tweenDoc } from './fixtures';

function refusal(action: () => unknown): SpanOperationError {
  try {
    action();
  } catch (error) {
    if (error instanceof SpanOperationError) return error;
    throw error;
  }
  throw new Error('aucun refus');
}

describe('moveKeyframe', () => {
  it("avance une frontière : l'interpolation précédente se contracte proportionnellement", () => {
    const doc = createDoc([
      layer('l1', [
        { id: 't1', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 6, value: 50 }, { frame: 11, value: 100 }] } },
        { id: 's2', start: 12, end: 20, kind: 'static', tracks: { x: [{ frame: 12, value: 100 }] } }
      ])
    ]);
    const next = moveKeyframe(doc, 'l1', 12, 7);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-6', 'static 7-20']);
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 1, value: 0 }, { frame: 4, value: 50 }, { frame: 6, value: 100 }]);
    expect(spansOf(next, 'l1')[1].tracks?.x).toEqual([{ frame: 7, value: 100 }]);
    expectValid(next);
  });

  it("recule une frontière : l'interpolation s'étire et la plage suivante raccourcit", () => {
    const next = moveKeyframe(tweenDoc(), 'l1', 12, 16);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-15', 'static 16-20']);
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 1, value: 0 }, { frame: 15, value: 100 }]);
    expect(spansOf(next, 'l1')[1].tracks?.x).toEqual([{ frame: 16, value: 100 }]);
    expectValid(next);
  });

  it('recale les images clés de la plage déplacée quand c’est une interpolation', () => {
    const doc = createDoc([
      layer('l1', [
        { id: 'a', start: 1, end: 4, kind: 'static' },
        { id: 't', start: 5, end: 13, kind: 'tween', tracks: { x: [{ frame: 5, value: 0 }, { frame: 9, value: 5 }, { frame: 13, value: 9 }] } }
      ])
    ]);
    const next = moveKeyframe(doc, 'l1', 5, 9);
    expect(spansOf(next, 'l1')[1].tracks?.x.map((keyframe) => keyframe.frame)).toEqual([9, 11, 13]);
    expectValid(next);
  });

  it('déplacer la première image clé laisse une plage vide devant', () => {
    const next = moveKeyframe(tweenDoc(), 'l1', 1, 3);
    expect(shapeOf(next, 'l1')).toEqual(['blank 1-2', 'tween 3-11', 'static 12-20']);
    expect(spansOf(next, 'l1')[0].id).toBe('l1-k1');
    expect(spansOf(next, 'l1')[1].tracks?.x).toEqual([{ frame: 3, value: 0 }, { frame: 11, value: 100 }]);
    expectValid(next);
  });

  it('refuse une destination hors des limites de la frontière', () => {
    expect(refusal(() => moveKeyframe(tweenDoc(), 'l1', 12, 21)).code).toBe(SpanOperationCodes.OUT_OF_RANGE);
    expect(refusal(() => moveKeyframe(tweenDoc(), 'l1', 12, 1)).message).toBe("L'image clé doit rester entre les images 2 et 20.");
    expect(refusal(() => moveKeyframe(tweenDoc(), 'l1', 1, 12)).code).toBe(SpanOperationCodes.OUT_OF_RANGE);
  });

  it("déplace les images clés de propriété dans l'interpolation et remplace celles de la destination", () => {
    const doc = createDoc([
      layer('l1', [{
        id: 't1', start: 1, end: 11, kind: 'tween',
        tracks: { x: [{ frame: 1, value: 0 }, { frame: 4, value: 40 }, { frame: 8, value: 80 }, { frame: 11, value: 100 }], y: [{ frame: 1, value: 0 }] }
      }])
    ]);
    const next = moveKeyframe(doc, 'l1', 4, 8);
    expect(spansOf(next, 'l1')[0].tracks).toEqual({
      x: [{ frame: 1, value: 0 }, { frame: 8, value: 40 }, { frame: 11, value: 100 }],
      y: [{ frame: 1, value: 0 }]
    });
    expectValid(next);
    expect(refusal(() => moveKeyframe(doc, 'l1', 4, 15)).code).toBe(SpanOperationCodes.OUT_OF_RANGE);
  });

  it('ne change rien sans image clé à déplacer', () => {
    const doc = tweenDoc();
    expect(moveKeyframe(doc, 'l1', 5, 7)).toBe(doc);
    expect(moveKeyframe(doc, 'l1', 14, 16)).toBe(doc);
    expect(moveKeyframe(doc, 'l1', 22, 23)).toBe(doc);
    expect(moveKeyframe(doc, 'l1', 12, 12)).toBe(doc);
  });

  it('refuse un calque verrouillé et des images invalides', () => {
    const locked = createDoc([layer('l1', [{ id: 'a', start: 1, end: 4, kind: 'static' }, { id: 'b', start: 5, end: 8, kind: 'static' }], { locked: true })]);
    expect(refusal(() => moveKeyframe(locked, 'l1', 5, 6)).code).toBe(SpanOperationCodes.LAYER_LOCKED);
    expect(refusal(() => moveKeyframe(tweenDoc(), 'l1', 12, 0)).code).toBe(SpanOperationCodes.INVALID_FRAME);
  });
});
