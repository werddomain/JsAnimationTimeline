// packages/editor/src/plugins/layers/rename/__tests__/RenamePlugin.test.ts
/**
 * `layers.rename` dans un vrai éditeur : commande annulable, normalisation
 * des noms, saisie sur place (double-clic, Entrée, Échap, blur) et service.
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import { NAME_EDITING_ATTRIBUTE } from '../../list/LayerRowView';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import { RENAME_INPUT_CLASS } from '../inlineEdit';
import { RENAME_LABEL, createRenameCommand, normalizeLayerName } from '../renameCommands';

afterEach(unmountAll);

const tree = doc([folder('f', [layer('a')]), layer('b', { locked: true })]);

function nameOf(editorDoc: ReturnType<typeof doc>, id: string): string | undefined {
  return findNodeById(editorDoc.layers, id)?.name;
}

function nameElement(host: HTMLElement, id: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(`[data-row-id="${id}"] .jt-layer-row__name`);
  if (element === null) throw new Error(`pas de nom pour ${id}`);
  return element;
}

function inputOf(host: HTMLElement): HTMLInputElement {
  const input = host.querySelector(`.${RENAME_INPUT_CLASS}`);
  if (!(input instanceof HTMLInputElement)) throw new Error('pas de saisie');
  return input;
}

function press(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function doubleClick(target: HTMLElement): void {
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
}

describe('normalizeLayerName', () => {
  it('trims and refuses blank names', () => {
    expect(normalizeLayerName('  Fond  ')).toBe('Fond');
    expect(normalizeLayerName('   ')).toBeUndefined();
    expect(normalizeLayerName('')).toBeUndefined();
  });
});

describe('rename command', () => {
  it('executes, undoes and redoes for a layer, a folder and a locked layer', () => {
    const { editor } = mount(tree);
    ['a', 'f', 'b'].forEach((id) => {
      expect(editor.execute(createRenameCommand(editor.document, id, `  ${id}2 `))).toBe(true);
      expect(nameOf(editor.document, id)).toBe(`${id}2`);
      editor.undo();
      expect(editor.document).toEqual(tree);
      editor.redo();
      expect(nameOf(editor.document, id)).toBe(`${id}2`);
      editor.undo();
    });
  });

  it('is labelled and returns the same document for an unchanged name', () => {
    const { editor } = mount(tree);
    const command = createRenameCommand(editor.document, 'a', ' a ');
    expect(command.label).toBe(RENAME_LABEL);
    expect(editor.execute(command)).toBe(false);
    expect(editor.canUndo).toBe(false);
  });

  it('throws for a blank name or an unknown node', () => {
    expect(() => createRenameCommand(tree, 'a', '  ')).toThrow();
    expect(() => createRenameCommand(tree, 'zz', 'x')).toThrow('zz');
  });
});

describe('layers.rename service', () => {
  it('renames through the history and refuses blank, unknown or unchanged names', () => {
    const { editor } = mount(tree);
    const service = editor.getService('layers.rename');
    if (service === undefined) throw new Error('service absent');
    expect(service.rename('a', ' Fond ')).toBe(true);
    expect(nameOf(editor.document, 'a')).toBe('Fond');
    expect(service.rename('a', '   ')).toBe(false);
    expect(service.rename('zz', 'x')).toBe(false);
    expect(service.rename('a', 'Fond')).toBe(false);
  });

  it('startEditing ignores rows that are not displayed', () => {
    const { editor, host } = mount(doc([folder('f', [layer('a')], { collapsed: true })]));
    editor.getService('layers.rename')?.startEditing('a');
    editor.getService('layers.rename')?.startEditing('missing');
    expect(host.querySelector(`.${RENAME_INPUT_CLASS}`)).toBeNull();
  });
});

describe('inline editing', () => {
  it('opens on double-click on the name, inside the name element, with data-editing', () => {
    const { host } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    expect(nameElement(host, 'a').contains(input)).toBe(true);
    expect(nameElement(host, 'a').hasAttribute(NAME_EDITING_ATTRIBUTE)).toBe(true);
    expect(input.value).toBe('a');
    expect(document.activeElement).toBe(input);
  });

  it('ignores double-clicks elsewhere in the row', () => {
    const { host } = mount(tree);
    const row = host.querySelector<HTMLElement>('[data-row-id="a"]');
    if (row === null) throw new Error('ligne absente');
    doubleClick(row);
    expect(host.querySelector(`.${RENAME_INPUT_CLASS}`)).toBeNull();
  });

  it('commits on Enter with a trimmed name as one undoable command', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'f'));
    const input = inputOf(host);
    input.value = '  Décor  ';
    press(input, 'Enter');
    expect(host.querySelector(`.${RENAME_INPUT_CLASS}`)).toBeNull();
    expect(nameOf(editor.document, 'f')).toBe('Décor');
    expect(nameElement(host, 'f').textContent).toBe('Décor');
    expect(nameElement(host, 'f').hasAttribute(NAME_EDITING_ATTRIBUTE)).toBe(false);
    editor.undo();
    expect(nameElement(host, 'f').textContent).toBe('f');
  });

  it('commits on blur', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'b'));
    const input = inputOf(host);
    input.value = 'Avant-plan';
    input.dispatchEvent(new FocusEvent('blur'));
    expect(nameOf(editor.document, 'b')).toBe('Avant-plan');
  });

  it('cancels on Escape and keeps the name', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.value = 'autre';
    press(input, 'Escape');
    input.dispatchEvent(new FocusEvent('blur'));
    expect(nameOf(editor.document, 'a')).toBe('a');
    expect(nameElement(host, 'a').textContent).toBe('a');
    expect(editor.canUndo).toBe(false);
  });

  it('refuses a blank name and keeps the old one', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.value = '   ';
    press(input, 'Enter');
    expect(nameOf(editor.document, 'a')).toBe('a');
    expect(nameElement(host, 'a').textContent).toBe('a');
    expect(editor.canUndo).toBe(false);
  });

  it('keeps the input while the document changes elsewhere (data-editing)', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.value = 'en cours';
    editor.getService('layers.visibility')?.toggle('b');
    expect(inputOf(host)).toBe(input);
    expect(input.value).toBe('en cours');
  });

  it('does not let editing keys or clicks reach the editor', () => {
    const { host } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const seen = jest.fn();
    host.addEventListener('keydown', seen);
    host.addEventListener('click', seen);
    const input = inputOf(host);
    press(input, 'a');
    input.click();
    expect(seen).not.toHaveBeenCalled();
  });

  it('commits a previous edit when another row starts editing', () => {
    const { host, editor } = mount(tree);
    const service = editor.getService('layers.rename');
    service?.startEditing('a');
    inputOf(host).value = 'A2';
    service?.startEditing('b');
    expect(nameOf(editor.document, 'a')).toBe('A2');
    expect(host.querySelectorAll(`.${RENAME_INPUT_CLASS}`)).toHaveLength(1);
  });

  it('abandons the edit when the row disappears', () => {
    const { host, editor } = mount(tree);
    editor.getService('layers.rename')?.startEditing('a');
    editor.load(doc([layer('b')]));
    expect(host.querySelector(`.${RENAME_INPUT_CLASS}`)).toBeNull();
    expect(editor.document.layers.map((node) => node.name)).toEqual(['b']);
  });

  it('cleans up on destroy', () => {
    const { host, editor } = mount(tree);
    editor.getService('layers.rename')?.startEditing('a');
    editor.destroy();
    expect(host.querySelector(`.${RENAME_INPUT_CLASS}`)).toBeNull();
  });
});
