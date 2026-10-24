// packages/editor/src/plugins/layers/list/__tests__/LayerListPlugin.test.ts
/**
 * `layers.list` dans un vrai éditeur : rendu de l'arbre (ordre, retrait,
 * attributs accessibles, nom, icône, couleur), en-tête, liste vide, repli
 * annulable d'un dossier, mises à jour sur place, `layers:rowsChanged`,
 * API des contrôles de ligne et nettoyage.
 */

import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createSetCollapsedCommand, updateLayerNode } from '../layerTree';
import { createCommand } from '../../../../core/commands/createCommand';
import { LAYER_LIST_TEXTS } from '../LayerListPlugin';
import { LAYER_ROW_CLASSES, TOGGLE_LABELS } from '../LayerRowView';
import type { ILayerRow, ILayerRowControl, LayerRowsChangedEvent } from '../types';
import { doc, domRowIds, folder, layer, mount, unmountAll } from './fixtures';

afterEach(unmountAll);

/** Plugin qui consigne les `layers:rowsChanged` (un plugin écoute les autres). */
function rowsRecorder(events: LayerRowsChangedEvent[]): EditorPlugin {
  return {
    id: 'test.rowsRecorder',
    dependencies: ['layers.list'],
    init: (ctx: IEditorContext) => {
      ctx.events.on('layers:rowsChanged', (event) => events.push(event));
    },
    destroy: () => undefined
  };
}

const tree = doc([
  folder('f', [layer('a', { color: '#ff0000', icon: 'audio' }), folder('g', [layer('b')])]),
  layer('c', { visible: false, locked: true })
]);

function rowElement(host: HTMLElement, id: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  if (element === null) throw new Error(`ligne ${id} absente`);
  return element;
}

