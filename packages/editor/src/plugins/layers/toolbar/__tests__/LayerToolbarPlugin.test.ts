// packages/editor/src/plugins/layers/toolbar/__tests__/LayerToolbarPlugin.test.ts
/**
 * `layers.toolbar` dans un vrai éditeur : boutons, états, clics, service,
 * annulation, raccourcis, navigation aux flèches et nettoyage.
 */

import { isFolder } from '@werddomain/timeline-runtime';
import type { LayerNode } from '@werddomain/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import { LayoutPlugin } from '../../../layout/LayoutPlugin';
import { LayersPlugin } from '../../LayersPlugin';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';
import type { ILayerSelectionService } from '../../selection';
import type { IEditorContext } from '../../../../core/context/IEditorContext';
import { LayerToolbarPlugin } from '../LayerToolbarPlugin';
import type { ILayerToolbarService } from '../types';

afterEach(unmountAll);

interface IHarness extends IListHarness {
  readonly toolbar: ILayerToolbarService;
  readonly selection: ILayerSelectionService;
}

const tree = doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')]);

function setup(data = tree): IHarness {
  const harness = mount(data);
  const toolbar = harness.editor.getService('layers.toolbar');
  const selection = harness.editor.getService('layers.selection');
  if (toolbar === undefined || selection === undefined) throw new Error('services absents');
  return { ...harness, toolbar, selection };
}

function shape(nodes: readonly LayerNode[]): string {
  return nodes.map((node) => (isFolder(node) ? `${node.id}(${shape(node.children)})` : node.id)).join(',');
}

function shapeOf(h: IHarness): string {
  return shape(h.editor.document.layers);
}

function button(h: IHarness, label: string): HTMLButtonElement {
  const found = h.host.querySelector<HTMLButtonElement>(`.jt-layer-toolbar button[aria-label="${label}"]`);
  if (found === null) throw new Error(`bouton ${label} absent`);
  return found;
}

function unavailable(h: IHarness, label: string): boolean {
  return button(h, label).getAttribute('aria-disabled') === 'true';
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

describe('rendering', () => {
  it('renders four labelled buttons in a toolbar in the layers footer', () => {
    const h = setup();
    const bar = h.host.querySelector('.jt-layer-toolbar[role="toolbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Actions sur les calques');
    expect(bar?.closest('.jt-zone--layersFooter')).not.toBeNull();
    const buttons = Array.from(bar?.querySelectorAll('button') ?? []);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Nouveau calque',
      'Nouveau dossier',
      'Grouper la sélection',
      'Supprimer la sélection'
    ]);
    buttons.forEach((b) => {
      expect(b.type).toBe('button');
      expect(b.title).toBe(b.getAttribute('aria-label'));
    });
  });

  it('disables group and delete without selection and follows selection and document changes', () => {
    const h = setup();
    expect(unavailable(h, 'Nouveau calque')).toBe(false);
    expect(unavailable(h, 'Nouveau dossier')).toBe(false);
    expect(unavailable(h, 'Grouper la sélection')).toBe(true);
    expect(unavailable(h, 'Supprimer la sélection')).toBe(true);
    h.selection.select(['a']);
    expect(unavailable(h, 'Grouper la sélection')).toBe(false);
    expect(unavailable(h, 'Supprimer la sélection')).toBe(false);
    h.toolbar.deleteSelection();
    h.selection.clear();
    expect(unavailable(h, 'Supprimer la sélection')).toBe(true);
  });

  it('updates on document:loaded', () => {
    const h = setup();
    h.selection.select(['a']);
    h.editor.load(doc([layer('z')]));
    expect(unavailable(h, 'Supprimer la sélection')).toBe(true);
  });
});

