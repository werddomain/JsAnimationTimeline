// packages/editor/src/plugins/tweens/motion/__tests__/removeMotionTween.test.ts
/**
 * Tests de la suppression pure d'une interpolation : la plage redevient
 * statique avec les valeurs évaluées au début, sans accélération ni images
 * clés de propriété, et les refus.
 */

import { evaluateLayer } from '@werddomain/timeline-runtime';
import type { ISpan } from '@werddomain/timeline-runtime';
import { createDoc, createRegistry, expectValid, layer, layerOf, shapeOf, spansOf } from '../../../../model/spans/__tests__/fixtures';
import { MotionTweenCodes, MotionTweenError } from '../MotionTweenError';
import { removeMotionTween, removeMotionTweens } from '../removeMotionTween';
import { SpanOperationCodes, SpanOperationError } from '../../../../model/spans/SpanOperationError';

const registry = createRegistry();

const tween: ISpan = {
  id: 't1',
  start: 5,
  end: 12,
  kind: 'tween',
  easing: 'ease-in',
  tracks: { x: [{ frame: 5, value: 10 }, { frame: 8, value: 40 }, { frame: 12, value: 90 }] }
};

function sample() {
  return createDoc([
    layer('l1', [
      { id: 's0', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }], y: [{ frame: 1, value: 3 }] } },
      tween,
      { id: 's2', start: 13, end: 16, kind: 'static', tracks: { x: [{ frame: 13, value: 90 }] } }
    ])
  ]);
}

describe('removeMotionTween', () => {
  it('turns the tween back into a static span at the start values, dropping easing and keyframes', () => {
    // Arrange
    const doc = sample();

    // Act
    const next = removeMotionTween(doc, 'l1', 9, registry);

    // Assert
    expectValid(next);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-4', 'static 5-12', 'static 13-16']);
    expect(spansOf(next, 'l1')[1]).toEqual({ id: 't1', start: 5, end: 12, kind: 'static', tracks: { x: [{ frame: 5, value: 10 }] } });
    expect(spansOf(next, 'l1')[0]).toBe(spansOf(doc, 'l1')[0]);
    expect(spansOf(next, 'l1')[2]).toBe(spansOf(doc, 'l1')[2]);
  });

  it('uses the value carried from earlier spans when the track starts after the span start', () => {
    // Arrange
    const late: ISpan = { id: 't', start: 5, end: 9, kind: 'tween', tracks: { x: [{ frame: 7, value: 50 }, { frame: 9, value: 70 }] } };
    const doc = createDoc([layer('l1', [{ id: 's', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 20 }] } }, late])]);

    // Act
    const next = removeMotionTween(doc, 'l1', 5, registry);

    // Assert
    expectValid(next);
    expect(evaluateLayer(layerOf(next, 'l1'), 8, { registry }).values.x).toBe(20);
    expect(spansOf(next, 'l1')[1].tracks).toEqual({ x: [{ frame: 5, value: 20 }] });
  });

  it('gives a tween without tracks a static span without tracks', () => {
    // Arrange
    const doc = createDoc([layer('l1', [{ id: 't', start: 1, end: 3, kind: 'tween' }])]);

    // Act
    const next = removeMotionTween(doc, 'l1', 2, registry);

    // Assert
    expect(spansOf(next, 'l1')[0]).toEqual({ id: 't', start: 1, end: 3, kind: 'static' });
  });

  it('removes several tweens of one layer reading values from the original layer', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [
        { id: 'a', start: 1, end: 4, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 4, value: 100 }] } },
        { id: 'b', start: 5, end: 8, kind: 'tween', tracks: { x: [{ frame: 6, value: 200 }, { frame: 8, value: 300 }] } }
      ])
    ]);

    // Act
    const next = removeMotionTweens(doc, 'l1', [1, 5], registry);

    // Assert
    expectValid(next);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-4', 'static 5-8']);
    expect(spansOf(next, 'l1')[1].tracks).toEqual({ x: [{ frame: 5, value: 100 }] });
  });

  it('refuses a static span, a blank span, frames past the last span and no frame at all', () => {
    // Arrange
    const doc = createDoc([
      layer('l1', [{ id: 's', start: 1, end: 4, kind: 'static' }, { id: 'b', start: 5, end: 8, kind: 'blank' }])
    ]);
    const code = (action: () => unknown): string => {
      try {
        action();
      } catch (error) {
        if (error instanceof MotionTweenError) return error.code;
        throw error;
      }
      return 'none';
    };

    // Assert
    expect(code(() => removeMotionTween(doc, 'l1', 2, registry))).toBe(MotionTweenCodes.NO_TWEEN);
    expect(code(() => removeMotionTween(doc, 'l1', 6, registry))).toBe(MotionTweenCodes.NO_TWEEN);
    expect(code(() => removeMotionTween(doc, 'l1', 20, registry))).toBe(MotionTweenCodes.NO_TWEEN);
    expect(() => removeMotionTweens(doc, 'l1', [], registry)).toThrow('Aucune interpolation à supprimer.');
  });

  it('refuses a locked layer, an unknown layer and an invalid frame', () => {
    // Arrange
    const locked = createDoc([layer('l1', [tween], { locked: true })]);
    const open = sample();
    const codeOf = (action: () => unknown): unknown => {
      try {
        action();
      } catch (error) {
        return error instanceof SpanOperationError ? error.code : error;
      }
      return undefined;
    };

    // Assert
    expect(codeOf(() => removeMotionTween(locked, 'l1', 6, registry))).toBe(SpanOperationCodes.LAYER_LOCKED);
    expect(codeOf(() => removeMotionTween(open, 'zz', 6, registry))).toBe(SpanOperationCodes.LAYER_NOT_FOUND);
    expect(codeOf(() => removeMotionTween(open, 'l1', 0, registry))).toBe(SpanOperationCodes.INVALID_FRAME);
  });
});
