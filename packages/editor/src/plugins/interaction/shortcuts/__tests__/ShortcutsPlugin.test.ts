// packages/editor/src/plugins/interaction/shortcuts/__tests__/ShortcutsPlugin.test.ts
/**
 * Plugin interaction.shortcuts dans un vrai éditeur : service, portée
 * (racine de l'éditeur, éléments ajoutés, portée globale), champs de
 * saisie, `enabled`, retour `false`, événement émis et destruction.
 */

import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { SHORTCUTS_PLUGIN_ID, ShortcutsPlugin, createShortcutsPlugin } from '../ShortcutsPlugin';
import type { IShortcutsOptions, IShortcutsService, ShortcutTriggeredEvent } from '../types';

interface IHarness {
  readonly editor: IEditor;
  readonly host: HTMLElement;
  readonly shortcuts: IShortcutsService;
  readonly triggered: ShortcutTriggeredEvent[];
}

const editors: IEditor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.innerHTML = '';
});

/** Plugin qui consigne les `shortcut:triggered` (un plugin écoute les autres). */
function recorder(triggered: ShortcutTriggeredEvent[]): EditorPlugin {
  return {
    id: 'test.recorder',
    dependencies: ['interaction.shortcuts'],
    init: (ctx: IEditorContext) => {
      ctx.events.on('shortcut:triggered', (event) => triggered.push(event));
    },
    destroy: () => undefined
  };
}

