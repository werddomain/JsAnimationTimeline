// packages/editor/src/plugins/layers/lock/__tests__/LockPlugin.test.ts
/**
 * `layers.lock` dans un vrai éditeur : commandes annulables, service, cadenas
 * de ligne (aria-pressed, libellés, verrou hérité atténué), en-tête, et
 * respect du verrou par les commandes d'édition des images.
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import { LockLabels, createSetAllLockedCommand, createSetLockedCommand } from '../lockCommands';
import { LOCK_BUTTON_CLASS } from '../LockPlugin';

afterEach(unmountAll);

const tree = doc([folder('f', [layer('a'), layer('d', { locked: true })], { locked: true }), layer('b')]);

function rowButton(host: HTMLElement, id: string): HTMLButtonElement {
  const button = host.querySelector(`[data-row-id="${id}"] .${LOCK_BUTTON_CLASS}`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`pas de cadenas sur ${id}`);
  return button;
}

function headerButton(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector(`.jt-layers-header__control .${LOCK_BUTTON_CLASS}`);
  if (!(button instanceof HTMLButtonElement)) throw new Error("pas de cadenas d'en-tête");
  return button;
}

describe('lock commands', () => {
  it('executes, undoes and redoes a single lock', () => {
    const { editor } = mount(tree);
    expect(editor.execute(createSetLockedCommand(editor.document, 'b', true))).toBe(true);
    expect(findNodeById(editor.document.layers, 'b')?.locked).toBe(true);
    editor.undo();
    expect(editor.document).toEqual(tree);
    expect(findNodeById(editor.document.layers, 'b')).not.toHaveProperty('locked');
    editor.redo();
    expect(findNodeById(editor.document.layers, 'b')?.locked).toBe(true);
  });

  it('labels the command after the action', () => {
    expect(createSetLockedCommand(tree, 'b', true).label).toBe(LockLabels.lock);
    expect(createSetLockedCommand(tree, 'f', false).label).toBe(LockLabels.unlock);
  });

  it('executes, undoes and redoes the all-nodes command as one history entry', () => {
    const { editor } = mount(tree);
    expect(editor.execute(createSetAllLockedCommand(editor.document, true))).toBe(true);
    expect(editor.document.layers.map((node) => node.locked)).toEqual([true, true]);
    editor.undo();
    expect(editor.document).toEqual(tree);
    expect(editor.canUndo).toBe(false);
    editor.redo();
    expect(editor.document.layers.map((node) => node.locked)).toEqual([true, true]);
  });

  it('is a no-op when nothing changes', () => {
    const { editor } = mount(tree);
    expect(editor.execute(createSetLockedCommand(editor.document, 'f', true))).toBe(false);
    expect(editor.canUndo).toBe(false);
  });
});

describe('layers.lock service', () => {
  it('setLocked, toggle and setAll go through the history', () => {
    const { editor } = mount(tree);
    const service = editor.getService('layers.lock');
    if (service === undefined) throw new Error('service absent');
    expect(service.setLocked('b', true)).toBe(true);
    expect(service.setLocked('b', true)).toBe(false);
    expect(service.toggle('b')).toBe(true);
    expect(findNodeById(editor.document.layers, 'b')?.locked).toBe(false);
    expect(service.setAll(true)).toBe(true);
    expect(editor.document.layers.every((node) => node.locked === true)).toBe(true);
    expect(editor.undo()).toBe(true);
  });

  it('refuses unknown ids without throwing', () => {
    const { editor } = mount(tree);
    const service = editor.getService('layers.lock');
    expect(service?.setLocked('zz', true)).toBe(false);
    expect(service?.toggle('zz')).toBe(false);
  });
});

describe('lock row control', () => {
  it('shows a padlock per row with aria-pressed and French labels', () => {
    const { host } = mount(tree);
    expect(rowButton(host, 'b').getAttribute('aria-pressed')).toBe('false');
    expect(rowButton(host, 'b').getAttribute('aria-label')).toBe('Verrouiller le calque');
    expect(rowButton(host, 'f').getAttribute('aria-pressed')).toBe('true');
    expect(rowButton(host, 'f').getAttribute('aria-label')).toBe('Déverrouiller le calque');
    expect(rowButton(host, 'f').title).toBe('Déverrouiller le calque');
  });

  it('dims an inherited lock only when the node has no own lock, and toggles only the own flag', () => {
    const { host, editor } = mount(tree);
    const inherited = rowButton(host, 'a');
    expect(inherited.dataset.inherited).toBe('true');
    expect(inherited.getAttribute('aria-pressed')).toBe('false');
    expect(rowButton(host, 'd').dataset.inherited).toBeUndefined();
    expect(rowButton(host, 'b').dataset.inherited).toBeUndefined();
    inherited.click();
    expect(findNodeById(editor.document.layers, 'a')?.locked).toBe(true);
    expect(findNodeById(editor.document.layers, 'f')?.locked).toBe(true);
    expect(rowButton(host, 'a').dataset.inherited).toBeUndefined();
  });

  it('toggles on click, updates the same button and keeps its focus', () => {
    const { host, editor } = mount(tree);
    const button = rowButton(host, 'b');
    button.focus();
    button.click();
    expect(findNodeById(editor.document.layers, 'b')?.locked).toBe(true);
    expect(rowButton(host, 'b')).toBe(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(button);
    editor.undo();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('unlocking a folder keeps the children own locks', () => {
    const { host, editor } = mount(tree);
    rowButton(host, 'f').click();
    expect(findNodeById(editor.document.layers, 'f')?.locked).toBe(false);
    expect(findNodeById(editor.document.layers, 'd')?.locked).toBe(true);
  });
});

describe('lock header control', () => {
  it('locks all while one node is unlocked, then unlocks all, as single history entries', () => {
    const original = doc([layer('a', { locked: true }), layer('b')]);
    const { host, editor } = mount(original);
    const header = headerButton(host);
    expect(header.getAttribute('aria-pressed')).toBe('false');
    expect(header.getAttribute('aria-label')).toBe('Verrouiller tous les calques');
    header.click();
    expect(editor.document.layers.every((node) => node.locked === true)).toBe(true);
    expect(header.getAttribute('aria-pressed')).toBe('true');
    expect(header.getAttribute('aria-label')).toBe('Déverrouiller tous les calques');
    header.click();
    expect(editor.document.layers.every((node) => node.locked === false)).toBe(true);
    editor.undo();
    editor.undo();
    expect(editor.document).toEqual(original);
  });

  it('is removed on destroy', () => {
    const { host, editor } = mount(tree);
    editor.destroy();
    expect(host.querySelector(`.${LOCK_BUTTON_CLASS}`)).toBeNull();
  });
});
