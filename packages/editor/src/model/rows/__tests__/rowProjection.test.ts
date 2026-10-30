// packages/editor/src/model/rows/__tests__/rowProjection.test.ts
import type { ILayer, IPropertyTimeline, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { RowProjection, rowProjection, visibleRows } from '..';

const track: IPropertyTimeline = { initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value: 1 } }] };
const layer = (id: string, properties: Readonly<Record<string, IPropertyTimeline>> = { x: track }): ILayer =>
  ({ id, name: id, type: 'layer', spans: [], propertyTimelines: properties });
const document = (layers: readonly ILayer[]): ITimelineDocument => ({ version: '2.0.0', settings: { fps: 24, totalFrames: 24 }, layers });

it('projects collision-free property identities and only tracks with actual keys', () => {
  const doc = document([layer('a:b', { c: track, empty: { ...track, keys: [] } }), layer('a', { 'b:c': track, 'é["x"]': track }), layer('@property:["a:b","c"]', {})]);
  const rows = visibleRows(doc, new Set(['a:b', 'a']));
  expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  expect(rows.filter((row) => row.kind === 'property').map((row) => [row.layerId, row.property])).toEqual([
    ['a:b', 'c'], ['a', 'b:c'], ['a', 'é["x"]']
  ]);
  expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4, 5]);
});

it('restores manual expansion after selection changes and ignores focus-only selections', () => {
  const doc = document([layer('a'), layer('b')]);
  const projection = new RowProjection();
  expect(projection.rows(doc)).toHaveLength(2);
  projection.setExpanded('a', true);
  projection.select(['a']);
  const current = projection.rows(doc);
  expect(projection.select(['a'])).toBe(false);
  expect(projection.rows(doc)).toBe(current);
  projection.select(['b']);
  expect(projection.rows(doc)).toHaveLength(4);
  projection.select([]);
  expect(projection.rows(doc).map((row) => row.kind)).toEqual(['layer', 'property', 'layer']);
  projection.setExpanded('a', false);
  projection.select(['b']);
  projection.select([]);
  expect(projection.rows(doc)).toHaveLength(2);
});

it('permits a deliberate fold during automatic expansion and reopens only on a new selection', () => {
  const doc = document([layer('a')]);
  const projection = new RowProjection();
  projection.select(['a']);
  expect(projection.rows(doc)).toHaveLength(2);
  projection.setExpanded('a', false);
  projection.select(['a']);
  expect(projection.rows(doc)).toHaveLength(1);
  projection.select([]);
  projection.select(['a']);
  expect(projection.rows(doc)).toHaveLength(2);
});

it('prunes deleted nodes, resets on load and isolates editor instances', () => {
  const owner = {};
  expect(rowProjection(owner)).toBe(rowProjection(owner));
  expect(rowProjection(owner)).not.toBe(rowProjection({}));
  const projection = rowProjection(owner);
  projection.setExpanded('a', true);
  projection.rows(document([]));
  expect(projection.rows(document([layer('a')]))).toHaveLength(1);
  projection.setExpanded('a', true);
  projection.reset();
  expect(projection.rows(document([layer('a')]))).toHaveLength(1);
});