describe('buttons', () => {
  it('"Nouveau calque" creates and selects a layer', () => {
    const h = setup();
    button(h, 'Nouveau calque').click();
    expect(shapeOf(h)).toBe('layer-1,f(a,g(b)),c');
    expect(h.selection.selected()).toEqual(['layer-1']);
    expect(h.list.row('layer-1')?.node.name).toBe('Calque 1');
  });

  it('"Nouveau dossier" creates a folder', () => {
    const h = setup();
    button(h, 'Nouveau dossier').click();
    expect(shapeOf(h)).toBe('folder-1(),f(a,g(b)),c');
  });

  it('"Grouper la sélection" groups the selection', () => {
    const h = setup();
    h.selection.select(['a', 'c']);
    button(h, 'Grouper la sélection').click();
    expect(shapeOf(h)).toBe('f(folder-1(a,c),g(b))');
  });

  it('"Supprimer la sélection" deletes the selection', () => {
    const h = setup();
    h.selection.select(['g']);
    button(h, 'Supprimer la sélection').click();
    expect(shapeOf(h)).toBe('f(a),c');
  });

  it('preserves document and history when layer deletion is vetoed', () => {
    let context: IEditorContext | undefined;
    const h = mount(tree, [{ id: 'test.guard', dependencies: [], init: (ctx) => { context = ctx; }, destroy: () => undefined }]);
    const toolbar = h.editor.getService('layers.toolbar');
    const selection = h.editor.getService('layers.selection');
    if (!context || !toolbar || !selection) throw new Error('services absents');
    expect(toolbar.newLayer()).toBeDefined();
    expect(h.editor.undo()).toBe(true);
    selection.select(['g']);
    const before = h.editor.toJSON();
    const history = [context.commands.canUndo, context.commands.canRedo, context.commands.undoLabel, context.commands.redoLabel];
    const seen: string[] = [];
    const refused: string[] = [];
    context.events.on('command:refused', (event) => refused.push(event.reason));
    context.events.onCancellable('command:before', (event) => {
      seen.push(event.payload.command.label);
      event.cancel();
    });

    expect(toolbar.deleteSelection()).toBe(false);
    expect(seen).toEqual(['Supprimer les calques']);
    expect(refused).toEqual(['cancelled']);
    expect(h.editor.toJSON()).toEqual(before);
    expect([context.commands.canUndo, context.commands.canRedo, context.commands.undoLabel, context.commands.redoLabel]).toEqual(history);
  });

  it('moves focus with arrow keys over all buttons, even unavailable (roving tabindex)', () => {
    const h = setup();
    const first = button(h, 'Nouveau calque');
    const second = button(h, 'Nouveau dossier');
    expect(first.tabIndex).toBe(0);
    expect(second.tabIndex).toBe(-1);
    first.focus();
    press(first, 'ArrowRight');
    expect(document.activeElement).toBe(second);
    expect(second.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
    const last = button(h, 'Supprimer la sélection');
    press(second, 'End');
    expect(document.activeElement).toBe(last);
    press(last, 'ArrowRight');
    expect(document.activeElement).toBe(first);
    press(first, 'ArrowLeft');
    expect(document.activeElement).toBe(last);
    press(last, 'Home');
    expect(document.activeElement).toBe(first);
    expect(press(first, 'x').defaultPrevented).toBe(false);
    press(first, 'End');
    expect(document.activeElement).toBe(button(h, 'Supprimer la sélection'));
  });
});

describe('unavailable buttons', () => {
  it('use aria-disabled, stay focusable and ignore clicks', () => {
    const h = setup();
    const remove = button(h, 'Supprimer la sélection');
    expect(remove.hasAttribute('disabled')).toBe(false);
    remove.click();
    expect(h.editor.document.layers).toBe(tree.layers);
    button(h, 'Grouper la sélection').click();
    expect(h.editor.document.layers).toBe(tree.layers);
  });

  it('keeps the focus on the Delete button when deleting the last layer', () => {
    const h = setup(doc([layer('only')]));
    h.selection.select(['only']);
    const remove = button(h, 'Supprimer la sélection');
    remove.focus();
    remove.click();
    expect(h.editor.document.layers).toHaveLength(0);
    expect(unavailable(h, 'Supprimer la sélection')).toBe(true);
    expect(document.activeElement).toBe(remove);
  });
});

describe('newLayer', () => {
  it('inserts above a collapsed ancestor folder so the layer stays visible', () => {
    const h = setup(doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c')]));
    h.selection.select(['b']);
    h.list.setCollapsed('f', true);
    const id = h.toolbar.newLayer();
    expect(id).toBe('layer-1');
    expect(shapeOf(h)).toBe('layer-1,f(a,g(b)),c');
    expect(h.list.row('layer-1')).toBeDefined();
  });

  it('inserts above the first selected row, in its parent, and numbers the next ones', () => {
    const h = setup();
    h.selection.select(['b', 'c']);
    expect(h.toolbar.newLayer()).toBe('layer-1');
    expect(shapeOf(h)).toBe('f(a,g(layer-1,b)),c');
    expect(h.selection.selected()).toEqual(['layer-1']);
    expect(h.toolbar.newLayer()).toBe('layer-2');
    expect(h.list.row('layer-2')?.node.name).toBe('Calque 2');
  });

  it('is undoable and redoable with the label "Nouveau calque"', () => {
    const h = setup();
    h.toolbar.newLayer();
    h.editor.undo();
    expect(h.editor.document.layers).toBe(tree.layers);
    h.editor.redo();
    expect(shapeOf(h)).toBe('layer-1,f(a,g(b)),c');
  });
});

describe('deleteSelection', () => {
  it('returns false when nothing is selected', () => {
    const h = setup();
    expect(h.toolbar.deleteSelection()).toBe(false);
    expect(h.editor.document.layers).toBe(tree.layers);
  });

  it('removes top-most nodes and selects the row that took the first place', () => {
    const h = setup();
    h.selection.select(['a', 'g', 'b']);
    expect(h.toolbar.deleteSelection()).toBe(true);
    expect(shapeOf(h)).toBe('f(),c');
    expect(h.selection.selected()).toEqual(['c']);
  });

  it('selects the last row when the deleted rows were at the end', () => {
    const h = setup();
    h.selection.select(['c']);
    h.toolbar.deleteSelection();
    expect(h.selection.selected()).toEqual(['b']);
  });

  it('clears the selection when the tree becomes empty', () => {
    const h = setup(doc([layer('only')]));
    h.selection.select(['only']);
    h.toolbar.deleteSelection();
    expect(h.selection.selected()).toEqual([]);
  });

  it('deletes locked layers; undo restores the exact tree', () => {
    const data = doc([layer('a', { locked: true }), layer('b')]);
    const h = setup(data);
    h.selection.select(['a']);
    h.toolbar.deleteSelection();
    expect(shapeOf(h)).toBe('b');
    h.editor.undo();
    expect(h.editor.document.layers).toBe(data.layers);
    h.editor.redo();
    expect(shapeOf(h)).toBe('b');
  });
});

describe('keyboard focus', () => {
  it('moves DOM focus to the row that took the place after Delete (rows A to E)', () => {
    const h = setup(doc([layer('a'), layer('b'), layer('c'), layer('d'), layer('e')]));
    h.selection.select(['b', 'd']);
    const row = focusRow(h, 'd');
    press(row, 'Delete');
    expect(h.selection.selected()).toEqual(['c']);
    expect(document.activeElement).toBe(h.list.rowElement('c'));
    press(document.activeElement as Element, 'ArrowDown');
    expect(h.selection.selected()).toEqual(['e']);
  });

  it('moves DOM focus to the new layer row after Ctrl+Alt+L', () => {
    const h = setup();
    h.selection.select(['c']);
    press(focusRow(h, 'c'), 'l', { ctrlKey: true, altKey: true });
    expect(document.activeElement).toBe(h.list.rowElement('layer-1'));
  });

  it('moves focus to the first toolbar button when Delete removes every row', () => {
    const h = setup(doc([layer('only')]));
    h.selection.select(['only']);
    press(focusRow(h, 'only'), 'Delete');
    expect(h.editor.document.layers).toHaveLength(0);
    expect(document.activeElement).toBe(button(h, 'Nouveau calque'));
  });

  it('keeps focus on a toolbar button after clicking it', () => {
    const h = setup();
    const create = button(h, 'Nouveau dossier');
    create.focus();
    create.click();
    expect(document.activeElement).toBe(create);
  });

  it('does not steal focus when the list had none', () => {
    const h = setup();
    h.selection.select(['c']);
    (document.activeElement as HTMLElement | null)?.blur();
    h.toolbar.newLayer();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('shortcuts', () => {
  it('registers Mod+Alt+L, Delete and Backspace', () => {
    const h = setup();
    const shortcuts = h.editor.getService('interaction.shortcuts');
    expect(shortcuts?.lookup('Mod+Alt+L')?.id).toBe('layers.toolbar.newLayer');
    expect(shortcuts?.lookup('Delete')?.id).toBe('layers.toolbar.delete');
    expect(shortcuts?.lookup('Backspace')?.id).toBe('layers.toolbar.delete');
  });

  it('Delete and Backspace delete the selection when the list has focus', () => {
    const h = setup();
    h.selection.select(['c']);
    const row = focusRow(h, 'c');
    expect(press(row, 'Delete').defaultPrevented).toBe(true);
    expect(shapeOf(h)).toBe('f(a,g(b))');
    h.selection.select(['a']);
    press(focusRow(h, 'a'), 'Backspace');
    expect(shapeOf(h)).toBe('f(g(b))');
  });

  it('leaves Delete alone with an empty selection, outside the list and in inputs', () => {
    const h = setup();
    expect(press(focusRow(h, 'c'), 'Delete').defaultPrevented).toBe(false);
    h.selection.select(['c']);
    expect(press(h.host, 'Delete').defaultPrevented).toBe(false);
    const input = document.createElement('input');
    h.list.rowElement('c')?.append(input);
    input.focus();
    expect(press(input, 'Backspace').defaultPrevented).toBe(false);
    expect(shapeOf(h)).toBe('f(a,g(b)),c');
  });

  it('Ctrl+Alt+L creates a layer only from the list', () => {
    const h = setup();
    expect(press(h.host, 'l', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false);
    expect(shapeOf(h)).toBe('f(a,g(b)),c');
    h.selection.select(['c']);
    press(focusRow(h, 'c'), 'l', { ctrlKey: true, altKey: true });
    expect(shapeOf(h)).toBe('f(a,g(b)),layer-1,c');
  });
});

describe('without interaction.shortcuts', () => {
  it('boots with the layout and layers epics only and the service works', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = createEditor(host, { data: tree, defaultPlugins: [new LayoutPlugin(), new LayersPlugin()] });
    const toolbar = editor.getService('layers.toolbar');
    expect(editor.getService('interaction.shortcuts')).toBeUndefined();
    expect(toolbar?.newLayer()).toBe('layer-1');
    expect(host.querySelector('.jt-layer-toolbar')).not.toBeNull();
    expect(toolbar?.deleteSelection()).toBe(true);
    editor.destroy();
  });
});

describe('lifecycle', () => {
  it('leaves nothing behind when a shortcut registration throws', () => {
    const cleaned: string[] = [];
    const cleanup = (name: string) => (): void => {
      cleaned.push(name);
    };
    let registered = 0;
    let ready: () => void = () => undefined;
    const ctx = {
      services: {
        require: (id: string): unknown =>
          id === 'interaction.shortcuts'
            ? {
                register: () => {
                  registered += 1;
                  if (registered === 2) throw new Error('conflit');
                  return cleanup('shortcut');
                }
              }
            : {},
        get: (id: string): unknown =>
          id === 'interaction.shortcuts'
            ? {
                register: () => {
                  registered += 1;
                  if (registered === 2) throw new Error('conflit');
                  return cleanup('shortcut');
                }
              }
            : undefined,
        provide: () => cleanup('service')
      },
      events: {
        on: () => cleanup('event'),
        once: (_name: string, handler: () => void) => {
          ready = handler;
          return cleanup('ready');
        }
      }
    } as unknown as IEditorContext;
    const plugin = new LayerToolbarPlugin();
    plugin.init(ctx);
    expect(() => ready()).toThrow('conflit');
    plugin.destroy();
    expect(cleaned).toEqual(['service', 'event', 'event', 'event', 'ready', 'shortcut']);
  });

  it('removes the toolbar and the shortcuts on destroy', () => {
    const h = setup();
    const shortcuts = h.editor.getService('interaction.shortcuts');
    h.editor.destroy();
    expect(h.host.querySelector('.jt-layer-toolbar')).toBeNull();
    expect(shortcuts?.lookup('Mod+Alt+L')).toBeUndefined();
  });
});
