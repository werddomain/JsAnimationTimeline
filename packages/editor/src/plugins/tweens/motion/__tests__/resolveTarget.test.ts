// packages/editor/src/plugins/tweens/motion/__tests__/resolveTarget.test.ts
/**
 * Tests de la résolution de la sélection : 0, 1 ou plusieurs images clés,
 * plusieurs calques, plages ambiguës, cellules sans plage, et suppression.
 */

import { createDoc, layer } from '../../../../model/spans/__tests__/fixtures';
import { MotionTweenCodes } from '../MotionTweenError';
import { resolveCreateTarget, resolveRemoveTargets } from '../resolveTarget';

const doc = createDoc([
  layer('a', [
    { id: 'a1', start: 1, end: 4, kind: 'static' },
    { id: 'a2', start: 5, end: 8, kind: 'tween' },
    { id: 'a3', start: 9, end: 12, kind: 'static' }
  ]),
  { id: 'f', type: 'folder', name: 'f', children: [layer('b', [{ id: 'b1', start: 1, end: 6, kind: 'tween' }])] },
  layer('c', [])
]);

const cells = (rowId: string, ...frames: number[]) => frames.map((frame) => ({ rowId, frame }));

describe('resolveCreateTarget', () => {
  it('takes the span of a single selected keyframe', () => {
    // Assert
    expect(resolveCreateTarget(doc, cells('a', 5))).toEqual({ ok: true, target: { layerId: 'a', from: 5 } });
  });

  it('takes the span of a keyframe even when other cells of its span are selected', () => {
    // Assert
    expect(resolveCreateTarget(doc, cells('a', 5, 6, 7))).toEqual({ ok: true, target: { layerId: 'a', from: 5 } });
  });

  it('takes the span that holds all the cells when there is no keyframe', () => {
    // Assert
    expect(resolveCreateTarget(doc, cells('a', 2, 3))).toEqual({ ok: true, target: { layerId: 'a', from: 1 } });
  });

  it('is ambiguous when cells without keyframe touch several spans', () => {
    // Act
    const result = resolveCreateTarget(doc, cells('a', 2, 6));

    // Assert
    expect(result).toEqual({ ok: false, code: MotionTweenCodes.AMBIGUOUS_SELECTION, message: 'Sélection ambiguë' });
  });

  it('goes from the first to the last keyframe when there are two or more', () => {
    // Assert
    expect(resolveCreateTarget(doc, cells('a', 9, 1, 5, 3))).toEqual({ ok: true, target: { layerId: 'a', from: 1, to: 9 } });
  });

  it('refuses cells of several layers', () => {
    // Act
    const result = resolveCreateTarget(doc, [...cells('a', 1), ...cells('b', 1)]);

    // Assert
    expect(result).toEqual({ ok: false, code: MotionTweenCodes.MULTIPLE_LAYERS, message: "Sélectionnez des images d'un seul calque" });
  });

  it('reports no keyframe for an empty selection, a folder row, frames past the last span and unknown rows', () => {
    // Assert
    [[], cells('f', 1), cells('a', 20), cells('c', 1), cells('zz', 1)].forEach((selection) =>
      expect(resolveCreateTarget(doc, selection)).toEqual({
        ok: false,
        code: MotionTweenCodes.NO_KEYFRAME,
        message: 'Aucune image clé sélectionnée'
      })
    );
  });

  it('ignores cells past the last span next to a valid one', () => {
    // Assert
    expect(resolveCreateTarget(doc, [...cells('a', 1), ...cells('a', 20)])).toEqual({ ok: true, target: { layerId: 'a', from: 1 } });
  });
});

describe('resolveRemoveTargets', () => {
  it('lists the tweens touched by the selection, grouped by layer, without duplicates', () => {
    // Act
    const result = resolveRemoveTargets(doc, [...cells('a', 6, 7, 1), ...cells('b', 2)]);

    // Assert
    expect(result).toEqual({
      ok: true,
      target: [
        { layerId: 'a', frames: [5] },
        { layerId: 'b', frames: [1] }
      ]
    });
  });

  it('refuses when no tween is touched', () => {
    // Assert
    [[], cells('a', 1, 10), cells('c', 1), cells('a', 30)].forEach((selection) =>
      expect(resolveRemoveTargets(doc, selection)).toEqual({
        ok: false,
        code: MotionTweenCodes.NO_TWEEN,
        message: 'Aucune interpolation sélectionnée'
      })
    );
  });
});
