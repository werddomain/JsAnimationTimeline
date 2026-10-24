// packages/editor/src/plugins/layers/groups/__tests__/LayerGroupsPlugin.test.ts
/**
 * `layers.groups` dans un vrai éditeur : service, sélection du nouveau
 * dossier, annulation, raccourcis Ctrl+G / Ctrl+Maj+G et nettoyage.
 */

import { isFolder } from '@werddomain/timeline-runtime';
import type { LayerNode } from '@werddomain/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { LayersPlugin } from '../../LayersPlugin';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';
import type { ILayerSelectionService } from '../../selection';
import type { ILayerGroupsService } from '../types';

afterEach(unmountAll);

interface IHarness extends IListHarness {
  readonly groups: ILayerGroupsService;
  readonly selection: ILayerSelectionService;
}

/** f(a, g(b)), c : lignes visibles f, a, g, b, c. */
const tree = doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')]);

function setup(data = tree): IHarness {
  const harness = mount(data);
  const groups = harness.editor.getService('layers.groups');
  const selection = harness.editor.getService('layers.selection');
  if (groups === undefined || selection === undefined) throw new Error('services absents');
  return { ...harness, groups, selection };
}

/** Forme de l'arbre : `f(a,g(b)),c`. */
function shape(nodes: readonly LayerNode[]): string {
  return nodes.map((node) => (isFolder(node) ? `${node.id}(${shape(node.children)})` : node.id)).join(',');
}

function shapeOf(h: IHarness): string {
  return shape(h.editor.document.layers);
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function focusRow(h: IHarness, id: string): HTMLElement {
  const element = h.list.rowElement(id);
  if (element === undefined) throw new Error(`ligne ${id} absente`);
  element.focus();
  return element;
}

describe('createFolder', () => {
  it('inserts "Dossier 1" at the top and selects it when nothing is selected', () => {
    const h = setup();
    const id = h.groups.createFolder();
    expect(id).toBe('folder-1');
    expect(shapeOf(h)).toBe('folder-1(),f(a,g(b)),c');
    expect(h.selection.selected()).toEqual(['folder-1']);
    expect(h.list.row('folder-1')?.node.name).toBe('Dossier 1');
  });

  it('inserts above the first selected row, in its parent', () => {
    const h = setup();
    h.selection.select(['b', 'c']);
    h.groups.createFolder();
    expect(shapeOf(h)).toBe('f(a,g(folder-1(),b)),c');
    expect(h.selection.selected()).toEqual(['folder-1']);
  });

  it('numbers the next folders and undo / redo restore the tree', () => {
    const h = setup();
    h.groups.createFolder();
    const second = h.groups.createFolder();
    expect(second).toBe('folder-2');
    expect(h.list.row('folder-2')?.node.name).toBe('Dossier 2');
    h.editor.undo();
    expect(shapeOf(h)).toBe('folder-1(),f(a,g(b)),c');
    h.editor.undo();
    expect(h.editor.document.layers).toBe(tree.layers);
    h.editor.redo();
    expect(shapeOf(h)).toBe('folder-1(),f(a,g(b)),c');
  });
});

describe('groupSelection', () => {
  it('cannot group an empty selection', () => {
    const h = setup();
    expect(h.groups.canGroup()).toBe(false);
    expect(h.groups.groupSelection()).toBeUndefined();
    expect(h.editor.document).toBe(tree);
  });

  it('wraps the selection, selects the new expanded folder and undoes', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    expect(h.groups.canGroup()).toBe(true);
    const id = h.groups.groupSelection();
    expect(id).toBe('folder-1');
    expect(shapeOf(h)).toBe('f(folder-1(a,c),g(b))');
    expect(h.selection.selected()).toEqual(['folder-1']);
    expect(h.list.row('folder-1')?.node).not.toHaveProperty('collapsed');
    expect(h.list.row('a')).toBeDefined();
    h.editor.undo();
    expect(h.editor.document.layers).toBe(tree.layers);
    expect(h.selection.selected()).toEqual([]);
    h.editor.redo();
    expect(shapeOf(h)).toBe('f(folder-1(a,c),g(b))');
  });

  it('keeps top-most nodes only', () => {
    const h = setup();
    h.selection.select(['f', 'a', 'c']);
    h.groups.groupSelection();
    expect(shapeOf(h)).toBe('folder-1(f(a,g(b)),c)');
  });
});

