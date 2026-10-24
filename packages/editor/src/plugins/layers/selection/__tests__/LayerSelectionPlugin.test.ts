// packages/editor/src/plugins/layers/selection/__tests__/LayerSelectionPlugin.test.ts
/**
 * `layers.selection` dans un vrai éditeur : service, événement, rendu
 * (classes, ARIA, tabindex itinérant), souris, clavier, élagage et nettoyage.
 */

import { createCommand } from '../../../../core/commands/createCommand';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import type { IEditor } from '../../../../core/editor/types';
import { updateLayerNode } from '../../list/layerTree';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';
import { createEditor } from '../../../../core/editor/createEditor';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { LayersPlugin } from '../../LayersPlugin';
import { LayerSelectionPlugin } from '../LayerSelectionPlugin';
import { SELECTED_ROW_CLASS } from '../selectionView';
import type { ILayerSelectionService, LayerSelectionChangedEvent } from '../types';

afterEach(unmountAll);

function recorder(events: LayerSelectionChangedEvent[]): EditorPlugin {
  return {
    id: 'test.selectionRecorder',
    dependencies: ['layers.selection'],
    init: (ctx: IEditorContext) => {
      ctx.events.on('layers:selectionChanged', (event) => events.push(event));
    },
    destroy: () => undefined
  };
}

interface IHarness extends IListHarness {
  readonly selection: ILayerSelectionService;
  readonly events: LayerSelectionChangedEvent[];
}

/** f(a, g(b)), c : lignes visibles f, a, g, b, c. */
const tree = doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')]);

function setup(data = tree): IHarness {
  const events: LayerSelectionChangedEvent[] = [];
  const harness = mount(data, [recorder(events)]);
  const selection = harness.editor.getService('layers.selection');
  if (selection === undefined) throw new Error('service layers.selection absent');
  return { ...harness, selection, events };
}

function row(h: IHarness, id: string): HTMLElement {
  const element = h.list.rowElement(id);
  if (element === undefined) throw new Error(`ligne ${id} absente`);
  return element;
}

interface IMods {
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
}

function click(target: Element, mods: IMods = {}): void {
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: mods.ctrl, shiftKey: mods.shift, metaKey: mods.meta })
  );
}

function mouseDown(target: Element): void {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

function press(target: Element, key: string, mods: IMods = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: mods.ctrl,
    shiftKey: mods.shift,
    metaKey: mods.meta
  });
  target.dispatchEvent(event);
  return event;
}

function collapse(editor: IEditor, id: string, collapsed: boolean): void {
  editor.execute(
    createCommand(
      'Replier',
      (current) => updateLayerNode(current, id, (node) => ({ ...node, collapsed })),
      (current) => updateLayerNode(current, id, (node) => ({ ...node, collapsed: !collapsed }))
    )
  );
}

