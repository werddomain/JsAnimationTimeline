// packages/editor/src/plugins/layers/visibility/__tests__/VisibilityPlugin.test.ts
/**
 * `layers.visibility` dans un vrai éditeur : commandes annulables, service,
 * œil de ligne (aria-pressed, libellés, focus conservé), en-tête et nettoyage.
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import { VisibilityLabels, createSetAllVisibleCommand, createSetVisibleCommand } from '../visibilityCommands';
import { VISIBILITY_BUTTON_CLASS } from '../VisibilityPlugin';

afterEach(unmountAll);

const tree = doc([folder('f', [layer('a', { visible: false })]), layer('b')]);

function rowButton(host: HTMLElement, id: string): HTMLButtonElement {
  const button = host.querySelector(`[data-row-id="${id}"] .${VISIBILITY_BUTTON_CLASS}`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`pas d'œil sur ${id}`);
  return button;
}

function headerButton(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector(`.jt-layers-header__control .${VISIBILITY_BUTTON_CLASS}`);
  if (!(button instanceof HTMLButtonElement)) throw new Error("pas d'œil d'en-tête");
  return button;
}

describe('visibility commands', () => {
  it('executes, undoes and redoes a single toggle', () => {
    const { editor } = mount(tree);
    expect(editor.execute(createSetVisibleCommand(editor.document, 'b', false))).toBe(true);
    expect(findNodeById(editor.document.layers, 'b')?.visible).toBe(false);
    editor.undo();
    expect(editor.document).toEqual(tree);
    editor.redo();
    expect(findNodeById(editor.document.layers, 'b')?.visible).toBe(false);
  });

  it('labels the command after the action', () => {
    expect(createSetVisibleCommand(tree, 'b', false).label).toBe(VisibilityLabels.hide);
    expect(createSetVisibleCommand(tree, 'b', true).label).toBe(VisibilityLabels.show);
  });

  it('executes, undoes and redoes the all-nodes command as one history entry', () => {
    const { editor } = mount(tree);
    expect(editor.execute(createSetAllVisibleCommand(editor.document, false))).toBe(true);
    expect(editor.document.layers.map((node) => node.visible)).toEqual([false, false]);
    expect(findNodeById(editor.document.layers, 'a')?.visible).toBe(false);
    editor.undo();
    expect(editor.document).toEqual(tree);
    expect(editor.canUndo).toBe(false);
    editor.redo();
    expect(editor.document.layers.map((node) => node.visible)).toEqual([false, false]);
  });

  it('is a no-op when nothing changes', () => {
    const { editor } = mount(tree);
    expect(editor.execute(createSetVisibleCommand(editor.document, 'b', true))).toBe(false);
    expect(editor.canUndo).toBe(false);
  });
});

describe('layers.visibility service', () => {
  it('setVisible, toggle and setAll go through the history', () => {
    const { editor } = mount(tree);
    const service = editor.getService('layers.visibility');
    if (service === undefined) throw new Error('service absent');
    expect(service.setVisible('b', false)).toBe(true);
    expect(service.setVisible('b', false)).toBe(false);
    expect(service.toggle('b')).toBe(true);
    expect(findNodeById(editor.document.layers, 'b')?.visible).toBe(true);
    expect(service.setAll(false)).toBe(true);
    expect(editor.document.layers.every((node) => node.visible === false)).toBe(true);
    expect(editor.undo()).toBe(true);
  });

  it('refuses unknown ids without throwing', () => {
    const { editor } = mount(tree);
    const service = editor.getService('layers.visibility');
    expect(service?.setVisible('zz', false)).toBe(false);
    expect(service?.toggle('zz')).toBe(false);
  });
});

describe('visibility row control', () => {
  it('shows an eye per row with aria-pressed and French labels', () => {
    const { host } = mount(tree);
    expect(rowButton(host, 'b').getAttribute('aria-pressed')).toBe('true');
    expect(rowButton(host, 'b').getAttribute('aria-label')).toBe('Visibilité de « b »');
    expect(rowButton(host, 'b').title).toBe('Masquer le calque');
    expect(rowButton(host, 'a').getAttribute('aria-pressed')).toBe('false');
    expect(rowButton(host, 'a').getAttribute('aria-label')).toBe('Visibilité de « a »');
    expect(rowButton(host, 'a').title).toBe('Afficher le calque');
  });

  it('sits left of the lock (order 10 before 20)', () => {
    const { host } = mount(tree);
    const ids = Array.from(host.querySelectorAll<HTMLElement>('[data-row-id="b"] [data-control-id]')).map(
      (cell) => cell.dataset.controlId
    );
    expect(ids.indexOf('layers.visibility')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('layers.visibility')).toBeLessThan(ids.indexOf('layers.lock'));
  });

  it('toggles on click and updates the same button in place', () => {
    const { host, editor } = mount(tree);
    const button = rowButton(host, 'b');
    button.click();
    expect(findNodeById(editor.document.layers, 'b')?.visible).toBe(false);
    expect(rowButton(host, 'b')).toBe(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Visibilité de « b »');
    expect(button.title).toBe('Afficher le calque');
    editor.undo();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('lets click, mousedown, pointerdown and non-activation keys bubble, but not Enter or Space', () => {
    const { host } = mount(tree);
    const onRow = jest.fn();
    const row = host.querySelector('[data-row-id="b"]');
    const types = ['click', 'mousedown', 'pointerdown'];
    [...types, 'keydown'].forEach((type) => row?.addEventListener(type, onRow));
    const button = rowButton(host, 'b');
    types.forEach((type) => button.dispatchEvent(new Event(type, { bubbles: true })));
    expect(onRow).toHaveBeenCalledTimes(3);
    onRow.mockClear();
    ['Enter', ' '].forEach((key) => button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
    expect(onRow).not.toHaveBeenCalled();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(onRow).toHaveBeenCalledTimes(1);
  });

  it('undoes with Ctrl+Z through the shortcuts plugin while the button is focused', () => {
    const { host, editor } = mount(tree);
    const button = rowButton(host, 'b');
    button.focus();
    button.click();
    expect(findNodeById(editor.document.layers, 'b')?.visible).toBe(false);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(findNodeById(editor.document.layers, 'b')?.visible).toBeUndefined();
  });

  it('keeps the row buttons in the tab order', () => {
    const { host } = mount(tree);
    expect(rowButton(host, 'b').tabIndex).toBe(0);
  });

  it('toggles a folder own flag', () => {
    const { host, editor } = mount(tree);
    rowButton(host, 'f').click();
    expect(findNodeById(editor.document.layers, 'f')?.visible).toBe(false);
  });
});

describe('visibility header control', () => {
  it('shows all while one node is hidden, then hides all, as single history entries', () => {
    const original = doc([layer('a', { visible: false }), layer('b')]);
    const { host, editor } = mount(original);
    const header = headerButton(host);
    expect(header.getAttribute('aria-pressed')).toBe('false');
    expect(header.getAttribute('aria-label')).toBe('Visibilité de tous les calques');
    expect(header.title).toBe('Afficher tous les calques');
    header.click();
    expect(editor.document.layers.every((node) => node.visible !== false)).toBe(true);
    expect(header.getAttribute('aria-pressed')).toBe('true');
    expect(header.getAttribute('aria-label')).toBe('Visibilité de tous les calques');
    expect(header.title).toBe('Masquer tous les calques');
    header.click();
    expect(editor.document.layers.every((node) => node.visible === false)).toBe(true);
    editor.undo();
    editor.undo();
    expect(editor.document).toEqual(original);
  });

  it('follows changes made elsewhere and is removed on destroy', () => {
    const { host, editor } = mount(tree);
    editor.getService('layers.visibility')?.setAll(false);
    expect(headerButton(host).getAttribute('aria-pressed')).toBe('false');
    editor.destroy();
    expect(host.querySelector(`.${VISIBILITY_BUTTON_CLASS}`)).toBeNull();
  });
});