function setup(options?: IShortcutsOptions): IHarness {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const triggered: ShortcutTriggeredEvent[] = [];
  const editor = createEditor(host, {
    defaultPlugins: options === undefined ? true : [createShortcutsPlugin(options)],
    plugins: [recorder(triggered)]
  });
  editors.push(editor);
  const shortcuts = editor.getService('interaction.shortcuts');
  if (shortcuts === undefined) throw new Error('service interaction.shortcuts absent');
  return { editor, host, shortcuts, triggered };
}

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('interaction.shortcuts plugin', () => {
  it('is part of the default plugin set and provides its service', () => {
    // Act
    const { editor, shortcuts } = setup();

    // Assert
    expect(SHORTCUTS_PLUGIN_ID).toBe('interaction.shortcuts');
    expect(editor.getService(SHORTCUTS_PLUGIN_ID)).toBe(shortcuts);
    expect(Object.isFrozen(shortcuts)).toBe(true);
    expect(shortcuts.isGlobal).toBe(false);
    expect(shortcuts.format('Mod+Shift+z')).toBe('Ctrl+Maj+Z');
  });

  it('runs a shortcut pressed inside the editor, prevents the default and emits shortcut:triggered', () => {
    // Arrange
    const { editor, shortcuts, triggered } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.undo', keys: 'Mod+Z', label: 'Annuler', run });
    const child = document.createElement('span');
    editor.container.appendChild(child);

    // Act
    const event = press(child, { key: 'z', ctrlKey: true });

    // Assert
    expect(run).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
    expect(triggered).toEqual([{ id: 'test.undo', keys: 'Mod+z' }]);
  });

  it('makes the editor root focusable so a click gives it the focus', () => {
    // Act
    const { editor } = setup();

    // Assert
    expect(editor.container.getAttribute('tabindex')).toBe('-1');
  });

  it('ignores keys pressed outside the editor by default', () => {
    // Arrange
    const { shortcuts, triggered } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    // Act
    const event = press(outside, { key: 'F6' });
    press(document.body, { key: 'F6' });

    // Assert
    expect(run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(triggered).toEqual([]);
  });

  it('accepts keys from a scope element given in the options (developer stage)', () => {
    // Arrange
    const stage = document.createElement('canvas');
    document.body.appendChild(stage);
    const { shortcuts } = setup({ scopeElements: [stage] });
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });

    // Act
    press(stage, { key: 'F6' });

    // Assert
    expect(run).toHaveBeenCalledTimes(1);
    expect(stage.getAttribute('tabindex')).toBe('-1');
  });

  it('adds and removes a scope element at run time, restoring its tabindex', () => {
    // Arrange
    const { shortcuts } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });
    const stage = document.createElement('div');
    const focusable = document.createElement('button');
    stage.appendChild(focusable);
    document.body.appendChild(stage);

    // Act
    const remove = shortcuts.addScopeElement(stage);
    const removeFocusable = shortcuts.addScopeElement(focusable);
    press(focusable, { key: 'F6' });
    remove();
    remove();
    removeFocusable();
    press(focusable, { key: 'F6' });

    // Assert
    expect(run).toHaveBeenCalledTimes(1);
    expect(stage.hasAttribute('tabindex')).toBe(false);
    expect(focusable.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps a tabindex the developer had already set', () => {
    // Arrange
    const stage = document.createElement('canvas');
    stage.setAttribute('tabindex', '0');
    document.body.appendChild(stage);
    const { shortcuts } = setup();

    // Act
    shortcuts.addScopeElement(stage)();

    // Assert
    expect(stage.getAttribute('tabindex')).toBe('0');
  });

  it('ignores adding the same scope element twice', () => {
    // Arrange
    const { editor, shortcuts } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });

    // Act
    shortcuts.addScopeElement(editor.container)();
    press(editor.container, { key: 'F6' });

    // Assert
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('refuses a scope element that is not an element', () => {
    // Arrange
    const { shortcuts } = setup();

    // Act / Assert
    expect(() => shortcuts.addScopeElement(null as unknown as HTMLElement)).toThrow(TypeError);
  });

  it('reacts anywhere in the page with the opt-in global scope', () => {
    // Arrange
    const { shortcuts } = setup({ global: true });
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });

    // Act
    press(document.body, { key: 'F6' });
    shortcuts.setGlobal(false);
    press(document.body, { key: 'F6' });

    // Assert
    expect(run).toHaveBeenCalledTimes(1);
    expect(shortcuts.isGlobal).toBe(false);
  });

  it('can turn the global scope on at run time', () => {
    // Arrange
    const { shortcuts } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });

    // Act
    shortcuts.setGlobal(true);
    press(document.body, { key: 'F6' });

    // Assert
    expect(shortcuts.isGlobal).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an input', (): HTMLElement => document.createElement('input')],
    ['a textarea', (): HTMLElement => document.createElement('textarea')],
    ['a select', (): HTMLElement => document.createElement('select')],
    [
      'a contenteditable child',
      (): HTMLElement => {
        const box = document.createElement('div');
        box.setAttribute('contenteditable', 'true');
        const inner = document.createElement('b');
        box.appendChild(inner);
        return inner;
      }
    ]
  ])('leaves keys typed in %s to the field unless allowInEditable', (_name, make) => {
    // Arrange
    const { editor, shortcuts } = setup();
    const field = make();
    editor.container.appendChild(field.parentElement ?? field);
    const blocked = jest.fn();
    const allowed = jest.fn();
    shortcuts.register({ id: 'test.undo', keys: 'Mod+Z', label: 'Annuler', run: blocked });
    shortcuts.register({ id: 'test.escape', keys: 'Escape', label: 'Fermer', run: allowed, allowInEditable: true });

    // Act
    const undo = press(field, { key: 'z', ctrlKey: true });
    press(field, { key: 'Escape' });

    // Assert
    expect(blocked).not.toHaveBeenCalled();
    expect(undo.defaultPrevented).toBe(false);
    expect(allowed).toHaveBeenCalledTimes(1);
  });

  it('skips a disabled shortcut and leaves the key to the browser', () => {
    // Arrange
    const { editor, shortcuts, triggered } = setup();
    let enabled = false;
    const run = jest.fn();
    shortcuts.register({ id: 'test.undo', keys: 'Mod+Z', label: 'Annuler', run, enabled: () => enabled });

    // Act
    const first = press(editor.container, { key: 'z', ctrlKey: true });
    enabled = true;
    const second = press(editor.container, { key: 'z', ctrlKey: true });

    // Assert
    expect(first.defaultPrevented).toBe(false);
    expect(second.defaultPrevented).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(triggered).toHaveLength(1);
  });

  it('does not prevent the default nor emit when run returns false', () => {
    // Arrange
    const { editor, shortcuts, triggered } = setup();
    shortcuts.register({ id: 'test.copy', keys: 'Mod+C', label: 'Copier', run: () => false });

    // Act
    const event = press(editor.container, { key: 'c', ctrlKey: true });

    // Assert
    expect(event.defaultPrevented).toBe(false);
    expect(triggered).toEqual([]);
  });

  it('ignores an event already handled or during an IME composition', () => {
    // Arrange
    const { editor, shortcuts } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });
    const handled = new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true });
    handled.preventDefault();

    // Act
    editor.container.dispatchEvent(handled);
    press(editor.container, { key: 'F6', isComposing: true });
    press(editor.container, { key: 'Shift', shiftKey: true });

    // Assert
    expect(run).not.toHaveBeenCalled();
  });

  it('matches by physical key on a non-latin layout', () => {
    // Arrange
    const { editor, shortcuts } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.undo', keys: 'Mod+Z', label: 'Annuler', run });

    // Act
    press(editor.container, { key: 'я', code: 'KeyZ', ctrlKey: true });

    // Assert
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('exposes conflict detection, lookup and list through the service', () => {
    // Arrange
    const { shortcuts } = setup();
    shortcuts.register({ id: 'frames.keyframes.insert', keys: 'F6', label: 'Insérer une image clé', run: () => undefined });

    // Act / Assert
    expect(shortcuts.lookup('F6')?.id).toBe('frames.keyframes.insert');
    expect(shortcuts.list().map((info) => info.id)).toEqual(['frames.keyframes.insert']);
    expect(() =>
      shortcuts.register({ id: 'other.insert', keys: 'f6', label: 'Autre', run: () => undefined })
    ).toThrow(/Conflit de raccourcis/);
  });

  it('stops listening, removes its tabindex and service on destroy', () => {
    // Arrange
    const { editor, host, shortcuts } = setup();
    const run = jest.fn();
    shortcuts.register({ id: 'test.insert', keys: 'F6', label: 'Insérer', run });
    const stage = document.createElement('canvas');
    document.body.appendChild(stage);
    shortcuts.addScopeElement(stage);
    shortcuts.setGlobal(true);

    // Act
    editor.destroy();
    press(host, { key: 'F6' });
    press(stage, { key: 'F6' });

    // Assert
    expect(run).not.toHaveBeenCalled();
    expect(stage.hasAttribute('tabindex')).toBe(false);
    expect(() => shortcuts.addScopeElement(stage)).toThrow(/détruit/);
  });

  it('undoes its scope when a scope element given in the options is invalid', () => {
    // Arrange
    const host = document.createElement('div');
    document.body.appendChild(host);
    const listen = jest.spyOn(document, 'removeEventListener');

    // Act
    const act = (): IEditor =>
      createEditor(host, {
        defaultPlugins: [createShortcutsPlugin({ scopeElements: [{} as HTMLElement] })]
      });

    // Assert
    expect(act).toThrow();
    expect(listen).toHaveBeenCalledWith('keydown', expect.any(Function));
    listen.mockRestore();
  });

  it('can be destroyed before init without error', () => {
    // Arrange
    const plugin = new ShortcutsPlugin();

    // Act / Assert
    expect(() => plugin.destroy()).not.toThrow();
    expect(plugin.dependencies).toEqual(['core']);
  });
});