describe('service and event', () => {
  it('starts empty, with the first row tabbable', () => {
    const h = setup();
    expect(h.selection.selected()).toEqual([]);
    expect(h.selection.anchor()).toBeUndefined();
    expect(h.selection.focused()).toBeUndefined();
    expect(row(h, 'f').tabIndex).toBe(0);
    expect(row(h, 'a').tabIndex).toBe(-1);
    expect(h.list.element()?.getAttribute('aria-multiselectable')).toBe('true');
    expect(row(h, 'a').getAttribute('aria-selected')).toBe('false');
  });

  it('returns selected ids in display order and answers isSelected', () => {
    const h = setup();
    h.selection.select(['c', 'a'], 'replace');
    expect(h.selection.selected()).toEqual(['a', 'c']);
    expect(h.selection.isSelected('a')).toBe(true);
    expect(h.selection.isSelected('b')).toBe(false);
    expect(h.selection.anchor()).toBe('a');
    expect(h.selection.focused()).toBe('a');
  });

  it('supports add and toggle modes', () => {
    const h = setup();
    h.selection.select(['a']);
    h.selection.select(['c'], 'add');
    expect(h.selection.selected()).toEqual(['a', 'c']);
    h.selection.select(['a'], 'toggle');
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('ignores ids that are not visible rows (hidden in a collapsed folder or unknown)', () => {
    const h = setup(doc([folder('f', [layer('a')], { collapsed: true }), layer('c')]));
    h.selection.select(['a', 'zz', 'c']);
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('selects ranges, all rows, and clears', () => {
    const h = setup();
    h.selection.selectRange('c', 'a');
    expect(h.selection.selected()).toEqual(['a', 'g', 'b', 'c']);
    expect(h.selection.anchor()).toBe('c');
    expect(h.selection.focused()).toBe('a');
    h.selection.selectRange('f', 'f', true);
    expect(h.selection.selected()).toEqual(['f', 'a', 'g', 'b', 'c']);
    h.selection.clear();
    expect(h.selection.selected()).toEqual([]);
    expect(h.selection.anchor()).toBeUndefined();
    expect(h.selection.focused()).toBe('f');
    h.selection.selectAll();
    expect(h.selection.selected()).toEqual(['f', 'a', 'g', 'b', 'c']);
  });

  it('emits layers:selectionChanged with ids, previous, anchor and focused, in display order', () => {
    const h = setup();
    h.selection.select(['c']);
    h.selection.select(['a'], 'add');
    expect(h.events).toEqual([
      { ids: ['c'], previous: [], anchor: 'c', focused: 'c' },
      { ids: ['a', 'c'], previous: ['c'], anchor: 'a', focused: 'a' }
    ]);
  });

  it('emits only when the set, the anchor or the focus really changes', () => {
    const h = setup();
    h.selection.select(['a']);
    h.selection.select(['a']);
    h.selection.select(['zz'], 'add');
    h.selection.selectRange('zz', 'a');
    expect(h.events).toHaveLength(1);
    h.selection.clear();
    h.selection.clear();
    expect(h.events).toHaveLength(2);
    expect(h.events[1]).toEqual({ ids: [], previous: ['a'], focused: 'a' });
  });

  it('emits for an anchor-only change', () => {
    const h = setup();
    h.selection.select(['a', 'b']);
    h.selection.selectRange('a', 'b');
    expect(h.events).toHaveLength(2);
    expect(h.events[1]).toMatchObject({ ids: ['a', 'g', 'b'], anchor: 'a', focused: 'b' });
  });

  it('is not part of the document history', () => {
    const h = setup();
    h.selection.select(['a']);
    expect(h.editor.canUndo).toBe(false);
  });
});

describe('rendering', () => {
  it('toggles the selected class and aria-selected, and moves the roving tabindex', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    expect(row(h, 'a').classList.contains(SELECTED_ROW_CLASS)).toBe(true);
    expect(row(h, 'a').getAttribute('aria-selected')).toBe('true');
    expect(row(h, 'b').getAttribute('aria-selected')).toBe('false');
    expect(row(h, 'c').tabIndex).toBe(0);
    expect(row(h, 'f').tabIndex).toBe(-1);
    h.selection.select(['b']);
    expect(row(h, 'a').classList.contains(SELECTED_ROW_CLASS)).toBe(false);
    expect(row(h, 'b').tabIndex).toBe(0);
  });

  it('paints rows created later (unfolded folder)', () => {
    const h = setup(doc([folder('f', [layer('a')], { collapsed: true }), layer('c')]));
    h.selection.select(['f']);
    collapse(h.editor, 'f', false);
    h.selection.select(['a'], 'add');
    expect(row(h, 'a').getAttribute('aria-selected')).toBe('true');
    expect(row(h, 'a').classList.contains(SELECTED_ROW_CLASS)).toBe(true);
  });

  it('keeps the painting on the same row element across updates', () => {
    const h = setup();
    h.selection.select(['a']);
    const before = row(h, 'a');
    h.editor.execute(
      createCommand(
        'Renommer',
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'A' })),
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'a' }))
      )
    );
    expect(row(h, 'a')).toBe(before);
    expect(before.classList.contains(SELECTED_ROW_CLASS)).toBe(true);
  });
});

