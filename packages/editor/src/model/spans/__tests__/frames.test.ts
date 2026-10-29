// packages/editor/src/model/spans/__tests__/frames.test.ts
/**
 * Tests de l'insertion (F5) et de la suppression (Maj+F5) d'une image.
 */

import { insertFrame, removeFrame } from '../frames';
import { SpanOperationCodes, SpanOperationError } from '../SpanOperationError';
import { createDoc, expectValid, layer, shapeOf, spansOf, tweenDoc } from './fixtures';

describe('insertFrame (F5)', () => {
  it("allonge la plage et recule ce qui suit l'image", () => {
    const next = insertFrame(tweenDoc(), 'l1', 6);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-12', 'static 13-21']);
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 1, value: 0 }, { frame: 12, value: 100 }]);
    expect(spansOf(next, 'l1')[1].tracks?.x).toEqual([{ frame: 13, value: 100 }]);
    expectValid(next);
  });

  it("garde en place une image clé de propriété située à l'image", () => {
    const doc = createDoc([layer('l1', [{ id: 't1', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 6, value: 5 }, { frame: 11, value: 9 }] } }])]);
    const next = insertFrame(doc, 'l1', 6);
    expect(spansOf(next, 'l1')[0].tracks?.x.map((keyframe) => keyframe.frame)).toEqual([1, 6, 12]);
  });

  it('sur une image clé de début, allonge la plage qui commence là', () => {
    const next = insertFrame(tweenDoc(), 'l1', 12);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-11', 'static 12-21']);
    expect(spansOf(next, 'l1')[1].tracks?.x).toEqual([{ frame: 12, value: 100 }]);
  });

  it('agrandit le document quand le calque dépasse la durée', () => {
    const doc = createDoc([layer('l1', [{ id: 's1', start: 1, end: 24, kind: 'static' }])]);
    const next = insertFrame(doc, 'l1', 3);
    expect(next.settings.totalFrames).toBe(25);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-25']);
    expectValid(next);
  });

  it('ne change pas la durée quand le calque reste dedans', () => {
    expect(insertFrame(tweenDoc(), 'l1', 3).settings.totalFrames).toBe(24);
  });

  it("après la dernière plage, prolonge jusqu'à l'image", () => {
    const next = insertFrame(tweenDoc(), 'l1', 23);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-11', 'static 12-23']);
    expectValid(next);
  });

  it("sur un calque vide, crée une plage vide jusqu'à l'image", () => {
    const next = insertFrame(createDoc([layer('l1', [])]), 'l1', 4);
    expect(spansOf(next, 'l1')).toEqual([{ id: 'l1-k1', start: 1, end: 4, kind: 'blank' }]);
    expectValid(next);
  });

  it('refuse une image hors du document', () => {
    try {
      insertFrame(tweenDoc(), 'l1', 30);
      throw new Error('aucune erreur');
    } catch (error) {
      expect(error).toBeInstanceOf(SpanOperationError);
      expect((error as SpanOperationError).code).toBe(SpanOperationCodes.INVALID_FRAME);
      expect((error as SpanOperationError).message).toBe("L'image 30 n'existe pas (images de 1 à 24).");
    }
  });
});

describe('removeFrame (Maj+F5)', () => {
  it('raccourcit la plage et avance ce qui suit', () => {
    const next = removeFrame(tweenDoc(), 'l1', 6);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-10', 'static 11-19']);
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 1, value: 0 }, { frame: 10, value: 100 }]);
    expect(spansOf(next, 'l1')[1].tracks?.x).toEqual([{ frame: 11, value: 100 }]);
    expect(next.settings.totalFrames).toBe(24);
    expectValid(next);
  });

  it("retire les images clés de propriété de l'image supprimée", () => {
    const doc = createDoc([layer('l1', [{ id: 't1', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 6, value: 5 }, { frame: 11, value: 9 }] } }])]);
    const next = removeFrame(doc, 'l1', 6);
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 1, value: 0 }, { frame: 10, value: 9 }]);
    expectValid(next);
  });

  it("sur l'image clé de début, garde le début et retire l'image suivante", () => {
    const doc = createDoc([layer('l1', [{ id: 't1', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 2, value: 5 }, { frame: 11, value: 9 }] } }])]);
    const next = removeFrame(doc, 'l1', 1);
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 1, value: 0 }, { frame: 10, value: 9 }]);
    expectValid(next);
  });

  it("supprime une plage d'une seule image", () => {
    const doc = createDoc([
      layer('l1', [
        { id: 'a', start: 1, end: 1, kind: 'static' },
        { id: 'b', start: 2, end: 2, kind: 'blank' },
        { id: 'c', start: 3, end: 6, kind: 'static', tracks: { x: [{ frame: 3, value: 1 }] } }
      ])
    ]);
    const middle = removeFrame(doc, 'l1', 2);
    expect(shapeOf(middle, 'l1')).toEqual(['static 1-1', 'static 2-5']);
    expect(spansOf(middle, 'l1')[1].tracks?.x).toEqual([{ frame: 2, value: 1 }]);
    expectValid(middle);
    const first = removeFrame(doc, 'l1', 1);
    expect(shapeOf(first, 'l1')).toEqual(['blank 1-1', 'static 2-5']);
    expectValid(first);
    const only = removeFrame(createDoc([layer('l1', [{ id: 'a', start: 1, end: 1, kind: 'static' }])]), 'l1', 1);
    expect(spansOf(only, 'l1')).toEqual([]);
  });

  it('ne change rien après la dernière plage', () => {
    const doc = tweenDoc();
    expect(removeFrame(doc, 'l1', 21)).toBe(doc);
  });

  it('refuse un calque verrouillé', () => {
    const doc = createDoc([layer('l1', [{ id: 'a', start: 1, end: 4, kind: 'static' }], { locked: true })]);
    expect(() => removeFrame(doc, 'l1', 2)).toThrow(SpanOperationError);
  });
});
