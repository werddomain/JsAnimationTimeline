// packages/editor/src/plugins/layers/reorder/__tests__/LayerReorderPlugin.test.ts
/**
 * `layers.reorder` dans un vrai éditeur : service, commande annulable,
 * glisser-déposer aux événements pointeur (seuil, repère, Échap, clic
 * supprimé, nettoyage) et clavier. jsdom n'a pas de mise en page : les
 * rectangles des lignes sont simulés (30 px par ligne, d'après leur index).
 */

import { isFolder } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { ROW_HEIGHT } from '../../../../model/rows';
import { doc, domRowIds, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';
import { DRAG_THRESHOLD } from '../dragController';
import { REORDER_CLASSES } from '../dropIndicator';
import { LIVE_REGION_CLASS } from '../LayerReorderPlugin';
import type { ILayerSelectionService } from '../../selection';
import type { ILayerReorderService } from '../types';

afterEach(() => {
  jest.useRealTimers();
  unmountAll();
});

function show(nodes: readonly LayerNode[]): string {
  return nodes.map((node) => (isFolder(node) ? `${node.id}(${show(node.children)})` : node.id)).join(',');
}

/** f(a, g(b)), c, d : lignes f, a, g, b, c, d (index 0 à 5). */
const tree = doc([folder('f', [layer('a'), folder('g', [layer('b')])]), layer('c'), layer('d')]);

interface IHarness extends IListHarness {
  readonly reorder: ILayerReorderService;
  readonly undoLabel: () => string | undefined;
  readonly selection: ILayerSelectionService;
}

/** Plugin de test qui garde le contexte pour lire le libellé de la dernière entrée d'historique. */
function recorder(holder: { ctx?: IEditorContext }): EditorPlugin {
  return {
    id: 'test.reorderRecorder',
    dependencies: ['layers.reorder'],
    init: (ctx: IEditorContext) => {
      holder.ctx = ctx;
    },
    destroy: () => undefined
  };
}

/** Place chaque ligne à `index * ROW_HEIGHT` (relu à chaque appel : l'ordre change après un déplacement). */
function layoutRows(h: IListHarness): void {
  h.list.rows().forEach((row) => {
    const element = h.list.rowElement(row.id);
    if (element === undefined) return;
    element.getBoundingClientRect = () => {
      const top = (h.list.row(row.id)?.index ?? 0) * ROW_HEIGHT;
      return { x: 0, y: top, left: 0, top, right: 200, bottom: top + ROW_HEIGHT, width: 200, height: ROW_HEIGHT, toJSON: () => ({}) };
    };
  });
}

function setup(data: ITimelineDocument = tree): IHarness {
  const holder: { ctx?: IEditorContext } = {};
  const harness = mount(data, [recorder(holder)]);
  const reorder = harness.editor.getService('layers.reorder');
  const selection = harness.editor.getService('layers.selection');
  if (reorder === undefined || selection === undefined) throw new Error('services absents');
  layoutRows(harness);
  return { ...harness, reorder, selection, undoLabel: () => holder.ctx?.commands.undoLabel };
}

function row(h: IHarness, id: string): HTMLElement {
  const element = h.list.rowElement(id);
  if (element === undefined) throw new Error(`ligne ${id} absente`);
  return element;
}

/** Ordonnée du pointeur : `ratio` de la hauteur de la ligne d'index `rowIndex`. */
function y(rowIndex: number, ratio = 0.5): number {
  return rowIndex * ROW_HEIGHT + ratio * ROW_HEIGHT;
}

interface IPointerInit extends MouseEventInit {
  pointerId?: number;
  isPrimary?: boolean;
  pointerType?: string;
}

/** Événement pointeur : jsdom n'a pas `PointerEvent`, on ajoute `pointerId` et `isPrimary` à un événement souris. */
function pointer(type: string, clientY: number, init: IPointerInit = {}): PointerEvent {
  const { pointerId = 1, isPrimary = true, pointerType = 'mouse', ...mouse } = init;
  // Bouton principal enfoncé (buttons = 1), sauf au relâchement ou à l'annulation.
  const buttons = type === 'pointerup' || type === 'pointercancel' ? 0 : 1;
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY, button: 0, buttons, ...mouse });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: isPrimary },
    pointerType: { value: pointerType }
  });
  return event as PointerEvent;
}

