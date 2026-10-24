// packages/editor/src/plugins/history/undoRedo/__tests__/UndoRedoPlugin.test.ts
/**
 * Tests de `history.undoRedo` : boutons Annuler / Rétablir dans la barre
 * d'outils (infobulles, état actif suivant l'historique), raccourcis Ctrl+Z,
 * Ctrl+Y et Ctrl+Maj+Z, inactivité pendant un regroupement et dans un champ
 * de saisie, place dans le jeu par défaut et retrait en cas d'échec.
 */

import { createCommand } from '../../../../core/commands/createCommand';
import type { ICommand } from '../../../../core/commands/ICommand';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import { defaultPlugins } from '../../../../core/editor/defaultPlugins';
import type { IEditor } from '../../../../core/editor/types';
import { toolbarBasePlugins } from '../../../toolbar/__tests__/toolbarFixtures';
import { HistoryPlugin } from '../../HistoryPlugin';
import { UndoRedoIds, UndoRedoPlugin } from '../UndoRedoPlugin';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Commande qui ajoute une image à la durée du document. */
function lengthen(): ICommand {
  return createCommand(
    'Allonger',
    (doc) => ({ ...doc, settings: { ...doc.settings, totalFrames: doc.settings.totalFrames + 1 } }),
    (doc) => ({ ...doc, settings: { ...doc.settings, totalFrames: doc.settings.totalFrames - 1 } })
  );
}

interface IMounted {
  readonly editor: IEditor;
  readonly undoButton: HTMLButtonElement;
  readonly redoButton: HTMLButtonElement;
  readonly frames: () => number;
}

function mount(extra: readonly EditorPlugin[] = []): IMounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = createEditor(container, {
    defaultPlugins: [...toolbarBasePlugins(), new HistoryPlugin()],
    plugins: extra
  });
  const button = (id: string): HTMLButtonElement => {
    const element = editor.container.querySelector<HTMLButtonElement>(`[data-toolbar-item="${id}"]`);
    if (element === null) throw new Error(`Bouton ${id} absent.`);
    return element;
  };
  return {
    editor,
    undoButton: button(UndoRedoIds.UNDO),
    redoButton: button(UndoRedoIds.REDO),
    frames: () => editor.document.settings.totalFrames
  };
}

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('history.undoRedo buttons', () => {
  it('adds Annuler and Rétablir to the history group, with their shortcuts in the tooltip', () => {
    // Act
    const { undoButton, redoButton } = mount();

    // Assert
    expect(undoButton.getAttribute('aria-label')).toBe('Annuler');
    expect(undoButton.title).toBe('Annuler (Ctrl+Z)');
    expect(redoButton.getAttribute('aria-label')).toBe('Rétablir');
    expect(redoButton.title).toBe('Rétablir (Ctrl+Y)');
    expect(undoButton.closest('[data-group]')?.getAttribute('data-group')).toBe('history');
    expect(undoButton.nextElementSibling).toBe(redoButton);
  });

  it('turns the buttons on and off from the history', () => {
    // Arrange
    const { editor, undoButton, redoButton, frames } = mount();
    expect([undoButton.disabled, redoButton.disabled]).toEqual([true, true]);

    // Act + Assert
    editor.execute(lengthen());
    expect([undoButton.disabled, redoButton.disabled]).toEqual([false, true]);
    undoButton.click();
    expect(frames()).toBe(60);
    expect([undoButton.disabled, redoButton.disabled]).toEqual([true, false]);
    redoButton.click();
    expect(frames()).toBe(61);
    expect([undoButton.disabled, redoButton.disabled]).toEqual([false, true]);
  });
});