describe('mouse', () => {
  it('selects only the clicked row on a plain click and focuses its element', () => {
    const h = setup();
    h.selection.select(['a', 'b']);
    click(row(h, 'c'));
    expect(h.selection.selected()).toEqual(['c']);
    expect(document.activeElement).toBe(row(h, 'c'));
  });

  it('also works when the click lands on a child of the row', () => {
    const h = setup();
    click(row(h, 'c').querySelector('.jt-layer-row__name') as Element);
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('toggles on Ctrl click and on Cmd click, moving the anchor', () => {
    const h = setup();
    click(row(h, 'a'));
    click(row(h, 'c'), { ctrl: true });
    expect(h.selection.selected()).toEqual(['a', 'c']);
    expect(h.selection.anchor()).toBe('c');
    click(row(h, 'a'), { meta: true });
    expect(h.selection.selected()).toEqual(['c']);
    expect(h.selection.anchor()).toBe('a');
  });

  it('selects a range over the visible rows on Shift click, keeping the anchor', () => {
    const h = setup(doc([folder('f', [layer('a')], { collapsed: true }), layer('c'), layer('d')]));
    click(row(h, 'f'));
    click(row(h, 'd'), { shift: true });
    expect(h.selection.selected()).toEqual(['f', 'c', 'd']);
    expect(h.selection.anchor()).toBe('f');
    click(row(h, 'c'), { shift: true });
    expect(h.selection.selected()).toEqual(['f', 'c']);
  });

  it('adds a range on Ctrl+Shift click', () => {
    const h = setup();
    click(row(h, 'f'));
    click(row(h, 'c'), { ctrl: true });
    click(row(h, 'b'), { ctrl: true, shift: true });
    expect(h.selection.selected()).toEqual(['f', 'b', 'c']);
  });

  it('treats Shift click without anchor as a plain click', () => {
    const h = setup();
    click(row(h, 'b'), { shift: true });
    expect(h.selection.selected()).toEqual(['b']);
  });

  it('ignores clicks on the folder toggle button', () => {
    const h = setup();
    h.selection.select(['c']);
    const toggle = row(h, 'f').querySelector('[data-action="toggle"]') as Element;
    click(toggle);
    expect(h.selection.selected()).toEqual(['c']);
    expect(document.activeElement).toBe(row(h, 'f'));
  });

  it('records focus that arrives natively on a row (roving tabindex follows)', () => {
    const h = setup();
    h.selection.select(['a']);
    h.events.length = 0;
    row(h, 'c').focus();
    expect(h.selection.focused()).toBe('c');
    expect(row(h, 'c').tabIndex).toBe(0);
    expect(row(h, 'a').tabIndex).toBe(-1);
    expect(h.selection.selected()).toEqual(['a']);
    expect(h.events).toEqual([{ ids: ['a'], previous: ['a'], anchor: 'a', focused: 'c' }]);
  });

  it('keeps the roving tabindex in sync after a click on the folder toggle', () => {
    const h = setup();
    click(row(h, 'c'));
    click(row(h, 'f').querySelector('[data-action="toggle"]') as Element);
    expect(h.selection.focused()).toBe('f');
    expect(row(h, 'f').tabIndex).toBe(0);
  });

  it('puts the DOM focus on the row after a click on a row control, not on an input', () => {
    const h = setup();
    h.list.addRowControl({
      id: 'test.eye',
      order: 1,
      render: (_row, element) => element.appendChild(document.createElement('button'))
    });
    click(row(h, 'a').querySelector('.jt-layer-row__control button') as Element);
    expect(document.activeElement).toBe(row(h, 'a'));
    const input = document.createElement('input');
    h.list.nameElement('b')?.appendChild(input);
    input.focus();
    click(input);
    expect(document.activeElement).toBe(input);
  });

  it('ignores clicks on row controls and in inputs', () => {
    const h = setup();
    h.selection.select(['c']);
    h.list.addRowControl({
      id: 'test.eye',
      order: 1,
      render: (_row, element) => element.appendChild(document.createElement('button'))
    });
    click(row(h, 'a').querySelector('.jt-layer-row__control button') as Element);
    const input = document.createElement('input');
    h.list.nameElement('b')?.appendChild(input);
    click(input);
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('ignores clicks on a name being edited', () => {
    const h = setup();
    h.selection.select(['c']);
    h.list.nameElement('a')?.setAttribute('data-editing', '');
    click(h.list.nameElement('a') as Element);
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('clears the selection on a click in the empty area below the rows, but not with Ctrl', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    click(h.list.element() as Element, { ctrl: true });
    expect(h.selection.selected()).toEqual(['a', 'c']);
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual([]);
  });

  it('keeps the selection when a press on a row is released elsewhere in the list', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    mouseDown(row(h, 'a'));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual(['a', 'c']);
    mouseDown(row(h, 'a'));
    click((h.list.element() as HTMLElement).parentElement as Element);
    expect(h.selection.selected()).toEqual(['a', 'c']);
  });

  it('clears when the press also started in the empty area, and forgets the press after a click', () => {
    const h = setup();
    h.selection.select(['a']);
    mouseDown(h.list.element() as Element);
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual([]);
    h.selection.select(['a']);
    mouseDown(row(h, 'a'));
    click(row(h, 'a'));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual([]);
  });

  it('emits exactly one event for a real row click (mousedown, native focus, click)', () => {
    const h = setup();
    h.selection.select(['a']);
    h.events.length = 0;
    mouseDown(row(h, 'c'));
    row(h, 'c').focus();
    click(row(h, 'c'));
    expect(h.events).toEqual([{ ids: ['c'], previous: ['a'], anchor: 'c', focused: 'c' }]);
  });

  it('syncs the model focus with a press that never became a click, once the press ends', async () => {
    const h = setup();
    h.selection.select(['a']);
    h.events.length = 0;
    mouseDown(row(h, 'c'));
    row(h, 'c').focus();
    expect(h.selection.focused()).toBe('a');
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(h.selection.focused()).toBe('c');
    expect(h.selection.selected()).toEqual(['a']);
  });

  it('replays the focus received during a press whose click does nothing (released elsewhere)', () => {
    const h = setup();
    h.selection.select(['a']);
    h.events.length = 0;
    mouseDown(row(h, 'c'));
    row(h, 'c').focus();
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual(['a']);
    expect(h.selection.focused()).toBe('c');
    expect(row(h, 'c').tabIndex).toBe(0);
    expect(row(h, 'a').tabIndex).toBe(-1);
    expect(h.events).toEqual([{ ids: ['a'], previous: ['a'], anchor: 'a', focused: 'c' }]);
  });

  it('keeps the selection when a press on empty space is released over a row', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    mouseDown(h.list.element() as Element);
    row(h, 'b').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    click((h.list.element() as HTMLElement).parentElement as Element);
    expect(h.selection.selected()).toEqual(['a', 'c']);
    mouseDown(h.list.element() as Element);
    row(h, 'b').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual(['a', 'c']);
  });

  it('still clears when the press starts and ends on empty space', () => {
    const h = setup();
    h.selection.select(['a']);
    mouseDown(h.list.element() as Element);
    (h.list.element() as Element).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual([]);
  });

  it('replays the pending focus from the zone click handler', () => {
    const h = setup();
    h.selection.select(['a']);
    mouseDown(row(h, 'c'));
    row(h, 'c').focus();
    click((h.list.element() as HTMLElement).parentElement as Element);
    expect(h.selection.selected()).toEqual(['a']);
    expect(h.selection.focused()).toBe('c');
  });

  it.each(['dragend', 'contextmenu'])('%s flushes the pending focus once and resets the release state', (type) => {
    const h = setup();
    h.selection.select(['a']);
    mouseDown(row(h, 'a'));
    row(h, 'c').focus();
    row(h, 'b').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.dispatchEvent(new Event(type, { bubbles: true }));
    expect(h.selection.focused()).toBe('c');
    h.events.length = 0;
    click(row(h, 'a'));
    expect(h.selection.focused()).toBe('a');
    expect(h.events).toHaveLength(1);
    mouseDown(h.list.element() as Element);
    row(h, 'b').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.dispatchEvent(new Event(type, { bubbles: true }));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual([]);
  });

  it('leaves no stale press state or timer after destroy', () => {
    jest.useFakeTimers();
    try {
      const h = setup();
      const base = jest.getTimerCount();
      mouseDown(row(h, 'a'));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(jest.getTimerCount()).toBe(base + 1);
      h.editor.destroy();
      expect(jest.getTimerCount()).toBeLessThanOrEqual(base);
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves no stale press state or timer after a second render', () => {
    jest.useFakeTimers();
    try {
      const events: LayerSelectionChangedEvent[] = [];
      const layers = new LayersPlugin();
      const plugin = layers.children.find((child) => child instanceof LayerSelectionPlugin) as LayerSelectionPlugin;
      const host = document.createElement('div');
      document.body.appendChild(host);
      const editor = createEditor(host, { data: tree, defaultPlugins: [new LayoutPlugin(), layers], plugins: [recorder(events)] });
      const list = editor.getService('layers.list');
      const selection = editor.getService('layers.selection') as ILayerSelectionService;
      selection.select(['a']);
      const base = jest.getTimerCount();
      mouseDown(list?.rowElement('a') as Element);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(jest.getTimerCount()).toBe(base + 1);
      plugin.render();
      expect(jest.getTimerCount()).toBe(base);
      click(list?.element() as Element);
      expect(selection.selected()).toEqual([]);
      editor.destroy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('forgets a stale press: mousedown without click, then a click without mousedown on the zone clears', async () => {
    const h = setup();
    h.selection.select(['a']);
    mouseDown(row(h, 'a'));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    click((h.list.element() as HTMLElement).parentElement as Element);
    expect(h.selection.selected()).toEqual([]);
  });

  it.each(['dragend', 'contextmenu'])('forgets the press on %s', (type) => {
    const h = setup();
    h.selection.select(['a']);
    mouseDown(row(h, 'a'));
    document.dispatchEvent(new Event(type, { bubbles: true }));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual([]);
  });

  it('forgets the press when the window loses focus', () => {
    const h = setup();
    h.selection.select(['a']);
    mouseDown(row(h, 'a'));
    window.dispatchEvent(new Event('blur'));
    click(h.list.element() as Element);
    expect(h.selection.selected()).toEqual([]);
  });

  it('clears the selection on a click in the layers zone around the list', () => {
    const h = setup();
    h.selection.select(['a']);
    click((h.list.element() as HTMLElement).parentElement as Element);
    expect(h.selection.selected()).toEqual([]);
  });
});

describe('keyboard', () => {
  it('moves the focus and the selection with Up and Down', () => {
    const h = setup();
    click(row(h, 'a'));
    press(row(h, 'a'), 'ArrowDown');
    expect(h.selection.selected()).toEqual(['g']);
    expect(document.activeElement).toBe(row(h, 'g'));
    expect(row(h, 'g').tabIndex).toBe(0);
    press(row(h, 'g'), 'ArrowUp');
    press(row(h, 'a'), 'ArrowUp');
    expect(h.selection.selected()).toEqual(['f']);
    press(row(h, 'f'), 'ArrowUp');
    expect(h.selection.selected()).toEqual(['f']);
  });

  it('prevents the default action of handled keys only', () => {
    const h = setup();
    click(row(h, 'a'));
    expect(press(row(h, 'a'), 'ArrowDown').defaultPrevented).toBe(true);
    expect(press(row(h, 'g'), 'x').defaultPrevented).toBe(false);
    h.selection.clear();
    expect(press(row(h, 'g'), 'Escape').defaultPrevented).toBe(false);
  });

  it('extends from the anchor with Shift+Down and shrinks back with Shift+Up', () => {
    const h = setup();
    click(row(h, 'a'));
    press(row(h, 'a'), 'ArrowDown', { shift: true });
    press(row(h, 'g'), 'ArrowDown', { shift: true });
    expect(h.selection.selected()).toEqual(['a', 'g', 'b']);
    expect(h.selection.anchor()).toBe('a');
    press(row(h, 'b'), 'ArrowUp', { shift: true });
    expect(h.selection.selected()).toEqual(['a', 'g']);
  });

  it('emits layers:selectionChanged for a focus-only change', () => {
    const h = setup();
    click(row(h, 'a'));
    h.events.length = 0;
    press(row(h, 'a'), 'ArrowDown', { ctrl: true });
    expect(h.events).toEqual([{ ids: ['a'], previous: ['a'], anchor: 'a', focused: 'g' }]);
  });

  it('moves the focus only with Ctrl+Down, then toggles with Space', () => {
    const h = setup();
    click(row(h, 'a'));
    press(row(h, 'a'), 'ArrowDown', { ctrl: true });
    expect(h.selection.selected()).toEqual(['a']);
    expect(h.selection.focused()).toBe('g');
    expect(h.selection.anchor()).toBe('a');
    expect(document.activeElement).toBe(row(h, 'g'));
    press(row(h, 'g'), ' ', { ctrl: true });
    expect(h.selection.selected()).toEqual(['a', 'g']);
    press(row(h, 'g'), ' ');
    expect(h.selection.selected()).toEqual(['a']);
  });

  it('goes to the first and last rows with Home and End, Shift extends', () => {
    const h = setup();
    click(row(h, 'g'));
    press(row(h, 'g'), 'End');
    expect(h.selection.selected()).toEqual(['c']);
    press(row(h, 'c'), 'Home', { shift: true });
    expect(h.selection.selected()).toEqual(['f', 'a', 'g', 'b', 'c']);
    press(row(h, 'f'), 'End');
    press(row(h, 'c'), 'Home');
    expect(h.selection.selected()).toEqual(['f']);
  });

  it('collapses an expanded folder on Left and expands it on Right', () => {
    const h = setup();
    click(row(h, 'f'));
    press(row(h, 'f'), 'ArrowLeft');
    expect(h.editor.document.layers[0]).toMatchObject({ id: 'f', collapsed: true });
    expect(h.list.rowElement('a')).toBeUndefined();
    expect(h.selection.focused()).toBe('f');
    press(row(h, 'f'), 'ArrowRight');
    expect(h.editor.document.layers[0]).toMatchObject({ id: 'f', collapsed: false });
    expect(h.list.rowElement('a')).toBeDefined();
  });

  it('goes to the parent on Left from a child and to the first child on Right from an expanded folder', () => {
    const h = setup();
    click(row(h, 'b'));
    press(row(h, 'b'), 'ArrowLeft');
    expect(h.selection.selected()).toEqual(['g']);
    press(row(h, 'g'), 'ArrowLeft');
    expect(h.editor.document.layers[0]).toMatchObject({ children: [{ id: 'a' }, { id: 'g', collapsed: true }] });
    press(row(h, 'g'), 'ArrowLeft');
    expect(h.selection.selected()).toEqual(['f']);
    press(row(h, 'f'), 'ArrowRight');
    expect(h.selection.selected()).toEqual(['a']);
  });

  it('selects all visible rows with Ctrl+A, and clears with Escape', () => {
    const h = setup(doc([folder('f', [layer('a')], { collapsed: true }), layer('c')]));
    click(row(h, 'c'));
    press(row(h, 'c'), 'a', { ctrl: true });
    expect(h.selection.selected()).toEqual(['f', 'c']);
    press(row(h, 'c'), 'Escape');
    expect(h.selection.selected()).toEqual([]);
    expect(h.selection.focused()).toBe('c');
    press(row(h, 'c'), 'ArrowDown', { shift: true });
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('starts from the first row when nothing is focused', () => {
    const h = setup();
    press(row(h, 'f'), 'ArrowDown');
    expect(h.selection.selected()).toEqual(['a']);
  });

  it('ignores keys from inputs, controls and the toggle button', () => {
    const h = setup();
    click(row(h, 'a'));
    const input = document.createElement('input');
    h.list.nameElement('a')?.appendChild(input);
    press(input, 'ArrowDown');
    press(row(h, 'f').querySelector('[data-action="toggle"]') as Element, ' ');
    press(input, 'a', { ctrl: true });
    expect(h.selection.selected()).toEqual(['a']);
  });

  it('uses the row that received the key as the current row', () => {
    const h = setup();
    click(row(h, 'a'));
    press(row(h, 'c'), 'ArrowUp');
    expect(h.selection.selected()).toEqual(['b']);
  });

  it('ignores keys when the event was already handled', () => {
    const h = setup();
    click(row(h, 'a'));
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    event.preventDefault();
    row(h, 'a').dispatchEvent(event);
    expect(h.selection.selected()).toEqual(['a']);
  });
});

describe('pruning', () => {
  it('leaves an input focused in another row when rows are removed around it', () => {
    const h = setup();
    const input = document.createElement('input');
    row(h, 'c').appendChild(input);
    input.focus();

    collapse(h.editor, 'f', true);

    expect(document.activeElement).toBe(input);
  });

  it('drops selected children when their folder is collapsed and focuses the folder', () => {
    const h = setup();
    h.selection.select(['a', 'b', 'c']);
    h.selection.select(['b'], 'add');
    h.events.length = 0;
    collapse(h.editor, 'f', true);
    expect(h.selection.selected()).toEqual(['c']);
    expect(h.selection.focused()).toBe('f');
    expect(h.selection.anchor()).toBe('f');
    expect(h.events).toEqual([{ ids: ['c'], previous: ['a', 'b', 'c'], anchor: 'f', focused: 'f' }]);
    expect(row(h, 'f').tabIndex).toBe(0);
  });

  it('does not bring the children back when the folder is expanded again', () => {
    const h = setup();
    h.selection.select(['a']);
    collapse(h.editor, 'f', true);
    collapse(h.editor, 'f', false);
    expect(h.selection.selected()).toEqual([]);
  });

  it('drops deleted rows and moves the focus to the nearest remaining row', () => {
    const h = setup();
    h.selection.select(['b']);
    h.events.length = 0;
    h.editor.execute(
      createCommand(
        'Supprimer',
        (current) => ({ ...current, layers: [folder('f', [layer('a')]), layer('c')] }),
        () => tree
      )
    );
    expect(h.selection.selected()).toEqual([]);
    expect(h.selection.focused()).toBe('c');
    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({ ids: [], previous: ['b'] });
  });

  it('clears selection, anchor and focus on document:loaded even when ids are reused', () => {
    const h = setup();
    h.selection.select(['c']);
    h.events.length = 0;
    h.editor.load(doc([layer('x'), layer('c')]));
    expect(h.selection.selected()).toEqual([]);
    expect(h.selection.anchor()).toBeUndefined();
    expect(h.selection.focused()).toBeUndefined();
    expect(h.events).toEqual([{ ids: [], previous: ['c'] }]);
    expect(row(h, 'x').tabIndex).toBe(0);
    expect(row(h, 'c').getAttribute('aria-selected')).toBe('false');
  });

  it('emits exactly one event with empty ids when a load changes the layout and reuses ids', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    h.events.length = 0;
    h.editor.load(doc([layer('c'), folder('f', [layer('a')]), layer('d')]));
    expect(h.events).toEqual([{ ids: [], previous: ['a', 'c'] }]);
    expect(h.selection.selected()).toEqual([]);
    expect(row(h, 'a').getAttribute('aria-selected')).toBe('false');
  });

  it('focuses the first row after a load when the list held the DOM focus', () => {
    const h = setup();
    click(row(h, 'b'));
    h.events.length = 0;
    h.editor.load(doc([layer('x'), layer('y')]));
    expect(document.activeElement).toBe(row(h, 'x'));
    expect(h.events).toEqual([{ ids: [], previous: ['b'], focused: 'x' }]);
    expect(row(h, 'x').tabIndex).toBe(0);
  });

  it('emits exactly one event on load with several rows selected and list focus, focused = first row', () => {
    const h = setup();
    click(row(h, 'a'));
    click(row(h, 'c'), { ctrl: true });
    h.events.length = 0;
    h.editor.load(doc([layer('x'), layer('c')]));
    expect(h.events).toEqual([{ ids: [], previous: ['a', 'c'], focused: 'x' }]);
  });

  it('keeps restoring the focus when the focused row is removed after a Chromium-style focusout', () => {
    const h = setup();
    click(row(h, 'b'));
    // Chromium : focusout (relatedTarget null) part avant le détachement de la ligne retirée.
    row(h, 'b').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    h.editor.execute(
      createCommand(
        'Supprimer',
        (current) => ({ ...current, layers: [folder('f', [layer('a'), folder('g', [])]), layer('c')] }),
        () => tree
      )
    );
    const focused = h.selection.focused() as string;
    expect(focused).toBe('c');
    expect(document.activeElement).toBe(row(h, focused));
  });

  it('focuses the first row on load after a Chromium-style focusout on the removed focused row', () => {
    const h = setup();
    click(row(h, 'b'));
    row(h, 'b').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    h.editor.load(doc([layer('x'), layer('y')]));
    expect(document.activeElement).toBe(row(h, 'x'));
  });

  it('does not steal the focus on load when focusedElement is stale and focus is elsewhere', () => {
    const h = setup();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    // focusin signalé sur une ligne alors que le focus réel est ailleurs : seul le garde le détecte.
    row(h, 'b').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    h.editor.load(doc([layer('x')]));
    expect(document.activeElement).toBe(outside);
  });

  it('does not steal the focus on load when it moved elsewhere', () => {
    const h = setup();
    click(row(h, 'b'));
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    h.editor.load(doc([layer('x')]));
    expect(document.activeElement).toBe(outside);
  });

  it('does not steal the focus on load after it left to nothing', async () => {
    const h = setup();
    click(row(h, 'b'));
    row(h, 'b').blur();
    await Promise.resolve();
    h.editor.load(doc([layer('x')]));
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps tracking a row blurred and refocused in the same stack', async () => {
    const h = setup();
    click(row(h, 'b'));
    row(h, 'b').focus();
    row(h, 'b').blur();
    row(h, 'b').focus();
    await Promise.resolve();
    h.editor.load(doc([layer('x')]));
    expect(document.activeElement).toBe(row(h, 'x'));
  });

  it('does not move the focus on load when the list did not hold it', () => {
    const h = setup();
    h.selection.select(['b']);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    h.editor.load(doc([layer('x')]));
    expect(document.activeElement).toBe(outside);
  });

  it('never exposes a hidden row as anchor or focus between rowsChanged and the prune', () => {
    const seen: Array<[string | undefined, string | undefined]> = [];
    const spy: EditorPlugin = {
      id: 'test.spy',
      dependencies: ['layers.selection'],
      init: (ctx: IEditorContext) => {
        ctx.events.on('layers:rowsChanged', () => {
          const service = ctx.services.get('layers.selection');
          seen.push([service?.anchor(), service?.focused()]);
        });
      },
      destroy: () => undefined
    };
    const h = mount(tree, [spy]);
    const selection = h.editor.getService('layers.selection') as ILayerSelectionService;
    selection.select(['b']);
    seen.length = 0;
    collapse(h.editor, 'f', true);
    expect(seen).toEqual([[undefined, undefined]]);
    expect(selection.focused()).toBe('f');
  });

  it('emits nothing on document:loaded when there is nothing to clear', () => {
    const h = setup();
    h.editor.load(doc([layer('x')]));
    expect(h.events).toEqual([]);
  });

  it('moves the DOM focus to the model focus when the focused row disappears', () => {
    const h = setup();
    click(row(h, 'b'));
    expect(document.activeElement).toBe(row(h, 'b'));
    collapse(h.editor, 'f', true);
    expect(document.activeElement).toBe(row(h, 'f'));
    expect(h.selection.focused()).toBe('f');
  });

  it('moves the DOM focus to the neighbour when the focused row is deleted', () => {
    const h = setup();
    click(row(h, 'a'));
    h.editor.execute(
      createCommand(
        'Supprimer',
        (current) => ({ ...current, layers: [folder('f', [folder('g', [layer('b')])]), layer('c')] }),
        () => tree
      )
    );
    expect(document.activeElement).toBe(row(h, h.selection.focused() as string));
  });

  it('does not steal the focus when the list did not hold it', () => {
    const h = setup();
    h.selection.select(['b']);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    collapse(h.editor, 'f', true);
    expect(document.activeElement).toBe(outside);
  });

  it('does not emit for document changes that keep the selection valid', () => {
    const h = setup();
    h.selection.select(['a']);
    h.events.length = 0;
    h.editor.execute(
      createCommand(
        'Renommer',
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'A' })),
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'a' }))
      )
    );
    expect(h.events).toEqual([]);
  });

  it('follows a reorder: selected() uses the new display order without an event', () => {
    const h = setup(doc([layer('a'), layer('b'), layer('c')]));
    h.selection.select(['a', 'c']);
    h.events.length = 0;
    h.editor.execute(
      createCommand(
        'Réordonner',
        (current) => ({ ...current, layers: [layer('c'), layer('b'), layer('a')] }),
        (current) => ({ ...current, layers: [layer('a'), layer('b'), layer('c')] })
      )
    );
    expect(h.selection.selected()).toEqual(['c', 'a']);
    expect(h.events).toEqual([]);
  });

  it('empties everything when the document has no rows', () => {
    const h = setup();
    h.selection.select(['a']);
    h.editor.load(doc([]));
    expect(h.selection.selected()).toEqual([]);
    expect(h.selection.focused()).toBeUndefined();
    expect(h.selection.anchor()).toBeUndefined();
  });

  it('drops a deleted child and keeps the rest', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    h.editor.execute(
      createCommand(
        'Supprimer',
        (current) => ({ ...current, layers: [folder('f', [folder('g', [layer('b')])]), layer('c')] }),
        () => tree
      )
    );
    expect(h.selection.selected()).toEqual(['c']);
  });
});

describe('render', () => {
  it('does not duplicate listeners when render is called twice', () => {
    const events: LayerSelectionChangedEvent[] = [];
    const layers = new LayersPlugin();
    const plugin = layers.children.find((child) => child instanceof LayerSelectionPlugin);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = createEditor(host, { data: tree, defaultPlugins: [new LayoutPlugin(), createShortcutsPlugin(), layers], plugins: [recorder(events)] });
    (plugin as LayerSelectionPlugin).render();
    const list = editor.getService('layers.list');
    click(list?.rowElement('a') as Element);
    editor.destroy();
    expect(events).toHaveLength(1);
  });

  it('seeds the known rows so the first prune finds the right neighbour', () => {
    const h = setup();
    expect(h.selection.focused()).toBeUndefined();
    h.selection.select(['b']);
    h.editor.load(doc([layer('c')]));
    expect(h.selection.selected()).toEqual([]);
  });
});

describe('destroy', () => {
  it('removes its listeners, attributes and service', () => {
    const h = setup();
    h.selection.select(['a']);
    const element = h.list.element() as HTMLElement;
    const a = row(h, 'a');
    h.editor.destroy();
    expect(element.isConnected).toBe(false);
    click(a);
    press(a, 'ArrowDown');
    expect(a.classList.contains(SELECTED_ROW_CLASS)).toBe(false);
    expect(a.hasAttribute('aria-selected')).toBe(false);
    expect(element.hasAttribute('aria-multiselectable')).toBe(false);
    expect(h.events).toHaveLength(1);
  });
});