function toggleOf(host: HTMLElement, id: string): HTMLButtonElement {
  const button = rowElement(host, id).querySelector('button[data-action="toggle"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error(`pas de bouton de repli sur ${id}`);
  return button;
}

describe('layers.list rendering', () => {
  it('renders one tree item per visible node, in display order, inside the layers zone', () => {
    const { host } = mount(tree);
    const zone = host.querySelector('.jt-zone--layers');
    expect(zone?.querySelector('[role="tree"]')?.getAttribute('aria-label')).toBe(LAYER_LIST_TEXTS.label);
    expect(domRowIds(host)).toEqual(['f', 'a', 'g', 'b', 'c']);
    const b = rowElement(host, 'b');
    expect(b.getAttribute('role')).toBe('treeitem');
    expect(b.getAttribute('aria-level')).toBe('3');
    expect(b.style.paddingLeft).toBe('32px');
    expect(b.style.height).toBe('30px');
  });

  it('shows name, icon and color, and marks folders, hidden and locked rows', () => {
    const { host } = mount(tree);
    const a = rowElement(host, 'a');
    expect(a.querySelector(`.${LAYER_ROW_CLASSES.name}`)?.textContent).toBe('a');
    expect(a.querySelector('.jt-layer-icon--audio')).not.toBeNull();
    expect(a.style.getPropertyValue('--jt-layer-color')).toBe('#ff0000');
    expect(rowElement(host, 'f').classList.contains(LAYER_ROW_CLASSES.folder)).toBe(true);
    expect(rowElement(host, 'f').getAttribute('aria-expanded')).toBe('true');
    expect(a.hasAttribute('aria-expanded')).toBe(false);
    const c = rowElement(host, 'c');
    expect(c.classList.contains(LAYER_ROW_CLASSES.hidden)).toBe(true);
    expect(c.classList.contains(LAYER_ROW_CLASSES.locked)).toBe(true);
  });

  it('renders the header title in the layersHeader zone', () => {
    const { host } = mount(tree);
    expect(host.querySelector('.jt-zone--layersHeader .jt-layers-header__title')?.textContent).toBe('Calques');
  });

  it('shows the empty message only without rows', () => {
    const { host, editor } = mount(doc([]));
    const empty = host.querySelector<HTMLElement>('.jt-layer-list__empty');
    expect(empty?.hidden).toBe(false);
    expect(empty?.textContent).toBe(LAYER_LIST_TEXTS.empty);
    editor.load(doc([layer('x')]));
    expect(empty?.hidden).toBe(true);
    expect(domRowIds(host)).toEqual(['x']);
  });

  it('leaves out the children of a folder collapsed in the document', () => {
    const { host } = mount(doc([folder('f', [layer('a')], { collapsed: true }), layer('b')]));
    expect(domRowIds(host)).toEqual(['f', 'b']);
    expect(rowElement(host, 'f').getAttribute('aria-expanded')).toBe('false');
    expect(toggleOf(host, 'f').getAttribute('aria-label')).toBe(TOGGLE_LABELS.expand);
  });
});

describe('layers.list folder collapse', () => {
  it('collapses on toggle click with an undoable command', () => {
    const { host, editor } = mount(tree);
    toggleOf(host, 'f').click();
    expect(domRowIds(host)).toEqual(['f', 'c']);
    expect(editor.canUndo).toBe(true);
    editor.undo();
    expect(domRowIds(host)).toEqual(['f', 'a', 'g', 'b', 'c']);
    editor.redo();
    expect(domRowIds(host)).toEqual(['f', 'c']);
  });

  it('collapses a nested folder only', () => {
    const { host } = mount(tree);
    toggleOf(host, 'g').click();
    expect(domRowIds(host)).toEqual(['f', 'a', 'g', 'c']);
    expect(toggleOf(host, 'g').getAttribute('aria-label')).toBe(TOGGLE_LABELS.expand);
  });

  it('exposes setCollapsed and toggleCollapsed on the service', () => {
    const { host, list } = mount(tree);
    expect(list.setCollapsed('f', true)).toBe(true);
    expect(list.setCollapsed('f', true)).toBe(false);
    expect(domRowIds(host)).toEqual(['f', 'c']);
    expect(list.toggleCollapsed('f')).toBe(true);
    expect(domRowIds(host)).toEqual(['f', 'a', 'g', 'b', 'c']);
    expect(() => list.toggleCollapsed('a')).toThrow('introuvable');
  });

  it('keeps the same element for rows that stay visible', () => {
    const { host, list } = mount(tree);
    const before = rowElement(host, 'c');
    list.setCollapsed('f', true);
    expect(rowElement(host, 'c')).toBe(before);
  });
});

describe('layers.list rowsChanged and in-place updates', () => {
  it('announces the first rows, then layout changes only', () => {
    const events: LayerRowsChangedEvent[] = [];
    const { editor, list, host } = mount(tree, [rowsRecorder(events)]);
    expect(events).toHaveLength(1);
    expect(events[0]?.previous).toEqual([]);
    expect(events[0]?.rows.map((row) => row.id)).toEqual(['f', 'a', 'g', 'b', 'c']);

    const marked = rowElement(host, 'a');
    marked.classList.add('external-class');
    editor.execute(
      createCommand(
        'Renommer',
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'Héros', color: '#00ff00' })),
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'a', color: '#ff0000' }))
      )
    );
    expect(events).toHaveLength(1);
    const renamed = rowElement(host, 'a');
    expect(renamed).toBe(marked);
    expect(renamed.classList.contains('external-class')).toBe(true);
    expect(renamed.querySelector(`.${LAYER_ROW_CLASSES.name}`)?.textContent).toBe('Héros');
    expect(renamed.style.getPropertyValue('--jt-layer-color')).toBe('#00ff00');
    expect(list.row('a')?.node.name).toBe('Héros');

    list.setCollapsed('g', true);
    expect(events).toHaveLength(2);
    expect(events[1]?.rows.map((row) => row.id)).toEqual(['f', 'a', 'g', 'c']);
    expect(events[1]?.previous.map((row) => row.id)).toEqual(['f', 'a', 'g', 'b', 'c']);
  });

  it('reorders the DOM when the document order changes', () => {
    const { host, editor } = mount(doc([layer('a'), layer('b'), layer('c')]));
    const a = rowElement(host, 'a');
    editor.load(doc([layer('c'), layer('a'), layer('b')]));
    expect(domRowIds(host)).toEqual(['c', 'a', 'b']);
    expect(rowElement(host, 'a')).toBe(a);
  });

  it('switches the toggle when a layer id becomes a folder', () => {
    const { host, editor } = mount(doc([layer('x')]));
    editor.load(doc([folder('x', [layer('y')])]));
    expect(toggleOf(host, 'x')).toBeInstanceOf(HTMLButtonElement);
    expect(rowElement(host, 'x').classList.contains(LAYER_ROW_CLASSES.layer)).toBe(false);
  });
});

