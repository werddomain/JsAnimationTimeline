// packages/editor/src/plugins/frames/clipboard/__tests__/clipboardOps.test.ts
/**
 * Tests de `pasteSpans` : coupes dans une plage fixe, vide ou interpolée,
 * recouvrement de plusieurs plages, collage après la dernière image (durée
 * du document), ids uniques, contiguïté, refus d'un calque verrouillé,
 * propriété inconnue du registre.
 */

import { evaluateLayer } from '@werddomain/timeline-runtime';
import type { ILayer, ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
import { SpanOperationCodes, SpanOperationError } from '../../../../model/spans';
import {
  createDoc,
  createRegistry,
  expectValid,
  layer,
  layerOf,
  shapeOf,
  spansOf
} from '../../../../model/spans/__tests__/fixtures';
import { pasteSpans } from '../clipboardOps';
import type { IClipRun } from '../types';

const registry: PropertyRegistry = createRegistry();

function run(length: number, kind: 'blank' | 'static' = 'blank', x = 0): IClipRun {
  const span =
    kind === 'blank'
      ? { start: 1, end: length, kind }
      : { start: 1, end: length, kind, tracks: { x: [{ frame: 1, value: x }] } };
  return { frameOffset: 0, length, spans: [span] };
}

function xAt(target: ILayer, frame: number): number {
  return evaluateLayer(target, frame, { registry }).values.x;
}

function refusal(action: () => unknown): SpanOperationError {
  try {
    action();
  } catch (error) {
    if (error instanceof SpanOperationError) return error;
    throw error;
  }
  throw new Error('Un refus était attendu.');
}

const staticLayer = (): ILayer =>
  layer('a', [{ id: 's', start: 1, end: 10, kind: 'static', tracks: { x: [{ frame: 1, value: 5 }] } }]);

describe('pasteSpans inside a span', () => {
  it('cuts a static span in two around the pasted frames', () => {
    // Arrange
    const doc = createDoc([staticLayer()]);

    // Act
    const next = pasteSpans(doc, 'a', 4, run(3), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['static 1-3', 'blank 4-6', 'static 7-10']);
    expect(spansOf(next, 'a')[2].tracks).toEqual({ x: [{ frame: 7, value: 5 }] });
    expectValid(next);
  });

  it('cuts a blank span and keeps the remainder blank', () => {
    // Arrange
    const doc = createDoc([layer('a', [{ id: 'b', start: 1, end: 10, kind: 'blank' }])]);

    // Act
    const next = pasteSpans(doc, 'a', 5, run(2, 'static', 9), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['blank 1-4', 'static 5-6', 'blank 7-10']);
    expect(spansOf(next, 'a')[1].tracks).toEqual({ x: [{ frame: 5, value: 9 }] });
    expectValid(next);
  });

  it('cuts a tween so both sides keep the values of the source', () => {
    // Arrange
    const source = layer('a', [
      { id: 't', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] } }
    ]);
    const doc = createDoc([source]);

    // Act
    const next = pasteSpans(doc, 'a', 4, run(2), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['tween 1-3', 'blank 4-5', 'tween 6-11']);
    const after = layerOf(next, 'a');
    [1, 2, 3, 6, 7, 8, 11].forEach((frame) => expect(xAt(after, frame)).toBeCloseTo(xAt(source, frame)));
    expectValid(next);
  });

  it('keeps the original id on the left part and gives new unique ids to the rest', () => {
    // Arrange
    const doc = createDoc([staticLayer()]);

    // Act
    const next = pasteSpans(doc, 'a', 4, run(3), registry);

    // Assert
    const ids = spansOf(next, 'a').map((span) => span.id);
    expect(ids[0]).toBe('s');
    expect(new Set(ids).size).toBe(3);
  });

  it('replaces from the first frame of a span without leaving an empty left part', () => {
    // Arrange
    const doc = createDoc([staticLayer()]);

    // Act
    const next = pasteSpans(doc, 'a', 1, run(4), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['blank 1-4', 'static 5-10']);
  });

  it('removes the spans fully covered and cuts the ones at the edges', () => {
    // Arrange
    const doc = createDoc([
      layer('a', [
        { id: 'a1', start: 1, end: 3, kind: 'static', tracks: { x: [{ frame: 1, value: 1 }] } },
        { id: 'a2', start: 4, end: 6, kind: 'static', tracks: { x: [{ frame: 4, value: 2 }] } },
        { id: 'a3', start: 7, end: 9, kind: 'static', tracks: { x: [{ frame: 7, value: 3 }] } }
      ])
    ]);

    // Act
    const next = pasteSpans(doc, 'a', 3, run(4), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['static 1-2', 'blank 3-6', 'static 7-9']);
    expect(spansOf(next, 'a').map((span) => span.id)).not.toContain('a2');
    expectValid(next);
  });

  it('shifts the pasted tracks to absolute frames and keeps the easing', () => {
    // Arrange
    const doc = createDoc([layer('a', [{ id: 'b', start: 1, end: 10, kind: 'blank' }])]);
    const clip: IClipRun = {
      frameOffset: 0,
      length: 3,
      spans: [
        { start: 1, end: 3, kind: 'tween', easing: 'ease-in', tracks: { x: [{ frame: 1, value: 0 }, { frame: 3, value: 10 }] } }
      ]
    };

    // Act
    const next = pasteSpans(doc, 'a', 5, clip, registry);

    // Assert
    expect(spansOf(next, 'a')[1]).toMatchObject({
      start: 5,
      end: 7,
      kind: 'tween',
      easing: 'ease-in',
      tracks: { x: [{ frame: 5, value: 0 }, { frame: 7, value: 10 }] }
    });
  });

  it('copies a property unknown to the registry without interpolating it', () => {
    // Arrange
    const doc = createDoc([layer('a', [{ id: 'b', start: 1, end: 10, kind: 'blank' }])]);
    const clip: IClipRun = {
      frameOffset: 0,
      length: 2,
      spans: [{ start: 1, end: 2, kind: 'tween', tracks: { glow: [{ frame: 1, value: 1 }, { frame: 2, value: 2 }] } }]
    };

    // Act
    const next = pasteSpans(doc, 'a', 3, clip, registry);

    // Assert
    expect(spansOf(next, 'a')[1].tracks).toEqual({ glow: [{ frame: 3, value: 1 }, { frame: 4, value: 2 }] });
  });

  it('does not change the source document', () => {
    // Arrange
    const doc = createDoc([staticLayer()]);

    // Act
    pasteSpans(doc, 'a', 4, run(3), registry);

    // Assert
    expect(shapeOf(doc, 'a')).toEqual(['static 1-10']);
  });
});

