// packages/editor/src/model/spans/__tests__/deleteKeyframe.test.ts
/**
 * Tests de l'effacement d'une image clé (Maj+F6) : fusion avec la plage
 * précédente ou retrait des images clés de propriété.
 */

import { deleteKeyframe } from '../deleteKeyframe';
import { SpanOperationError } from '../SpanOperationError';
import { createDoc, expectValid, layer, shapeOf, spansOf, tweenDoc } from './fixtures';

describe('deleteKeyframe', () => {
  it('fusionne une plage dans la précédente et abandonne ses pistes', () => {
    const next = deleteKeyframe(tweenDoc(), 'l1', 12);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-20']);
    expect(spansOf(next, 'l1')[0].tracks).toEqual({ x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] });
    expectValid(next);
  });

  it('fusionne au milieu du calque en gardant les plages suivantes', () => {
    const doc = createDoc([
      layer('l1', [
        { id: 'a', start: 1, end: 4, kind: 'static' },
        { id: 'b', start: 5, end: 8, kind: 'blank' },
        { id: 'c', start: 9, end: 12, kind: 'static' }
      ])
    ]);
    const next = deleteKeyframe(doc, 'l1', 5);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-8', 'static 9-12']);
    expect(spansOf(next, 'l1').map((span) => span.id)).toEqual(['a', 'c']);
    expectValid(next);
  });

  it("retire les images clés de propriété d'une interpolation", () => {
    const doc = createDoc([
      layer('l1', [{
        id: 't1', start: 1, end: 11, kind: 'tween',
        tracks: { x: [{ frame: 1, value: 0 }, { frame: 6, value: 9 }, { frame: 11, value: 100 }], y: [{ frame: 6, value: 3 }] }
      }])
    ]);
    const next = deleteKeyframe(doc, 'l1', 6);
    expect(spansOf(next, 'l1')[0].tracks).toEqual({ x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] });
    expectValid(next);
  });

  it("retire le champ tracks quand il ne reste aucune piste", () => {
    const doc = createDoc([layer('l1', [{ id: 't1', start: 1, end: 11, kind: 'tween', easing: 'ease', tracks: { x: [{ frame: 6, value: 9 }] } }])]);
    const span = spansOf(deleteKeyframe(doc, 'l1', 6), 'l1')[0];
    expect(span).toEqual({ id: 't1', start: 1, end: 11, kind: 'tween', easing: 'ease' });
  });

  it("ne change rien sans image clé à effacer", () => {
    const doc = tweenDoc();
    expect(deleteKeyframe(doc, 'l1', 1)).toBe(doc);
    expect(deleteKeyframe(doc, 'l1', 5)).toBe(doc);
    expect(deleteKeyframe(doc, 'l1', 15)).toBe(doc);
    expect(deleteKeyframe(doc, 'l1', 22)).toBe(doc);
  });

  it('refuse un calque verrouillé', () => {
    const doc = createDoc([layer('l1', [{ id: 'a', start: 1, end: 4, kind: 'static' }, { id: 'b', start: 5, end: 8, kind: 'static' }], { locked: true })]);
    expect(() => deleteKeyframe(doc, 'l1', 5)).toThrow(SpanOperationError);
  });
});