describe('history.undoRedo shortcuts', () => {
  it('undoes with Ctrl+Z and redoes with Ctrl+Y or Ctrl+Shift+Z', () => {
    // Arrange
    const { editor, frames } = mount();
    editor.execute(lengthen());
    editor.execute(lengthen());

    // Act + Assert
    const undone = press(editor.container, { key: 'z', ctrlKey: true });
    expect(undone.defaultPrevented).toBe(true);
    expect(frames()).toBe(61);
    press(editor.container, { key: 'z', ctrlKey: true });
    expect(frames()).toBe(60);
    press(editor.container, { key: 'y', ctrlKey: true });
    expect(frames()).toBe(61);
    press(editor.container, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(frames()).toBe(62);
  });

  it('leaves Ctrl+Z to the browser when there is nothing to undo, or in a text field', () => {
    // Arrange
    const { editor, frames } = mount();
    const empty = press(editor.container, { key: 'z', ctrlKey: true });
    editor.execute(lengthen());
    const field = document.createElement('input');
    editor.container.appendChild(field);

    // Act
    const inField = press(field, { key: 'z', ctrlKey: true });

    // Assert
    expect(empty.defaultPrevented).toBe(false);
    expect(inField.defaultPrevented).toBe(false);
    expect(frames()).toBe(61);
  });
});

describe('history.undoRedo while grouping', () => {
  it('disables undo and redo during a drag group, then enables them again', () => {
    // Arrange
    let ctx: IEditorContext | undefined;
    const probe: EditorPlugin = {
      id: 'test.probe',
      dependencies: ['history.undoRedo'],
      init: (context) => (ctx = context),
      destroy: () => {}
    };
    const { editor, undoButton, frames } = mount([probe]);
    editor.execute(lengthen());
    const commands = (ctx as IEditorContext).commands;

    // Act
    commands.beginGroup('Glisser');
    commands.execute(lengthen());
    const duringDrag = press(editor.container, { key: 'z', ctrlKey: true });

    // Assert
    expect(duringDrag.defaultPrevented).toBe(false);
    expect(undoButton.disabled).toBe(true);
    expect(frames()).toBe(62);
    commands.endGroup();
    expect(undoButton.disabled).toBe(false);
    undoButton.click();
    expect(frames()).toBe(61);
  });
});

describe('history epic', () => {
  it('is part of the default set and holds history.undoRedo', () => {
    // Act
    const ids = defaultPlugins().map((plugin) => plugin.id);

    // Assert
    expect(ids).toContain('history');
    expect(new HistoryPlugin().children.map((child) => child.id)).toEqual(['history.undoRedo']);
  });

  it('fails cleanly when another plugin already owns Ctrl+Y', () => {
    // Arrange
    const thief: EditorPlugin = {
      id: 'test.thief',
      dependencies: ['interaction.shortcuts'],
      init: (context) =>
        void context.services.require('interaction.shortcuts').register({
          id: 'test.thief.redo',
          keys: 'Mod+Y',
          label: 'Voleur',
          run: () => {}
        }),
      destroy: () => {}
    };
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Act + Assert
    expect(() =>
      createEditor(container, { defaultPlugins: [...toolbarBasePlugins(), thief, new HistoryPlugin()] })
    ).toThrow();
    expect(container.children.length).toBe(0);
  });
});

describe('history.undoRedo lifecycle', () => {
  /** Éditeur sans l'epic history, avec un plugin qui capture le contexte. */
  function bareContext(extra: readonly EditorPlugin[] = []): { readonly editor: IEditor; readonly ctx: IEditorContext } {
    let ctx: IEditorContext | undefined;
    const probe: EditorPlugin = {
      id: 'test.probe',
      dependencies: ['toolbar.main'],
      init: (context) => (ctx = context),
      destroy: () => {}
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = createEditor(container, { defaultPlugins: [...toolbarBasePlugins(), ...extra], plugins: [probe] });
    return { editor, ctx: ctx as IEditorContext };
  }

  it('removes what it already registered when init fails halfway', () => {
    // Arrange
    const thief: EditorPlugin = {
      id: 'test.thief',
      dependencies: ['interaction.shortcuts'],
      init: (context) =>
        void context.services.require('interaction.shortcuts').register({
          id: 'test.thief.redo',
          keys: 'Mod+Shift+Z',
          label: 'Voleur',
          run: () => {}
        }),
      destroy: () => {}
    };
    const { ctx } = bareContext([thief]);
    const shortcuts = ctx.services.require('interaction.shortcuts');

    // Act + Assert
    expect(() => new UndoRedoPlugin().init(ctx)).toThrow();
    expect(shortcuts.lookup('Mod+Z')).toBeUndefined();
    expect(ctx.services.require('toolbar.main').items()).toEqual([]);
  });

  it('removes its shortcuts and buttons on destroy', () => {
    // Arrange
    const { ctx } = bareContext();
    const plugin = new UndoRedoPlugin();
    plugin.init(ctx);
    expect(ctx.services.require('interaction.shortcuts').lookup('Mod+Y')?.id).toBe(UndoRedoIds.REDO);

    // Act
    plugin.destroy();

    // Assert
    expect(ctx.services.require('interaction.shortcuts').lookup('Mod+Z')).toBeUndefined();
    expect(ctx.services.require('toolbar.main').items()).toEqual([]);
  });

  it('turns both buttons off when a loaded document clears the history', () => {
    // Arrange
    const { editor, undoButton, redoButton } = mount();
    editor.execute(lengthen());

    // Act
    editor.load(editor.document);

    // Assert
    expect([undoButton.disabled, redoButton.disabled]).toEqual([true, true]);
  });
});

describe('history.undoRedo focus', () => {
  it('moves the focus to Rétablir when the last undo disables Annuler, so Ctrl+Y still works', () => {
    // Arrange
    const { editor, undoButton, redoButton, frames } = mount();
    editor.execute(lengthen());
    undoButton.focus();

    // Act
    undoButton.click();

    // Assert
    expect(undoButton.disabled).toBe(true);
    expect(document.activeElement).toBe(redoButton);
    press(document.activeElement as HTMLElement, { key: 'y', ctrlKey: true });
    expect(frames()).toBe(61);
  });

  it('moves the focus back to Annuler when the last redo disables Rétablir', () => {
    // Arrange
    const { editor, undoButton, redoButton } = mount();
    editor.execute(lengthen());
    editor.undo();
    redoButton.focus();

    // Act
    redoButton.click();

    // Assert
    expect(document.activeElement).toBe(undoButton);
  });

  it('leaves the focus alone while the clicked button stays enabled', () => {
    // Arrange
    const { editor, undoButton } = mount();
    editor.execute(lengthen());
    editor.execute(lengthen());
    undoButton.focus();

    // Act
    undoButton.click();

    // Assert
    expect(document.activeElement).toBe(undoButton);
  });
});