describe('pasteSpans past the last frame of the layer', () => {
  const shortLayer = (): ILayer =>
    layer('a', [{ id: 's', start: 1, end: 5, kind: 'static', tracks: { x: [{ frame: 1, value: 1 }] } }]);

  it('extends the last span up to the frame before the paste', () => {
    // Arrange
    const doc = createDoc([shortLayer()]);

    // Act
    const next = pasteSpans(doc, 'a', 8, run(3), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['static 1-7', 'blank 8-10']);
    expect(next.settings.totalFrames).toBe(24);
    expectValid(next);
  });

  it('does not extend anything when the paste starts right after the last span', () => {
    // Arrange
    const doc = createDoc([shortLayer()]);

    // Act
    const next = pasteSpans(doc, 'a', 6, run(2), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['static 1-5', 'blank 6-7']);
  });

  it('fills an empty layer with a blank span before the paste', () => {
    // Arrange
    const doc = createDoc([layer('a', [])]);

    // Act
    const next = pasteSpans(doc, 'a', 4, run(2, 'static', 3), registry);

    // Assert
    expect(shapeOf(next, 'a')).toEqual(['blank 1-3', 'static 4-5']);
    expectValid(next);
  });

  it('grows totalFrames to the last pasted frame', () => {
    // Arrange
    const doc = createDoc([layer('a', [{ id: 'b', start: 1, end: 24, kind: 'blank' }])]);

    // Act
    const next = pasteSpans(doc, 'a', 22, run(5), registry);

    // Assert
    expect(next.settings.totalFrames).toBe(26);
    expect(shapeOf(next, 'a')).toEqual(['blank 1-21', 'blank 22-26']);
    expectValid(next);
  });

  it('keeps totalFrames when the pasted frames fit', () => {
    // Arrange
    const doc = createDoc([staticLayer()]);

    // Act
    const next = pasteSpans(doc, 'a', 4, run(3), registry);

    // Assert
    expect(next.settings.totalFrames).toBe(24);
  });
});

describe('pasteSpans refusals', () => {
  it('refuses a locked layer', () => {
    // Arrange
    const doc = createDoc([{ ...staticLayer(), locked: true }]);

    // Act
    const error = refusal(() => pasteSpans(doc, 'a', 2, run(2), registry));

    // Assert
    expect(error.code).toBe(SpanOperationCodes.LAYER_LOCKED);
  });

  it('refuses a layer whose parent folder is locked', () => {
    // Arrange
    const doc = createDoc([{ id: 'f', type: 'folder', name: 'f', locked: true, children: [staticLayer()] }]);

    // Act
    const error = refusal(() => pasteSpans(doc, 'a', 2, run(2), registry));

    // Assert
    expect(error.code).toBe(SpanOperationCodes.LAYER_LOCKED);
  });

  it('refuses an unknown layer', () => {
    // Act
    const error = refusal(() => pasteSpans(createDoc([]), 'missing', 1, run(1), registry));

    // Assert
    expect(error.code).toBe(SpanOperationCodes.LAYER_NOT_FOUND);
  });

  it.each([0, -3, 1.5, Number.NaN])('refuses the invalid first frame %p', (frame) => {
    // Act
    const error = refusal(() => pasteSpans(createDoc([staticLayer()]), 'a', frame, run(1), registry));

    // Assert
    expect(error.code).toBe(SpanOperationCodes.INVALID_FRAME);
  });
});

describe('pasteSpans on a large layer', () => {
  it('stays contiguous with ten thousand spans', () => {
    // Arrange
    const spans = Array.from({ length: 10000 }, (_, index) => ({
      id: `s${index}`,
      start: index + 1,
      end: index + 1,
      kind: 'blank' as const
    }));
    const doc: ITimelineDocument = createDoc([layer('a', spans)], 10000);

    // Act
    const next = pasteSpans(doc, 'a', 5000, run(100), registry);

    // Assert
    const result = spansOf(next, 'a');
    expect(result).toHaveLength(9901);
    expect(result.every((span, index) => index === 0 || span.start === result[index - 1].end + 1)).toBe(true);
  });
});
