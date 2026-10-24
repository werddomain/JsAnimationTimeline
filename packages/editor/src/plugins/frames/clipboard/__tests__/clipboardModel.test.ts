// packages/editor/src/plugins/frames/clipboard/__tests__/clipboardModel.test.ts
/**
 * Tests du modèle de copie : rectangle, sélection en escalier, plages coupées
 * aux bords (interpolation, plage fixe), images au-delà de la dernière plage,
 * gel profond du résultat.
 */

import { evaluateLayer } from '@werddomain/timeline-runtime';
import type { ILayer, ISpan, PropertyRegistry } from '@werddomain/timeline-runtime';
import { visibleRows } from '../../../../model/rows';
import { createDoc, createRegistry, layer } from '../../../../model/spans/__tests__/fixtures';
import { buildClip, extractSpans } from '../clipboardModel';
import type { IClipSpan } from '../types';

const registry: PropertyRegistry = createRegistry();

/** Interpolation x : 0 (image 1) -> 100 (image 11), puis une plage fixe 12-14 et une vide 15-16. */
const source: ILayer = layer('a', [
  { id: 't', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }] } },
  { id: 's', start: 12, end: 14, kind: 'static', tracks: { x: [{ frame: 12, value: 100 }] } },
  { id: 'b', start: 15, end: 16, kind: 'blank' }
]);

function cells(rowId: string, first: number, last: number): Array<{ rowId: string; frame: number }> {
  return Array.from({ length: last - first + 1 }, (_, index) => ({ rowId, frame: first + index }));
}

/** Calque qui rejoue les plages copiées (images relatives), pour les évaluer comme la source. */
function replay(spans: readonly IClipSpan[]): ILayer {
  return layer(
    'copy',
    spans.map((span, index): ISpan => ({ id: `c${index}`, ...span }))
  );
}

function xAt(target: ILayer, frame: number): number {
  return evaluateLayer(target, frame, { registry }).values.x;
}

describe('extractSpans', () => {
  it('keeps a whole span untouched, relative to the first copied frame', () => {
    // Act
    const spans = extractSpans(source, 12, 16, registry);

    // Assert
    expect(spans).toEqual([
      { start: 1, end: 3, kind: 'static', tracks: { x: [{ frame: 1, value: 100 }] } },
      { start: 4, end: 5, kind: 'blank' }
    ]);
  });

  it('cuts a tween at both edges so the pasted values equal the source values', () => {
    // Act
    const spans = extractSpans(source, 4, 8, registry);
    const copy = replay(spans);

    // Assert
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ start: 1, end: 5, kind: 'tween' });
    for (let frame = 1; frame <= 5; frame += 1) {
      expect(xAt(copy, frame)).toBeCloseTo(xAt(source, frame + 3));
    }
  });

  it('puts keyframes on the cut edges and keeps the inner ones of a tween', () => {
    // Arrange
    const withInner = layer('a', [
      {
        id: 't',
        start: 1,
        end: 11,
        kind: 'tween',
        easing: 'ease-in',
        tracks: { x: [{ frame: 1, value: 0 }, { frame: 6, value: 40 }, { frame: 11, value: 100 }] }
      }
    ]);

    // Act
    const [piece] = extractSpans(withInner, 3, 8, registry);

    // Assert
    expect(piece.easing).toBe('ease-in');
    expect(piece.tracks?.x.map((keyframe) => keyframe.frame)).toEqual([1, 4, 6]);
  });

  it('turns a static span cut at its left edge into a static piece with the evaluated values', () => {
    // Arrange
    const held = layer('a', [
      { id: 't', start: 1, end: 5, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 5, value: 40 }] } },
      { id: 's', start: 6, end: 10, kind: 'static', tracks: { x: [{ frame: 6, value: 40 }] } }
    ]);

    // Act
    const spans = extractSpans(held, 8, 10, registry);

    // Assert
    expect(spans).toEqual([{ start: 1, end: 3, kind: 'static', tracks: { x: [{ frame: 1, value: 40 }] } }]);
  });

  it('extends the trailing blank piece over the frames beyond the last span', () => {
    // Act
    const spans = extractSpans(source, 15, 20, registry);

    // Assert
    expect(spans).toEqual([{ start: 1, end: 6, kind: 'blank' }]);
  });

  it('adds a blank piece after a last span that is not blank', () => {
    // Arrange
    const ending = layer('a', [{ id: 's', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 7 }] } }]);

    // Act
    const spans = extractSpans(ending, 3, 7, registry);

    // Assert
    expect(spans.map((span) => `${span.kind} ${span.start}-${span.end}`)).toEqual(['static 1-2', 'blank 3-5']);
  });

  it('copies frames of an empty layer as a blank piece', () => {
    // Act
    const spans = extractSpans(layer('e', []), 3, 5, registry);

    // Assert
    expect(spans).toEqual([{ start: 1, end: 3, kind: 'blank' }]);
  });

  it('keeps tracks of a property unknown to the registry when the span is not cut', () => {
    // Arrange
    const unknown = layer('u', [
      { id: 't', start: 1, end: 4, kind: 'tween', tracks: { glow: [{ frame: 1, value: 0 }, { frame: 4, value: 9 }] } }
    ]);

    // Act
    const spans = extractSpans(unknown, 1, 4, registry);

    // Assert
    expect(spans[0].tracks).toEqual({ glow: [{ frame: 1, value: 0 }, { frame: 4, value: 9 }] });
  });
});

