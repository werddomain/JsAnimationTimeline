// packages/editor/src/model/rows/__tests__/visibleRows.test.ts
import type { IFolder, ILayer, ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { DEFAULT_FRAME_WIDTH, ROW_HEIGHT, visibleRows } from '..';

function layer(id: string): ILayer {
  return { id, type: 'layer', name: id, spans: [] };
}

function folder(id: string, children: readonly LayerNode[], collapsed?: boolean): IFolder {
  return { id, type: 'folder', name: id, children, ...(collapsed === undefined ? {} : { collapsed }) };
}

function doc(layers: readonly LayerNode[]): ITimelineDocument {
  return Object.freeze({ version: '2.0.0', settings: { fps: 24, totalFrames: 24 }, layers });
}

describe('visibleRows', () => {
  it('returns no rows for an empty document', () => {
    expect(visibleRows(doc([]))).toEqual([]);
  });

  it('lists top-level layers in order with depth 0 and no parent', () => {
    expect(visibleRows(doc([layer('a'), layer('b')]))).toEqual([
      { id: 'a', kind: 'layer', depth: 0, index: 0 },
      { id: 'b', kind: 'layer', depth: 0, index: 1 }
    ]);
  });

  it('lists a folder before its children, depth-first', () => {
    const rows = visibleRows(doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')]));
    expect(rows).toEqual([
      { id: 'f', kind: 'folder', depth: 0, index: 0 },
      { id: 'a', kind: 'layer', depth: 1, parentId: 'f', index: 1 },
      { id: 'g', kind: 'folder', depth: 1, parentId: 'f', index: 2 },
      { id: 'b', kind: 'layer', depth: 2, parentId: 'g', index: 3 },
      { id: 'c', kind: 'layer', depth: 0, index: 4 }
    ]);
  });

  it('keeps a collapsed folder but leaves out all its descendants', () => {
    const rows = visibleRows(doc([folder('f', [layer('a'), folder('g', [layer('b')])], true), layer('c')]));
    expect(rows.map((row) => row.id)).toEqual(['f', 'c']);
    expect(rows[1]).toEqual({ id: 'c', kind: 'layer', depth: 0, index: 1 });
  });

  it('hides only the children of a collapsed nested folder', () => {
    const rows = visibleRows(doc([folder('f', [folder('g', [layer('b')], true), layer('a')])]));
    expect(rows.map((row) => [row.id, row.index])).toEqual([
      ['f', 0],
      ['g', 1],
      ['a', 2]
    ]);
  });

  it('treats collapsed: false like a missing flag', () => {
    expect(visibleRows(doc([folder('f', [layer('a')], false)])).map((row) => row.id)).toEqual(['f', 'a']);
  });

  it('shows an empty folder as a single row', () => {
    expect(visibleRows(doc([folder('f', [])]))).toEqual([{ id: 'f', kind: 'folder', depth: 0, index: 0 }]);
  });

  it('does not change the document', () => {
    const source = doc([folder('f', [layer('a')], true)]);
    const before = JSON.stringify(source);
    visibleRows(source);
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('row metrics', () => {
  it('keeps the legacy TimelineGrid sizes', () => {
    expect(ROW_HEIGHT).toBe(30);
    expect(DEFAULT_FRAME_WIDTH).toBe(15);
  });
});
