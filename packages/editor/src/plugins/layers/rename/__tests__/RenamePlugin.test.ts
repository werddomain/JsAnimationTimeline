// packages/editor/src/plugins/layers/rename/__tests__/RenamePlugin.test.ts
/**
 * `layers.rename` dans un vrai éditeur : commande annulable, normalisation
 * des noms, saisie sur place (double-clic, Entrée, Échap, blur) et service.
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import { createCommand } from '../../../../core/commands/createCommand';
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

describe('inline editing review fixes', () => {
  function focusableRow(host: HTMLElement, id: string): HTMLElement {
    const row = host.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
    if (row === null) throw new Error(`ligne ${id} absente`);
    row.tabIndex = -1;
    return row;
  }

  it('gives the focus back to the row after Enter and Escape, not after blur', () => {
    const { host } = mount(tree);
    const row = focusableRow(host, 'a');
    doubleClick(nameElement(host, 'a'));
    press(inputOf(host), 'Enter');
    expect(document.activeElement).toBe(row);
    doubleClick(nameElement(host, 'a'));
    press(inputOf(host), 'Escape');
    expect(document.activeElement).toBe(row);
    doubleClick(nameElement(host, 'a'));
    inputOf(host).dispatchEvent(new FocusEvent('blur'));
    expect(document.activeElement).not.toBe(row);
  });

  it('keeps the focus on the page when a changed name is committed by clicking on blank space', () => {
    const { host, editor } = mount(tree);
    focusableRow(host, 'a');
    // La ligne est sélectionnée (le double-clic sélectionne) : la sélection a une ligne à refocaliser.
    editor.getService('layers.selection')?.select(['a']);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.focus();
    input.value = 'Renommé';

    // Un clic hors de la liste : appui, puis vrai blur du navigateur (validation, saisie détachée, document:changed) puis focusout.
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    input.blur();

    expect(nameOf(editor.document, 'a')).toBe('Renommé');
    expect(document.activeElement).toBe(document.body);
  });

  it('gives the focus to a neighbour row when the row is removed after a Chromium-style blur on removal', () => {
    const { host, editor } = mount(tree);
    focusableRow(host, 'b');
    editor.getService('layers.selection')?.select(['b']);
    doubleClick(nameElement(host, 'b'));
    const input = inputOf(host);
    input.focus();

    // Chromium envoie blur puis focusout (relatedTarget nul) à l'élément retiré, avant de le détacher.
    input.dispatchEvent(new FocusEvent('blur'));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    editor.execute(
      createCommand(
        'Supprimer',
        (d) => ({ ...d, layers: d.layers.filter((node) => node.id !== 'b') }),
        (d) => d
      )
    );

    expect(document.activeElement?.closest('[data-row-id]')?.getAttribute('data-row-id')).toBe('a');
  });

  it('forgets an outside press once its task is over: a later removal refocuses a row', async () => {
    const { host, editor } = mount(tree);
    focusableRow(host, 'b');
    editor.getService('layers.selection')?.select(['b']);
    doubleClick(nameElement(host, 'b'));
    inputOf(host).focus();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));

    editor.execute(createCommand('Supprimer', (d) => ({ ...d, layers: d.layers.filter((node) => node.id !== 'b') }), (d) => d));

    expect(document.activeElement?.closest('[data-row-id]')?.getAttribute('data-row-id')).toBe('a');
  });

  it('gives the focus to a neighbour row when the row being renamed is removed', () => {
    const { host, editor } = mount(tree);
    focusableRow(host, 'b');
    editor.getService('layers.selection')?.select(['b']);
    doubleClick(nameElement(host, 'b'));
    inputOf(host).focus();

    editor.execute(
      createCommand(
        'Supprimer',
        (d) => ({ ...d, layers: d.layers.filter((node) => node.id !== 'b') }),
        (d) => d
      )
    );

    expect(document.activeElement?.closest('[data-row-id]')?.getAttribute('data-row-id')).toBe('a');
  });

  it('ignores a blur of an input that is no longer connected (no command during document:changed)', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.value = 'perdu';
    input.remove();
    input.dispatchEvent(new FocusEvent('blur'));
    expect(nameOf(editor.document, 'a')).toBe('a');
    expect(editor.canUndo).toBe(false);
  });

  it('restores the current name, not the name captured at start, after a cancel', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    editor.getService('layers.rename')?.rename('a', 'Autre');
    expect(nameElement(host, 'a').textContent).not.toBe('Autre');
    press(inputOf(host), 'Escape');
    expect(nameElement(host, 'a').textContent).toBe('Autre');
  });

  it('keeps pointer, drag, keyup and context menu events away from the row', () => {
    const { host } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const types = ['pointerdown', 'dragstart', 'keyup', 'contextmenu', 'mousedown', 'click', 'dblclick'];
    const seen = jest.fn();
    types.forEach((type) => host.addEventListener(type, seen));
    const input = inputOf(host);
    types.forEach((type) => input.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })));
    expect(seen).not.toHaveBeenCalled();
  });

  it('abandons the edit, with no rename, when the parent folder is collapsed', () => {
    const { host, editor, list } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    inputOf(host).value = 'perdu';
    list.setCollapsed('f', true);
    expect(host.querySelector(`.${RENAME_INPUT_CLASS}`)).toBeNull();
    expect(nameOf(editor.document, 'a')).toBe('a');
    editor.undo();
    expect(nameOf(editor.document, 'a')).toBe('a');
    expect(editor.canUndo).toBe(false);
  });
});

describe('IME composition and untrimmed names', () => {
  it('ignores Enter and Escape during a composition', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.value = 'composé';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 229, bubbles: true, cancelable: true }));
    expect(inputOf(host)).toBe(input);
    expect(editor.canUndo).toBe(false);
    press(input, 'Enter');
    expect(nameOf(editor.document, 'a')).toBe('composé');
  });

  it('records nothing when the committed name equals the trimmed current name', () => {
    const spaced = doc([layer('a', { name: ' Hero ' })]);
    const { editor } = mount(spaced);
    expect(editor.execute(createRenameCommand(editor.document, 'a', ' Hero '))).toBe(false);
    expect(editor.canUndo).toBe(false);
    expect(editor.getService('layers.rename')?.rename('a', 'Hero')).toBe(false);
    expect(editor.getService('layers.rename')?.rename('a', 'Zero')).toBe(true);
    editor.undo();
    expect(nameOf(editor.document, 'a')).toBe(' Hero ');
  });
});

describe('IME edge cases', () => {
  it('ignores Enter reported as keyCode 229 with isComposing false (Safari)', () => {
    const { host } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: false, keyCode: 229, bubbles: true, cancelable: true })
    );
    expect(inputOf(host)).toBe(input);
  });

  it('cancels instead of committing when the input blurs during a composition', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.value = 'à moitié';
    input.dispatchEvent(new Event('compositionstart'));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(nameOf(editor.document, 'a')).toBe('a');
    expect(editor.canUndo).toBe(false);
    expect(host.querySelector(`.${RENAME_INPUT_CLASS}`)).toBeNull();
  });

  it('commits on blur once the composition has ended', () => {
    const { host, editor } = mount(tree);
    doubleClick(nameElement(host, 'a'));
    const input = inputOf(host);
    input.value = 'fini';
    input.dispatchEvent(new Event('compositionstart'));
    input.dispatchEvent(new Event('compositionend'));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(nameOf(editor.document, 'a')).toBe('fini');
  });
});