describe('buildClip', () => {
  const doc = createDoc([
    source,
    { id: 'f', type: 'folder', name: 'f', children: [] },
    layer('c', [{ id: 'cs', start: 1, end: 24, kind: 'static', tracks: { x: [{ frame: 1, value: 5 }] } }])
  ]);
  const rows = visibleRows(doc);

  it('returns undefined when no cell belongs to a layer row', () => {
    // Act
    const clip = buildClip(doc, rows, [{ rowId: 'f', frame: 2 }], registry);

    // Assert
    expect(clip).toBeUndefined();
  });

  it('copies a rectangle with one run per row', () => {
    // Act
    const clip = buildClip(doc, rows, [...cells('a', 12, 14), ...cells('c', 12, 14)], registry);

    // Assert
    expect(clip).toMatchObject({ format: 'jstimeline/frames', version: 1, width: 3 });
    expect(clip?.rows.map((row) => [row.rowOffset, row.runs.map((run) => [run.frameOffset, run.length])])).toEqual([
      [0, [[0, 3]]],
      [1, [[0, 3]]]
    ]);
  });

  it('counts layer rows only, so a folder between two layers does not shift the offset', () => {
    // Act
    const clip = buildClip(doc, rows, [{ rowId: 'a', frame: 1 }, { rowId: 'c', frame: 1 }], registry);

    // Assert
    expect(clip?.rows.map((row) => row.rowOffset)).toEqual([0, 1]);
  });

  it('keeps the shape of a ragged selection with separate runs and offsets', () => {
    // Arrange
    const picked = [{ rowId: 'a', frame: 2 }, { rowId: 'a', frame: 3 }, { rowId: 'a', frame: 6 }, { rowId: 'c', frame: 4 }];

    // Act
    const clip = buildClip(doc, rows, picked, registry);

    // Assert
    expect(clip?.width).toBe(5);
    expect(clip?.rows[0].runs.map((run) => [run.frameOffset, run.length])).toEqual([[0, 2], [4, 1]]);
    expect(clip?.rows[1]).toMatchObject({ rowOffset: 1, runs: [{ frameOffset: 2, length: 1 }] });
  });

  it('is frozen in depth', () => {
    // Act
    const clip = buildClip(doc, rows, cells('a', 3, 6), registry);

    // Assert
    expect(Object.isFrozen(clip)).toBe(true);
    expect(Object.isFrozen(clip?.rows[0].runs[0].spans[0])).toBe(true);
    expect(Object.isFrozen(clip?.rows[0].runs[0].spans[0].tracks?.x)).toBe(true);
  });

  it('does not share structure with the document', () => {
    // Act
    const clip = buildClip(doc, rows, cells('c', 1, 3), registry);

    // Assert
    expect(clip?.rows[0].runs[0].spans[0].tracks).not.toBe(doc.layers[2].type === 'layer' ? doc.layers[2].spans[0].tracks : undefined);
  });

  it('copies the keyframes instead of keeping the document objects', () => {
    // Act
    const clip = buildClip(doc, rows, cells('a', 1, 10), registry);
    const sourceKeyframes = doc.layers[0].type === 'layer' ? doc.layers[0].spans.flatMap((span) => span.tracks?.x ?? []) : [];
    const copied = clip?.rows[0].runs[0].spans.flatMap((span) => span.tracks?.x ?? []) ?? [];

    // Assert : aucune image clé copiée n'est un objet du document.
    expect(copied.length).toBeGreaterThan(0);
    expect(copied.some((keyframe) => sourceKeyframes.includes(keyframe))).toBe(false);
  });
});