function press(h: IHarness, id: string, clientY: number, init: IPointerInit = {}): void {
  row(h, id).dispatchEvent(pointer('pointerdown', clientY, init));
}

function moveTo(clientY: number): void {
  document.dispatchEvent(pointer('pointermove', clientY));
}

function release(clientY: number): void {
  document.dispatchEvent(pointer('pointerup', clientY));
}

/** Glisse la ligne `id` (pressée en son milieu) jusqu'à `toY` puis relâche. */
function dragRow(h: IHarness, id: string, toY: number): void {
  const index = h.list.row(id)?.index ?? 0;
  press(h, id, y(index));
  moveTo(toY);
  release(toY);
}

/** `lostpointercapture` lancé depuis `target` (il remonte jusqu'à la liste, comme dans un navigateur). */
function lostCapture(target: EventTarget | undefined, pointerId = 1): void {
  const event = new Event('lostpointercapture', { bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target?.dispatchEvent(event);
}

function dropLine(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.${REORDER_CLASSES.dropLine}`);
}

function draggingIds(h: IHarness): string[] {
  return h.list
    .rows()
    .filter((r) => row(h, r.id).classList.contains(REORDER_CLASSES.dragging))
    .map((r) => r.id);
}

function click(target: HTMLElement, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('layers.reorder service', () => {
  it('moves nodes as one undoable command labelled « Déplacer les calques »', () => {
    // Arrange
    const h = setup();

    // Act
    const changed = h.reorder.move(['c'], { parentId: 'f', index: 0 });

    // Assert
    expect(changed).toBe(true);
    expect(show(h.editor.document.layers)).toBe('f(c,a,g(b)),d');
    expect(h.undoLabel()).toBe('Déplacer les calques');
    expect(domRowIds(h.host)).toEqual(['f', 'c', 'a', 'g', 'b', 'd']);
  });

  it('undo restores the exact previous tree and redo applies it again', () => {
    const h = setup();
    h.reorder.move(['b', 'c'], { index: 0 });
    const moved = h.editor.document;

    h.editor.undo();
    const restored = h.editor.document;
    h.editor.redo();

    expect(restored.layers).toBe(tree.layers);
    expect(h.editor.document).toEqual(moved);
    expect(domRowIds(h.host)).toEqual(['b', 'c', 'f', 'a', 'g', 'd']);
  });

  it('returns false and records nothing for a refused or no-op move', () => {
    const h = setup();

    expect(h.reorder.move(['f'], { parentId: 'g', index: 0 })).toBe(false);
    expect(h.reorder.move(['f'], { parentId: 'f', index: 0 })).toBe(false);
    expect(h.reorder.move(['c'], { index: 1 })).toBe(false);
    expect(h.reorder.move(['zzz'], { index: 0 })).toBe(false);

    expect(h.editor.canUndo).toBe(false);
    expect(h.editor.document).toBe(tree);
  });

  it('moves locked layers and layers inside locked folders', () => {
    const h = setup(doc([layer('a', { locked: true }), folder('f', [layer('b')], { locked: true })]));

    expect(h.reorder.move(['a'], { parentId: 'f', index: 1 })).toBe(true);
    expect(h.reorder.move(['b'], { index: 0 })).toBe(true);

    expect(show(h.editor.document.layers)).toBe('b,f(a)');
  });
});

describe('drag and drop', () => {
  it('moves a layer before another by dragging on its upper part, as one undoable command', () => {
    const h = setup();

    dragRow(h, 'c', y(1, 0.1));

    expect(show(h.editor.document.layers)).toBe('f(c,a,g(b)),d');
    expect(h.undoLabel()).toBe('Déplacer les calques');
    h.editor.undo();
    expect(h.editor.document.layers).toBe(tree.layers);
  });

  it('moves a layer after another on its lower part', () => {
    const h = setup();

    dragRow(h, 'a', y(5, 0.9));

    expect(show(h.editor.document.layers)).toBe('f(g(b)),c,d,a');
  });

  it('drops into the middle of a folder as its first child', () => {
    const h = setup();

    dragRow(h, 'd', y(2, 0.5));

    expect(show(h.editor.document.layers)).toBe('f(a,g(d,b)),c');
  });

  it('moves a layer out of a folder by dropping next to a root row', () => {
    const h = setup();

    dragRow(h, 'b', y(5, 0.9));

    expect(show(h.editor.document.layers)).toBe('f(a,g()),c,d,b');
  });

  it('drops below the last row at the end of the root list', () => {
    const h = setup();

    dragRow(h, 'a', y(9));

    expect(show(h.editor.document.layers)).toBe('f(g(b)),c,d,a');
  });

  it('moves the whole selection when the grabbed row is selected', () => {
    const h = setup();
    h.selection.select(['a', 'c'], 'replace');

    dragRow(h, 'c', y(0, 0.05));

    expect(show(h.editor.document.layers)).toBe('a,c,f(g(b)),d');
    expect(h.selection.selected()).toEqual(['a', 'c']);
  });

  it('moves only the grabbed row, and selects it, when it is not part of the selection', () => {
    const h = setup();
    h.selection.select(['a'], 'replace');

    dragRow(h, 'd', y(0, 0.05));

    expect(show(h.editor.document.layers)).toBe('d,f(a,g(b)),c');
    expect(h.selection.selected()).toEqual(['d']);
  });

  it('moves only top-most nodes when a folder and its child are both dragged', () => {
    const h = setup();
    h.selection.select(['f', 'b'], 'replace');

    dragRow(h, 'f', y(5, 0.9));

    expect(show(h.editor.document.layers)).toBe('c,d,f(a,g(b))');
  });

  it('shows a line between rows while dragging and removes everything on drop', () => {
    const h = setup();
    press(h, 'c', y(4));

    moveTo(y(1, 0.1));

    const line = dropLine();
    expect(line?.hidden).toBe(false);
    expect(line?.style.top).toBe(`${ROW_HEIGHT}px`);
    expect(line?.getAttribute('aria-hidden')).toBe('true');
    expect(h.list.element()?.classList.contains(REORDER_CLASSES.listDragging)).toBe(true);
    expect(draggingIds(h)).toEqual(['c']);
    release(y(1, 0.1));
    expect(dropLine()).toBeNull();
    expect(draggingIds(h)).toEqual([]);
    expect(h.list.element()?.classList.contains(REORDER_CLASSES.listDragging)).toBe(false);
  });

  it('indents the line under an expanded folder and highlights the folder for « into »', () => {
    const h = setup();
    press(h, 'd', y(5));

    moveTo(y(0, 0.95));
    const afterFolder = dropLine();
    moveTo(y(2, 0.5));

    expect(afterFolder?.style.top).toBe(`${ROW_HEIGHT}px`);
    expect(afterFolder?.style.left).toBe('16px');
    expect(dropLine()?.hidden).toBe(true);
    expect(row(h, 'g').classList.contains(REORDER_CLASSES.dropInto)).toBe(true);
    moveTo(y(4, 0.1));
    expect(row(h, 'g').classList.contains(REORDER_CLASSES.dropInto)).toBe(false);
    release(y(4, 0.1));
  });

  it('marks the descendants of a dragged folder as dragging too', () => {
    const h = setup();
    press(h, 'f', y(0));

    moveTo(y(5, 0.9));

    expect(draggingIds(h)).toEqual(['f', 'a', 'g', 'b']);
    release(y(5, 0.9));
  });

  it('hides the indicator and does nothing when dropping a folder into itself or its descendant', () => {
    const h = setup();
    press(h, 'f', y(0));

    moveTo(y(2, 0.5));
    const hidden = dropLine()?.hidden ?? true;
    release(y(2, 0.5));

    expect(hidden).toBe(true);
    expect(h.editor.document).toBe(tree);
    expect(h.editor.canUndo).toBe(false);
  });

  it('does nothing when dropping on the place the row already has', () => {
    const h = setup();

    dragRow(h, 'c', y(4, 0.1));

    expect(h.editor.document).toBe(tree);
    expect(h.editor.canUndo).toBe(false);
  });

  it('captures the pointer while dragging and releases it at the end', () => {
    const h = setup();
    const element = h.list.element();
    if (element === undefined) throw new Error('liste absente');
    const capture = jest.fn();
    const releaseCapture = jest.fn();
    Object.assign(element, { setPointerCapture: capture, releasePointerCapture: releaseCapture });

    dragRow(h, 'c', y(1, 0.1));

    expect(capture).toHaveBeenCalledWith(1);
    expect(releaseCapture).toHaveBeenCalledWith(1);
  });
});

describe('click versus drag', () => {
  it('keeps a press-release below the threshold as a normal click (selection of Y5)', () => {
    const h = setup();

    const down = pointer('pointerdown', y(4));
    row(h, 'c').dispatchEvent(down);
    moveTo(y(4) + DRAG_THRESHOLD - 1);
    release(y(4) + DRAG_THRESHOLD - 1);
    const event = click(row(h, 'c'));

    expect(down.defaultPrevented).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(h.selection.selected()).toEqual(['c']);
    expect(h.editor.document).toBe(tree);
    expect(draggingIds(h)).toEqual([]);
    expect(dropLine()).toBeNull();
  });

  it('suppresses the click that follows a real drag, then clicks work again', () => {
    jest.useFakeTimers();
    const h = setup();
    h.selection.select(['c', 'd'], 'replace');
    dragRow(h, 'c', y(0, 0.05));

    const swallowed = click(row(h, 'c'), { ctrlKey: true });
    const afterwards = click(row(h, 'c'), { ctrlKey: true });

    expect(swallowed.defaultPrevented).toBe(true);
    expect(afterwards.defaultPrevented).toBe(false);
    expect(h.selection.selected()).toEqual(['d']);
  });

  it('stops suppressing after a short delay when no click follows', () => {
    jest.useFakeTimers();
    const h = setup();
    dragRow(h, 'c', y(0, 0.05));

    jest.advanceTimersByTime(100);
    const event = click(row(h, 'd'));

    expect(event.defaultPrevented).toBe(false);
    expect(h.selection.selected()).toEqual(['d']);
  });

  it('ignores presses on row controls, the folder toggle, inputs, editing names and non-primary buttons', () => {
    const h = setup();
    h.list.addRowControl({ id: 'test.control', order: 1, render: (_row, element) => (element.textContent = 'x') });
    const control = row(h, 'c').querySelector<HTMLElement>('.jt-layer-row__control');
    const toggle = row(h, 'f').querySelector<HTMLElement>('[data-action="toggle"]');
    const editing = h.list.nameElement('d');
    editing?.setAttribute('data-editing', '');
    const input = document.createElement('input');
    row(h, 'a').appendChild(input);
    const attempts: Array<[HTMLElement | null | undefined, IPointerInit]> = [
      [control, {}],
      [toggle, {}],
      [editing, {}],
      [input, {}],
      [row(h, 'a'), { button: 2 }],
      [row(h, 'a'), { isPrimary: false }]
    ];

    attempts.forEach(([target, init]) => {
      target?.dispatchEvent(pointer('pointerdown', y(0), init));
      moveTo(y(5, 0.9));
      const started = draggingIds(h).length > 0 || dropLine() !== null;
      release(y(5, 0.9));
      expect(started).toBe(false);
    });

    expect(h.editor.document).toBe(tree);
  });

  it('ignores a press that is not on a row', () => {
    const h = setup();

    h.list.element()?.dispatchEvent(pointer('pointerdown', y(0)));
    moveTo(y(5));

    expect(draggingIds(h)).toEqual([]);
    release(y(5));
    expect(h.editor.document).toBe(tree);
  });
});

describe('lost button release', () => {
  it('cancels the press when a hover move arrives with no button held (pointerup was lost)', () => {
    const h = setup();
    press(h, 'c', y(4));

    document.dispatchEvent(pointer('pointermove', y(1, 0.1), { buttons: 0 }));
    moveTo(y(1, 0.1));
    release(y(1, 0.1));

    expect(draggingIds(h)).toEqual([]);
    expect(dropLine()).toBeNull();
    expect(h.editor.document).toBe(tree);
  });

  it('ends a started drag when a move arrives with no button held, without moving anything', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    document.dispatchEvent(pointer('pointermove', y(0, 0.1), { buttons: 0 }));

    expect(draggingIds(h)).toEqual([]);
    expect(dropLine()).toBeNull();
    expect(h.editor.document).toBe(tree);
  });

  it('ends the press on contextmenu', () => {
    const h = setup();
    press(h, 'c', y(4));

    document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    moveTo(y(1, 0.1));
    release(y(1, 0.1));

    expect(draggingIds(h)).toEqual([]);
    expect(h.editor.document).toBe(tree);
  });

  it('ends a started drag on window blur', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    window.dispatchEvent(new Event('blur'));
    release(y(1, 0.1));

    expect(draggingIds(h)).toEqual([]);
    expect(dropLine()).toBeNull();
    expect(h.editor.document).toBe(tree);
  });

  it('ends a started drag on lostpointercapture, but not a press that never started', () => {
    const h = setup();
    const element = h.list.element();
    press(h, 'a', y(1));
    lostCapture(element);
    moveTo(y(5, 0.9));
    const started = draggingIds(h).length > 0;
    release(y(5, 0.9));
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    lostCapture(element);
    release(y(1, 0.1));

    expect(started).toBe(true);
    expect(draggingIds(h)).toEqual([]);
    expect(h.editor.document.layers).not.toBe(tree.layers);
    expect(show(h.editor.document.layers)).toBe('f(g(b)),c,d,a');
  });

  it('ignores lostpointercapture from a row or another pointer (touch implicit capture)', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    lostCapture(row(h, 'c'));
    lostCapture(h.list.element(), 2);
    const stillDragging = draggingIds(h);
    release(y(1, 0.1));

    expect(stillDragging).toEqual(['c']);
    expect(show(h.editor.document.layers)).toBe('f(c,a,g(b)),d');
  });

  it('does not abort on a move without button for a pen or touch pointer', () => {
    const h = setup();
    press(h, 'c', y(4), { pointerType: 'pen' });

    document.dispatchEvent(pointer('pointermove', y(1, 0.1), { buttons: 0, pointerType: 'pen' }));
    const dragging = draggingIds(h);
    release(y(1, 0.1));

    expect(dragging).toEqual(['c']);
  });

  // Routes où le bouton peut rester enfoncé : le clic est supprimé au relâchement tardif.
  const heldAborts: Array<[string, (h: IHarness) => void]> = [
    ['contextmenu', () => document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))],
    ['blur', () => window.dispatchEvent(new Event('blur'))],
    ['lostpointercapture', (h) => lostCapture(h.list.element())]
  ];

  it.each(heldAborts)('swallows the click of a late release after a started drag aborted by %s', (_name, abort) => {
    jest.useFakeTimers();
    const h = setup();
    h.selection.select(['c', 'd'], 'replace');
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    abort(h);
    jest.advanceTimersByTime(5000);
    release(y(1, 0.1));
    const swallowed = click(row(h, 'c'), { ctrlKey: true });

    expect(draggingIds(h)).toEqual([]);
    expect(dropLine()).toBeNull();
    expect(swallowed.defaultPrevented).toBe(true);
    expect(h.selection.selected()).toEqual(['c', 'd']);
    expect(h.editor.document).toBe(tree);
  });

  it('swallows the click after a started drag whose button release was seen as buttons = 0', () => {
    const h = setup();
    h.selection.select(['c', 'd'], 'replace');
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    document.dispatchEvent(pointer('pointermove', y(0), { buttons: 0 }));
    const swallowed = click(row(h, 'c'), { ctrlKey: true });

    expect(swallowed.defaultPrevented).toBe(true);
    expect(h.selection.selected()).toEqual(['c', 'd']);
  });

  it.each(heldAborts)('ignores moves of an aborted drag (%s) and lets the next press start normally', (_name, abort) => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));
    abort(h);

    moveTo(y(0, 0.1));
    const lingering = draggingIds(h);
    dragRow(h, 'd', y(0, 0.05));

    expect(lingering).toEqual([]);
    expect(show(h.editor.document.layers)).toBe('d,f(a,g(b)),c');
  });

  it('keeps a cancelled drag pending a right-button press, so the late left click is still swallowed', () => {
    jest.useFakeTimers();
    const h = setup();
    h.selection.select(['c', 'd'], 'replace');
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));
    row(h, 'c').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    row(h, 'a').dispatchEvent(pointer('pointerdown', y(1), { button: 2, buttons: 3 }));
    row(h, 'a').dispatchEvent(pointer('pointerdown', y(2), { isPrimary: false, pointerId: 2 }));
    jest.advanceTimersByTime(5000);
    release(y(1, 0.1));
    const swallowed = click(row(h, 'c'), { ctrlKey: true });

    expect(swallowed.defaultPrevented).toBe(true);
    expect(h.selection.selected()).toEqual(['c', 'd']);
  });

  it('does not let a stale suppression swallow a click of a new press outside the list', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));
    document.dispatchEvent(pointer('pointermove', y(0), { buttons: 0 }));

    document.body.dispatchEvent(pointer('pointerdown', y(0)));
    const outside = click(document.body);
    release(y(0));

    expect(outside.defaultPrevented).toBe(false);
  });

  it('keeps swallowing the release click when only a non-primary pointer presses in between', () => {
    const h = setup();
    h.selection.select(['c', 'd'], 'replace');
    dragRow(h, 'c', y(0, 0.05));

    document.body.dispatchEvent(pointer('pointerdown', y(0), { isPrimary: false, pointerId: 2 }));
    const swallowed = click(row(h, 'c'), { ctrlKey: true });

    expect(swallowed.defaultPrevented).toBe(true);
  });

  it('does not swallow a click after a press aborted before the threshold', () => {
    const h = setup();
    press(h, 'c', y(4));
    window.dispatchEvent(new Event('blur'));

    const event = click(row(h, 'c'));

    expect(event.defaultPrevented).toBe(false);
  });

  it('removes the extra listeners after a normal drop', () => {
    const h = setup();
    dragRow(h, 'c', y(1, 0.1));
    const before = show(h.editor.document.layers);

    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    expect(show(h.editor.document.layers)).toBe(before);
  });
});

describe('after a mouse drop', () => {
  it('keeps the focus in an input or an editing name', () => {
    const h = setup();
    const input = document.createElement('input');
    row(h, 'a').appendChild(input);
    input.focus();

    dragRow(h, 'c', y(1, 0.1));

    expect(document.activeElement).toBe(input);
  });

  it('focuses the first moved row, like the keyboard path', () => {
    const h = setup();
    h.selection.select(['a', 'c'], 'replace');

    dragRow(h, 'c', y(5, 0.9));

    expect(document.activeElement).toBe(row(h, 'a'));
  });
});

describe('click suppression and Escape details', () => {
  it('swallows the click after a drop below the last row, so the empty-area click does not clear the selection', () => {
    const h = setup();
    dragRow(h, 'a', y(9));
    const zone = h.list.element()?.parentElement;
    if (zone === null || zone === undefined) throw new Error('zone absente');

    const swallowed = click(zone);

    expect(swallowed.defaultPrevented).toBe(true);
    expect(h.selection.selected()).toEqual(['a']);
  });

  it('lets Escape through for a press that has not passed the threshold', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');
    press(h, 'c', y(4));
    moveTo(y(4) + 1);

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    row(h, 'c').dispatchEvent(escape);
    release(y(4) + 1);

    // Y5 a traité Échap (selection vidée) : le glisser ne l'a pas avalé.
    expect(h.selection.selected()).toEqual([]);
  });

  it('swallows only the first Escape of a drag: once cancelled, Escape is free again', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    const first = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    row(h, 'c').dispatchEvent(first);
    const second = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    row(h, 'c').dispatchEvent(second);

    expect(first.defaultPrevented).toBe(true);
    expect(h.selection.selected()).toEqual([]);
    expect(second.cancelBubble).toBe(false);
    release(y(1, 0.1));
  });
});

describe('cancelling', () => {
  it('cancels with Escape: nothing moves, visuals are gone, the selection is kept and the release click is swallowed', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    row(h, 'c').dispatchEvent(escape);
    moveTo(y(0, 0.1));
    release(y(0, 0.1));
    const swallowed = click(row(h, 'c'));

    expect(escape.defaultPrevented).toBe(true);
    expect(h.editor.document).toBe(tree);
    expect(dropLine()).toBeNull();
    expect(draggingIds(h)).toEqual([]);
    expect(h.selection.selected()).toEqual(['c']);
    expect(swallowed.defaultPrevented).toBe(true);
  });

  it('lets Escape through when no press is in progress (Y5 clears the selection)', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');

    row(h, 'c').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(h.selection.selected()).toEqual([]);
  });

  it('cancels on pointercancel', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    document.dispatchEvent(pointer('pointercancel', y(1, 0.1)));
    release(y(1, 0.1));

    expect(h.editor.document).toBe(tree);
    expect(dropLine()).toBeNull();
    expect(draggingIds(h)).toEqual([]);
  });

  it('ignores events from another pointer during a drag', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    document.dispatchEvent(pointer('pointerup', y(0, 0.1), { pointerId: 2 }));
    expect(draggingIds(h)).toEqual(['c']);
    release(y(1, 0.1));

    expect(show(h.editor.document.layers)).toBe('f(c,a,g(b)),d');
  });

  it('cancels when the rows change during the drag', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    h.list.toggleCollapsed('f');
    release(y(1, 0.1));

    expect(show(h.editor.document.layers)).toBe('f(a,g(b)),c,d');
    expect(dropLine()).toBeNull();
    expect(draggingIds(h)).toEqual([]);
  });

  it('removes the indicator and listeners when the editor is destroyed during a drag', () => {
    const h = setup();
    press(h, 'c', y(4));
    moveTo(y(1, 0.1));

    h.editor.destroy();

    expect(dropLine()).toBeNull();
    expect(() => {
      moveTo(y(0));
      release(y(0));
    }).not.toThrow();
  });

  it('does not leave listeners on the list after destroy (a new press starts nothing)', () => {
    const h = setup();
    const element = h.list.element();
    const add = jest.spyOn(document, 'addEventListener');
    h.editor.destroy();
    add.mockClear();

    element?.dispatchEvent(pointer('pointerdown', y(0)));

    expect(add).not.toHaveBeenCalled();
    add.mockRestore();
  });
});

describe('keyboard', () => {
  function key(name: string, init: KeyboardEventInit = {}): KeyboardEvent {
    return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ctrlKey: true, altKey: true, ...init });
  }

  it('Ctrl+Alt+Up moves the selection up by one row, keeping the focus on the row', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');
    row(h, 'c').focus();

    const event = key('ArrowUp');
    row(h, 'c').dispatchEvent(event);

    // Au-dessus de c se trouve b, dernier descendant de f : on entre dans g, en dernier.
    expect(show(h.editor.document.layers)).toBe('f(a,g(b,c)),d');
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(row(h, 'c'));
    expect(h.undoLabel()).toBe('Déplacer les calques');
  });

  it('Ctrl+Alt+Down moves the selection down by one row', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');

    row(h, 'c').dispatchEvent(key('ArrowDown'));

    expect(show(h.editor.document.layers)).toBe('f(a,g(b)),d,c');
  });

  function live(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.${LIVE_REGION_CLASS}`);
  }

  it('announces the move in a polite live region, removed on destroy', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');

    row(h, 'c').dispatchEvent(key('ArrowUp'));
    const into = live()?.textContent;
    row(h, 'c').dispatchEvent(key('ArrowDown'));
    row(h, 'c').dispatchEvent(key('ArrowDown'));

    expect(live()?.getAttribute('aria-live')).toBe('polite');
    expect(live()?.getAttribute('role')).toBe('status');
    expect(into).toBe('« c » déplacé dans « g » : position 2 sur 2');
    expect(live()?.textContent).toBe('« c » déplacé : position 2 sur 3');
    h.editor.destroy();
    expect(live()).toBeNull();
  });

  it('announces several moved layers and stays silent when nothing moves', () => {
    const h = setup();
    h.selection.select(['c', 'd'], 'replace');

    row(h, 'd').dispatchEvent(key('ArrowDown'));
    const silent = live()?.textContent;
    row(h, 'c').dispatchEvent(key('ArrowUp'));

    expect(silent).toBe('');
    expect(live()?.textContent).toBe('2 calques déplacés dans « g » : position 2 sur 3');
  });

  it('moves the focused row when nothing is selected', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');
    h.selection.clear();

    row(h, 'c').dispatchEvent(key('ArrowDown'));

    expect(show(h.editor.document.layers)).toBe('f(a,g(b)),d,c');
  });

  it('also accepts Meta+Alt+Up/Down (Ctrl+Alt is the VoiceOver modifier on macOS)', () => {
    const h = setup();
    h.selection.select(['c'], 'replace');

    const event = key('ArrowDown', { ctrlKey: false, metaKey: true });
    row(h, 'c').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(show(h.editor.document.layers)).toBe('f(a,g(b)),d,c');
  });

  it('does not preventDefault when nothing can move, and ignores other key combinations', () => {
    const h = setup();
    h.selection.select(['d'], 'replace');

    const atEdge = key('ArrowDown');
    row(h, 'd').dispatchEvent(atEdge);
    row(h, 'd').dispatchEvent(key('ArrowUp', { altKey: false }));
    row(h, 'd').dispatchEvent(key('ArrowUp', { ctrlKey: false }));
    row(h, 'd').dispatchEvent(key('ArrowUp', { shiftKey: true }));
    row(h, 'd').dispatchEvent(key('Home'));

    expect(atEdge.defaultPrevented).toBe(false);
    expect(h.editor.document).toBe(tree);
  });
});