describe('layers.list service lookups', () => {
  it('finds rows, row elements and the row under an event target', () => {
    const { host, list } = mount(tree);
    expect(list.rows().map((row) => row.id)).toEqual(['f', 'a', 'g', 'b', 'c']);
    expect(list.row('b')?.parentId).toBe('g');
    expect(list.row('missing')).toBeUndefined();
    const a = rowElement(host, 'a');
    expect(list.rowElement('a')).toBe(a);
    expect(list.rowIdAt(a.querySelector(`.${LAYER_ROW_CLASSES.name}`))).toBe('a');
    expect(list.rowIdAt(host)).toBeUndefined();
    expect(list.rowIdAt(null)).toBeUndefined();
    expect(list.element()?.getAttribute('role')).toBe('tree');
  });

  it('returns the same rows array while the document does not change', () => {
    const { list } = mount(tree);
    expect(list.rows()).toBe(list.rows());
  });
});

describe('layers.list row controls', () => {
  function recordingControl(id: string, order: number, withUpdate: boolean): {
    control: ILayerRowControl;
    renders: string[];
    updates: string[];
    disposed: string[];
  } {
    const renders: string[] = [];
    const updates: string[] = [];
    const disposed: string[] = [];
    const control: ILayerRowControl = {
      id,
      order,
      render: (row: ILayerRow, element) => {
        renders.push(row.id);
        element.textContent = `${id}:${row.node.name}`;
      },
      ...(withUpdate
        ? {
            update: (row: ILayerRow, element: HTMLElement) => {
              updates.push(row.id);
              element.textContent = `${id}:${row.node.name}`;
            }
          }
        : {}),
      dispose: (row: ILayerRow) => void disposed.push(row.id),
      renderHeader: (element) => {
        element.textContent = id;
      }
    };
    return { control, renders, updates, disposed };
  }

  function controlIds(row: HTMLElement): string[] {
    // Seuls les contrôles de test : les plugins de calques (visibilité, verrou) ajoutent les leurs.
    return Array.from(row.querySelectorAll<HTMLElement>(`.${LAYER_ROW_CLASSES.control}`))
      .map((cell) => cell.dataset.controlId ?? '')
      .filter((id) => id.startsWith('test.'));
  }

  it('renders controls on every row, ordered by order, with header cells', () => {
    const { host, list } = mount(tree);
    const lock = recordingControl('test.lock', 20, true);
    const eye = recordingControl('test.eye', 10, true);
    list.addRowControl(lock.control);
    list.addRowControl(eye.control);
    expect(controlIds(rowElement(host, 'a'))).toEqual(['test.eye', 'test.lock']);
    expect(eye.renders).toEqual(['f', 'a', 'g', 'b', 'c']);
    const headerCells = Array.from(host.querySelectorAll<HTMLElement>('.jt-layers-header__control[data-control-id^="test."]'));
    expect(headerCells.map((cell) => cell.textContent)).toEqual(['test.eye', 'test.lock']);
  });

  it('renders controls on rows that appear later', () => {
    const { host, list } = mount(doc([folder('f', [layer('a')], { collapsed: true })]));
    const eye = recordingControl('test.eye', 10, true);
    list.addRowControl(eye.control);
    list.setCollapsed('f', false);
    expect(eye.renders).toEqual(['f', 'a']);
    expect(rowElement(host, 'a').querySelector('[data-control-id="test.eye"]')?.textContent).toBe('test.eye:a');
  });

  it('calls update when present, otherwise re-renders the cell', () => {
    const { host, list, editor } = mount(doc([layer('a')]));
    const withUpdate = recordingControl('test.updated', 1, true);
    const withoutUpdate = recordingControl('test.rerendered', 2, false);
    list.addRowControl(withUpdate.control);
    list.addRowControl(withoutUpdate.control);
    editor.execute(
      createCommand(
        'Renommer',
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'A' })),
        (current) => updateLayerNode(current, 'a', (node) => ({ ...node, name: 'a' }))
      )
    );
    expect(withUpdate.updates).toEqual(['a']);
    expect(withUpdate.renders).toEqual(['a']);
    expect(withoutUpdate.renders).toEqual(['a', 'a']);
    expect(rowElement(host, 'a').querySelector('[data-control-id="test.rerendered"]')?.textContent).toBe(
      'test.rerendered:A'
    );
  });

  it('disposes and removes a control from rows and header', () => {
    const { host, list } = mount(doc([layer('a'), layer('b')]));
    const eye = recordingControl('test.eye', 10, true);
    const remove = list.addRowControl(eye.control);
    remove();
    remove();
    expect(eye.disposed).toEqual(['a', 'b']);
    expect(host.querySelector('[data-control-id="test.eye"]')).toBeNull();
    expect(() => list.addRowControl(eye.control)).not.toThrow();
  });

  it('disposes the control cells of rows that disappear', () => {
    const { list } = mount(doc([folder('f', [layer('a')])]));
    const eye = recordingControl('test.eye', 10, true);
    list.addRowControl(eye.control);
    list.setCollapsed('f', true);
    expect(eye.disposed).toEqual(['a']);
  });

  it('refuses a duplicate or invalid control id', () => {
    const { list } = mount(doc([layer('a')]));
    list.addRowControl(recordingControl('test.eye', 1, true).control);
    expect(() => list.addRowControl(recordingControl('test.eye', 2, true).control)).toThrow('déjà');
    expect(() => list.addRowControl(recordingControl('Bad Id', 2, true).control)).toThrow('invalide');
  });

  it('lets a dependent plugin add its control during init', () => {
    const renders: string[] = [];
    const plugin: EditorPlugin = {
      id: 'test.control',
      dependencies: ['layers.list'],
      init: (ctx: IEditorContext) => {
        ctx.services.require('layers.list').addRowControl({
          id: 'test.control',
          order: 0,
          render: (row) => void renders.push(row.id)
        });
      },
      destroy: () => undefined
    };
    const { host } = mount(doc([layer('a')]), [plugin]);
    expect(renders).toEqual(['a']);
    expect(host.querySelector('.jt-layers-header__control[data-control-id="test.control"]')).not.toBeNull();
  });
});