describe('ungroup', () => {
  it('replaces the folder by its children, selects them and undoes', () => {
    const h = setup();
    expect(h.groups.ungroup('f')).toBe(true);
    expect(shapeOf(h)).toBe('a,g(b),c');
    expect(h.selection.selected()).toEqual(['a', 'g']);
    h.editor.undo();
    expect(h.editor.document.layers).toBe(tree.layers);
    h.editor.redo();
    expect(shapeOf(h)).toBe('a,g(b),c');
  });

  it('leaves the selection to pruning for an empty folder', () => {
    const h = setup(doc([folder('e', []), layer('c')]));
    h.selection.select(['c']);
    expect(h.groups.ungroup('e')).toBe(true);
    expect(shapeOf(h)).toBe('c');
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('returns false for a layer or an unknown id', () => {
    const h = setup();
    expect(h.groups.ungroup('c')).toBe(false);
    expect(h.groups.ungroup('nope')).toBe(false);
    expect(h.editor.document).toBe(tree);
  });
});

describe('locks, undo and redo', () => {
  it('groups a locked layer and ungroups a locked folder', () => {
    const h = setup(doc([layer('a', { locked: true }), folder('f', [layer('b')], { locked: true })]));
    h.selection.select(['a']);
    expect(h.groups.groupSelection()).toBe('folder-1');
    expect(shapeOf(h)).toBe('folder-1(a),f(b)');
    expect(h.groups.ungroup('f')).toBe(true);
    expect(shapeOf(h)).toBe('folder-1(a),b');
  });

  it('prunes the selection after undo without crashing', () => {
    const h = setup();
    const id = h.groups.createFolder();
    expect(h.selection.selected()).toEqual([id]);
    expect(h.editor.undo()).toBe(true);
    expect(h.selection.selected()).toEqual([]);
  });

  it('cannot redo after an unrelated change', () => {
    const h = setup();
    h.groups.createFolder();
    h.editor.undo();
    h.list.setCollapsed('f', true);
    expect(h.editor.redo()).toBe(false);
    expect(shapeOf(h)).toBe('f(a,g(b)),c');
  });
});

describe('default plugin set', () => {
  it('provides layers.groups after interaction.shortcuts', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = createEditor(host, { data: tree });
    expect(editor.getService('layers.groups')).toBeDefined();
    expect(editor.getService('interaction.shortcuts')?.lookup('Mod+G')?.id).toBe('layers.groups.group');
    editor.destroy();
  });
});

describe('without interaction.shortcuts', () => {
  it('boots with the layout and layers epics only and still groups', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = createEditor(host, { data: tree, defaultPlugins: [new LayoutPlugin(), new LayersPlugin()] });
    const groups = editor.getService('layers.groups');
    expect(groups).toBeDefined();
    expect(editor.getService('interaction.shortcuts')).toBeUndefined();
    expect(groups?.createFolder()).toBeDefined();
    editor.destroy();
  });
});

describe('keyboard', () => {
  it('Ctrl+G groups the selection when the list has focus', () => {
    const h = setup();
    h.selection.select(['c']);
    const row = focusRow(h, 'c');
    const event = press(row, 'g', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(shapeOf(h)).toBe('f(a,g(b)),folder-1(c)');
  });

  it('Ctrl+Shift+G ungroups the first selected folder', () => {
    const h = setup();
    h.selection.select(['g']);
    const row = focusRow(h, 'g');
    press(row, 'G', { ctrlKey: true, shiftKey: true });
    expect(shapeOf(h)).toBe('f(a,b),c');
  });

  it('does nothing without selection, without a folder, or outside the list', () => {
    const h = setup();
    const row = focusRow(h, 'c');
    expect(press(row, 'g', { ctrlKey: true }).defaultPrevented).toBe(false);
    h.selection.select(['c']);
    expect(press(row, 'G', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    (document.activeElement as HTMLElement | null)?.blur();
    press(h.host, 'g', { ctrlKey: true });
    expect(shapeOf(h)).toBe('f(a,g(b)),c');
  });

  it('registers the shortcuts and destroys cleanly', () => {
    const h = setup();
    const shortcuts = h.editor.getService('interaction.shortcuts');
    expect(shortcuts?.lookup('Mod+G')?.id).toBe('layers.groups.group');
    h.editor.destroy();
    expect(h.editor.isDestroyed).toBe(true);
  });
});
