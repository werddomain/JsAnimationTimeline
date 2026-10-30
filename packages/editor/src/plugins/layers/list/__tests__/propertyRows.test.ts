// packages/editor/src/plugins/layers/list/__tests__/propertyRows.test.ts
import type { IPropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { IPropertyVisibleRow } from '../../../../model/rows';
import type { IFramesGridService } from '../../../frames/grid/types';
import { createCommand } from '../../../../core/commands/createCommand';
import { DropIndicator } from '../../reorder/dropIndicator';
import { doc, folder, layer, mount, unmountAll } from './fixtures';

afterEach(unmountAll);

const track: IPropertyTimeline = {
  initialValue: { kind: 'number', value: 0 },
  keys: [{ frame: 1, value: { kind: 'number', value: 0 } }, { frame: 20, value: { kind: 'number', value: 20 } }],
  transitions: [{ id: 'move', fromFrame: 1, toFrame: 20 }]
};

const source = doc([
  layer('a', { propertyTimelines: { x: track, opacity: { ...track, transitions: [] }, empty: { ...track, keys: [], transitions: [] } } }),
  layer('b', { propertyTimelines: { x: { ...track, transitions: [] } } })
]);

it('expands only nonempty property tracks in both views without document or history changes', () => {
  const { editor, host } = mount(source);
  const before = editor.document;
  const grid = editor.getService('frames.grid');
  editor.getService('layers.selection')?.select(['a']);

  expect(grid?.rows().map((row) => row.kind)).toEqual(['layer', 'property', 'property', 'layer']);
  expect(host.querySelectorAll('.jt-property-row')).toHaveLength(2);
  expect(host.querySelectorAll('.jt-grid__row--property')).toHaveLength(2);
  expect(grid?.element()?.style.height).toBe('120px');
  expect(editor.document).toBe(before);
  expect(editor.canUndo).toBe(false);
  expect(editor.canRedo).toBe(false);

  editor.getService('layers.selection')?.select(['b']);
  expect(grid?.rows().map((row) => row.kind)).toEqual(['layer', 'layer', 'property']);
  editor.getService('layers.selection')?.clear();
  expect(grid?.rows().map((row) => row.kind)).toEqual(['layer', 'layer']);
});

it('preserves a manual expansion when selection moves to another layer', () => {
  const { editor, host } = mount(source);
  const toggle = host.querySelector<HTMLButtonElement>('[data-row-id="a"] [data-action="toggle"]');
  expect(toggle).not.toBeNull();
  toggle?.click();
  editor.getService('layers.selection')?.select(['a']);
  editor.getService('layers.selection')?.select(['b']);
  expect(editor.getService('frames.grid')?.rows()).toHaveLength(5);
  editor.getService('layers.selection')?.clear();
  expect(editor.getService('frames.grid')?.rows()).toHaveLength(4);
});

it('places the node reorder indicator after the entire expanded property block', () => {
  const { editor, list, host } = mount(source);
  editor.getService('layers.selection')?.select(['a']);
  const indicator = new DropIndicator(list, host);
  indicator.show({ position: 'after', rowId: 'a', index: 1 });
  expect(host.querySelector<HTMLElement>('.jt-layer-drop-line')?.style.top).toBe('90px');
  indicator.destroy();
});

it('updates a reused property row indentation and ARIA level after reparenting and undo', () => {
  const { editor, host } = mount(doc([layer('a', { propertyTimelines: { x: track } }), folder('group', [])]));
  editor.getService('layers.selection')?.select(['a']);
  const label = host.querySelector<HTMLElement>('.jt-property-row');
  if (label === null) throw new Error('Missing property label');
  expect(label.style.paddingLeft).toBe('40px');
  expect(label.getAttribute('aria-level')).toBe('2');

  expect(editor.getService('layers.reorder')?.move(['a'], { parentId: 'group', index: 0 })).toBe(true);
  expect(host.querySelector('.jt-property-row')).toBe(label);
  expect(label.style.paddingLeft).toBe('56px');
  expect(label.getAttribute('aria-level')).toBe('3');

  editor.undo();
  expect(host.querySelector('.jt-property-row')).toBe(label);
  expect(label.style.paddingLeft).toBe('40px');
  expect(label.getAttribute('aria-level')).toBe('2');
  editor.redo();
  expect(host.querySelector('.jt-property-row')).toBe(label);
  expect(label.style.paddingLeft).toBe('56px');
  expect(label.getAttribute('aria-level')).toBe('3');
});

function property(grid: IFramesGridService, layerId: string, name: string): IPropertyVisibleRow {
  const row = grid.rows().find((candidate) => candidate.kind === 'property' && candidate.layerId === layerId && candidate.property === name);
  if (row?.kind !== 'property') throw new Error(`Missing property row: ${layerId}/${name}`);
  return row;
}

function pointer(element: HTMLElement, type: string, rowIndex: number, frame: number): void {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: (frame - 1) * 15 + 3, clientY: rowIndex * 30 + 3 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  element.dispatchEvent(event);
}

it('keeps node APIs and controls separate while both rendered surfaces use the same indices', () => {
  const { editor, list, host } = mount(source);
  editor.getService('layers.selection')?.select(['a']);
  const grid = editor.getService('frames.grid');
  if (grid === undefined) throw new Error('Missing grid');
  expect(list.visibleRows()).toBe(grid.rows());
  expect(list.rows().map((row) => [row.id, row.index])).toEqual([['a', 0], ['b', 3]]);
  const row = property(grid, 'a', 'x');
  const label = Array.from(host.querySelectorAll<HTMLElement>('.jt-property-row')).find((element) => element.dataset.propertyRowId === row.id);
  if (label === undefined) throw new Error('Missing label');
  expect(list.row(row.id)).toBeUndefined();
  expect(list.rowIdAt(label)).toBeUndefined();
  expect(label.querySelector('.jt-layer-row__controls')).toBeNull();
  const element = grid.element();
  if (element === undefined) throw new Error('Missing grid element');
  element.getBoundingClientRect = () => new DOMRect(0, 0, 600, 120);
  expect(grid.cellAt(3, 33)).toEqual({ rowId: row.id, rowIndex: 1, frame: 1 });
  const painted = Array.from(element.querySelectorAll<HTMLElement>('.jt-grid__row')).find((item) => item.dataset.rowId === row.id);
  expect(painted?.style.top).toBe('30px');
  expect(painted?.querySelectorAll('[data-frame]')).toHaveLength(2);
  expect(painted?.querySelector('[data-transition-id="move"]')).not.toBeNull();
  expect(painted?.querySelector('[data-span-id]')).toBeNull();
});

it('uses French property labels, honors author labels and exposes an accessible selected property', () => {
  const { editor, list, host } = mount(doc([layer('a', { propertyTimelines: { x: track, opacity: { ...track, label: 'Transparence', transitions: [] } } })]));
  editor.getService('layers.selection')?.select(['a']);
  const labels = Array.from(host.querySelectorAll<HTMLElement>('.jt-property-row'));
  expect(labels.map((element) => [element.textContent, element.getAttribute('aria-level'), element.dataset.layerId, element.dataset.property])).toEqual([
    ['Position X', '2', 'a', 'x'], ['Transparence', '2', 'a', 'opacity']
  ]);
  list.rowElement('a')?.focus();
  list.rowElement('a')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(labels[0]);
  expect(labels[0].getAttribute('aria-selected')).toBe('true');
  expect(labels[0].tabIndex).toBe(0);
  expect(list.rowElement('a')?.tabIndex).toBe(-1);
  labels[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(labels[1]);
  expect(labels[1].getAttribute('aria-selected')).toBe('true');
  expect(labels[0].getAttribute('aria-selected')).toBe('false');
  labels[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(list.rowElement('a'));
  expect(list.rowElement('a')?.tabIndex).toBe(0);
  expect(labels.every((element) => element.tabIndex === -1)).toBe(true);
});

it('selects property keys with explicit ownership and keeps the legacy key service empty', () => {
  const { editor } = mount(source);
  editor.getService('layers.selection')?.select(['a']);
  const grid = editor.getService('frames.grid');
  const selection = editor.getService('frames.selection');
  if (grid === undefined || selection === undefined) throw new Error('Missing services');
  const x = property(grid, 'a', 'x');
  const opacity = property(grid, 'a', 'opacity');
  selection.set([{ rowId: x.id, frame: 1 }, { rowId: opacity.id, frame: 1 }, { rowId: x.id, frame: 8 }]);
  expect(selection.cells()).toEqual([
    { rowId: x.id, frame: 1, layerId: 'a', property: 'x' },
    { rowId: x.id, frame: 8, layerId: 'a', property: 'x' },
    { rowId: opacity.id, frame: 1, layerId: 'a', property: 'opacity' }
  ]);
  expect(selection.propertyKeyframes()).toEqual([
    { rowId: x.id, frame: 1, layerId: 'a', property: 'x' },
    { rowId: opacity.id, frame: 1, layerId: 'a', property: 'opacity' }
  ]);
  expect(selection.keyframes()).toEqual([]);
  selection.select({ rowId: x.id, frame: 1 });
  selection.selectRange({ rowId: opacity.id, frame: 2 });
  expect(selection.cells()).toHaveLength(4);
  expect(new Set(selection.cells().map((cell) => `${cell.rowId}:${cell.frame}`)).size).toBe(4);
});

it('synchronizes the owner on pointerdown and still seeks when that expansion moves the clicked row', () => {
  const { editor, list } = mount(source);
  const grid = editor.getService('frames.grid');
  const selection = editor.getService('frames.selection');
  if (grid === undefined || selection === undefined) throw new Error('Missing services');
  editor.getService('layers.selection')?.select(['a']);
  list.setPropertiesExpanded('b', true);
  const row = property(grid, 'b', 'x');
  const element = grid.element();
  if (element === undefined) throw new Error('Missing grid element');
  element.getBoundingClientRect = () => new DOMRect(0, 0, 600, 150);
  pointer(element, 'pointerdown', row.index, 20);
  expect(editor.getService('layers.selection')?.selected()).toEqual(['b']);
  expect(property(grid, 'b', 'x').index).not.toBe(row.index);
  pointer(element, 'pointerup', row.index, 20);
  expect(editor.playback.frame).toBe(20);
  expect(selection.propertyKeyframes()).toEqual([{ rowId: row.id, layerId: 'b', property: 'x', frame: 20 }]);
});

it('prunes a folded property selection and clears all manual expansion on document load', () => {
  const { editor, list } = mount(source);
  const grid = editor.getService('frames.grid');
  const selection = editor.getService('frames.selection');
  if (grid === undefined || selection === undefined) throw new Error('Missing services');
  list.setPropertiesExpanded('a', true);
  selection.select({ rowId: property(grid, 'a', 'x').id, frame: 20 });
  list.setPropertiesExpanded('a', false);
  expect(selection.cells()).toEqual([]);
  expect(selection.anchor()).toBeUndefined();
  editor.getService('layers.selection')?.clear();
  list.setPropertiesExpanded('b', true);
  editor.load(source);
  expect(grid.rows().map((row) => row.kind)).toEqual(['layer', 'layer']);
  expect(editor.canUndo).toBe(false);
});

it('removes a property row and its selection when its last key is deleted, then restores it on undo', () => {
  const { editor } = mount(source);
  const grid = editor.getService('frames.grid');
  const selection = editor.getService('frames.selection');
  if (grid === undefined || selection === undefined) throw new Error('Missing services');
  editor.getService('layers.selection')?.select(['b']);
  const row = property(grid, 'b', 'x');
  selection.select({ rowId: row.id, frame: 1 });
  const before = editor.document;
  const after = { ...before, layers: before.layers.map((node) => node.id === 'b' && node.type === 'layer'
    ? { ...node, propertyTimelines: { x: { ...track, keys: [], transitions: [] } } } : node) };
  editor.execute(createCommand('Remove property keys', () => after, () => before));
  expect(selection.cells()).toEqual([]);
  expect(grid.rows().some((item) => item.id === row.id)).toBe(false);
  editor.undo();
  expect(property(grid, 'b', 'x').id).toBe(row.id);
});