describe('layers.list robustness', () => {
  function rename(id: string, name: string) {
    return createCommand(
      'Renommer',
      (current) => updateLayerNode(current, id, (node) => ({ ...node, name })),
      (current) => updateLayerNode(current, id, (node) => ({ ...node, name: id }))
    );
  }

  it('keeps the row icon class when the icon changes', () => {
    const { host, editor } = mount(doc([layer('a', { icon: 'fa fa-star' })]));
    editor.load(doc([layer('a', { icon: 'audio' })]));
    const icon = rowElement(host, 'a').querySelector(`.${LAYER_ROW_CLASSES.icon}`);
    expect(icon?.classList.contains('jt-layer-icon--audio')).toBe(true);
    expect(icon?.classList.contains('fa')).toBe(false);
  });

  it('does not touch the controls of rows that did not change', () => {
    const { list, editor } = mount(doc([layer('a'), layer('b')]));
    const renders: string[] = [];
    list.addRowControl({ id: 'test.plain', order: 0, render: (row) => void renders.push(row.id) });
    renders.length = 0;
    editor.execute(rename('b', 'B'));
    expect(renders).toEqual(['b']);
  });

  it('leaves a name being edited alone and exposes the name element', () => {
    const { host, list, editor } = mount(doc([layer('a')]));
    const name = list.nameElement('a');
    expect(name).toBe(rowElement(host, 'a').querySelector(`.${LAYER_ROW_CLASSES.name}`));
    name?.setAttribute('data-editing', '');
    if (name !== undefined) name.textContent = 'en cours';
    editor.execute(rename('a', 'A'));
    expect(name?.textContent).toBe('en cours');
    name?.removeAttribute('data-editing');
    editor.undo();
    expect(name?.textContent).toBe('a');
    expect(list.nameElement('missing')).toBeUndefined();
  });

  it('keeps updating the list when a control update throws, then reports the error', () => {
    const events: LayerRowsChangedEvent[] = [];
    const { host, list, editor } = mount(doc([layer('a'), folder('f', [layer('b')])]), [rowsRecorder(events)]);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const updates: string[] = [];
    list.addRowControl({
      id: 'test.broken',
      order: 0,
      render: () => undefined,
      update: () => {
        throw new Error('contrôle en panne');
      }
    });
    list.addRowControl({ id: 'test.healthy', order: 1, render: () => undefined, update: (row) => void updates.push(row.id) });
    editor.execute(rename('a', 'A'));
    list.setCollapsed('f', true);
    expect(updates).toEqual(['a', 'f']);
    expect(rowElement(host, 'a').querySelector(`.${LAYER_ROW_CLASSES.name}`)?.textContent).toBe('A');
    expect(domRowIds(host)).toEqual(['a', 'f']);
    expect(events).toHaveLength(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('rolls back a control whose render throws', () => {
    const { host, list } = mount(doc([layer('a'), layer('b')]));
    let calls = 0;
    const broken: ILayerRowControl = {
      id: 'test.broken',
      order: 0,
      render: () => {
        calls += 1;
        if (calls === 2) throw new Error('rendu en panne');
      }
    };
    expect(() => list.addRowControl(broken)).toThrow('rendu en panne');
    expect(host.querySelector('[data-control-id="test.broken"]')).toBeNull();
    expect(() => list.addRowControl({ id: 'test.broken', order: 0, render: () => undefined })).not.toThrow();
  });

  it('disposes header cells on removal and on destroy', () => {
    const { list, editor } = mount(doc([layer('a')]));
    const disposed: string[] = [];
    const remove = list.addRowControl({
      id: 'test.one',
      order: 0,
      render: () => undefined,
      disposeHeader: () => void disposed.push('one')
    });
    list.addRowControl({ id: 'test.two', order: 1, render: () => undefined, disposeHeader: () => void disposed.push('two') });
    remove();
    editor.destroy();
    expect(disposed).toEqual(['one', 'two']);
  });
});

describe('layers.list cleanup', () => {
  it('removes its DOM and service on destroy', () => {
    const { host, editor } = mount(tree);
    editor.destroy();
    expect(host.querySelector('.jt-layer-row')).toBeNull();
    expect(host.querySelector('.jt-layers-header')).toBeNull();
  });

  it('still accepts collapse commands created outside the list', () => {
    const { host, editor } = mount(tree);
    editor.execute(createSetCollapsedCommand(editor.document, 'f', true));
    expect(domRowIds(host)).toEqual(['f', 'c']);
  });
});
