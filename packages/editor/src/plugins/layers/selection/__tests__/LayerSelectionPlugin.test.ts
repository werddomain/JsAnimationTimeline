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
import { SELECTED_ROW_CLASS } from '../selectionView';
import type { ILayerSelectionService, SelectionChangedEvent } from '../types';

afterEach(unmountAll);

function recorder(events: SelectionChangedEvent[]): EditorPlugin {
  return {
    id: 'test.selectionRecorder',
    dependencies: ['layers.selection'],
    init: (ctx: IEditorContext) => {
      ctx.events.on('selection:changed', (event) => events.push(event));
    },
    destroy: () => undefined
  };
}

interface IHarness extends IListHarness {
  readonly selection: ILayerSelectionService;
  readonly events: SelectionChangedEvent[];
}

/** f(a, g(b)), c : lignes visibles f, a, g, b, c. */
const tree = doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')]);

function setup(data = tree): IHarness {
  const events: SelectionChangedEvent[] = [];
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

  it('emits selection:changed with ids, previous, anchor and focused, in display order', () => {
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
    h.editor.load(doc([folder('f', [layer('a')]), layer('c')]));
    expect(h.selection.selected()).toEqual([]);
    expect(h.selection.focused()).toBe('c');
    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({ ids: [], previous: ['b'] });
  });

  it('keeps a selected row that survives a reload and emits nothing', () => {
    const h = setup();
    h.selection.select(['c']);
    h.events.length = 0;
    h.editor.load(doc([layer('x'), layer('c')]));
    expect(h.selection.selected()).toEqual(['c']);
    expect(h.events).toEqual([]);
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
    h.editor.load(doc([layer('c'), layer('b'), layer('a')]));
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
    h.editor.load(doc([folder('f', [folder('g', [layer('b')])]), layer('c')]));
    expect(h.selection.selected()).toEqual(['c']);
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
