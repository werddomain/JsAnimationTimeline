// packages/editor/src/plugins/toolbar/main/__tests__/ToolbarMainPlugin.test.ts
/**
 * Tests de `toolbar.main` : zone « Scène 1 » dans la zone `toolbar` de la
 * coquille, boutons (infobulle avec raccourci, icône, état actif relu sur
 * les changements d'historique), contrôles libres (rendu et nettoyage),
 * ordre des groupes, retrait et destruction.
 */

import { createCommand } from '../../../../core/commands/createCommand';
import type { IEditorContext } from '../../../../core/context/IEditorContext';
import { ShortcutError } from '../../../interaction/shortcuts/ShortcutError';
import { mountToolbar, toolbarUser } from '../../__tests__/toolbarFixtures';
import { ToolbarError } from '../ToolbarError';
import { DEFAULT_SCENE_NAME, TOOLBAR_CLASS } from '../ToolbarMainPlugin';
import type { IToolbarButtonDefinition } from '../types';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Commande qui change la durée du document (pour remplir l'historique). */
function lengthen(ctx: IEditorContext): void {
  ctx.commands.execute(
    createCommand(
      'Allonger',
      (doc) => ({ ...doc, settings: { ...doc.settings, totalFrames: doc.settings.totalFrames + 1 } }),
      (doc) => ({ ...doc, settings: { ...doc.settings, totalFrames: doc.settings.totalFrames - 1 } })
    )
  );
}

function button(id: string, extra: Partial<IToolbarButtonDefinition> = {}): IToolbarButtonDefinition {
  return { id, label: `Bouton ${id}`, onClick: () => {}, ...extra };
}

function groupsOf(zone: HTMLElement): Array<[string | undefined, string[]]> {
  return Array.from(zone.querySelectorAll<HTMLElement>(`.${TOOLBAR_CLASS}__group`)).map((group) => [
    group.dataset.group,
    Array.from(group.children).map((child) => (child as HTMLElement).dataset.toolbarItem ?? '')
  ]);
}

describe('toolbar.main scene zone', () => {
  it('renders the scene zone with the default name inside the toolbar zone', () => {
    // Act
    const { zone, toolbar } = mountToolbar();

    // Assert
    const root = zone().querySelector(`.${TOOLBAR_CLASS}`);
    expect(root?.parentElement).toBe(zone());
    expect(zone().querySelector(`.${TOOLBAR_CLASS}__sceneName`)?.textContent).toBe(DEFAULT_SCENE_NAME);
    expect(DEFAULT_SCENE_NAME).toBe('Scène 1');
    expect(toolbar().sceneName).toBe('Scène 1');
  });

  it('uses the sceneName option and updates the name through the service', () => {
    // Arrange
    const { zone, toolbar } = mountToolbar([], { main: { sceneName: 'Intro' } });
    const name = (): string | null | undefined => zone().querySelector(`.${TOOLBAR_CLASS}__sceneName`)?.textContent;
    expect(name()).toBe('Intro');

    // Act
    toolbar().setSceneName('Générique');

    // Assert
    expect(name()).toBe('Générique');
    expect(toolbar().sceneName).toBe('Générique');
  });

  it('refuses an empty scene name, in the options and through the service', () => {
    // Arrange
    const { toolbar } = mountToolbar();

    // Act + Assert
    expect(() => toolbar().setSceneName('  ')).toThrow(ToolbarError);
    expect(toolbar().sceneName).toBe('Scène 1');
    expect(() => mountToolbar([], { main: { sceneName: '' } })).toThrow('Le nom de la scène doit être une chaîne non vide.');
  });
});

describe('toolbar.main buttons', () => {
  it('renders a button added during init, with its icon and a tooltip showing the shortcut', () => {
    // Arrange
    const user = toolbarUser('test.user', (ctx) => {
      ctx.services.require('toolbar.main').addButton(button('test.undo', { label: 'Annuler', icon: '↶', shortcut: 'Mod+Z' }));
    });

    // Act
    const { item } = mountToolbar([user]);

    // Assert
    const element = item('test.undo') as HTMLButtonElement;
    expect(element.tagName).toBe('BUTTON');
    expect(element.type).toBe('button');
    expect(element.getAttribute('aria-label')).toBe('Annuler');
    expect(element.title).toBe('Annuler (Ctrl+Z)');
    const icon = element.querySelector(`.${TOOLBAR_CLASS}__icon`);
    expect(icon?.textContent).toBe('↶');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the label when there is no icon, and a plain tooltip without shortcut', () => {
    // Arrange
    const { toolbar, item } = mountToolbar();

    // Act
    toolbar().addButton(button('test.plain', { label: 'Exporter' }));

    // Assert
    const element = item('test.plain') as HTMLButtonElement;
    expect(element.querySelector(`.${TOOLBAR_CLASS}__label`)?.textContent).toBe('Exporter');
    expect(element.title).toBe('Exporter');
  });

  it('refuses an invalid shortcut without adding the button', () => {
    // Arrange
    const { toolbar, item } = mountToolbar();

    // Act + Assert
    expect(() => toolbar().addButton(button('test.bad', { shortcut: 'Mod+' }))).toThrow(ShortcutError);
    expect(item('test.bad')).toBeNull();
    expect(toolbar().items()).toEqual([]);
  });

  it('calls onClick only while the button is enabled', () => {
    // Arrange
    let enabled = true;
    const onClick = jest.fn();
    const { toolbar, item } = mountToolbar();
    toolbar().addButton(button('test.act', { onClick, enabled: () => enabled }));
    const element = item('test.act') as HTMLButtonElement;

    // Act
    element.click();
    enabled = false;
    toolbar().refresh();
    element.click();

    // Assert
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(element.disabled).toBe(true);
  });

  it('re-reads enabled() on history:changed', () => {
    // Arrange
    let ctx: IEditorContext | undefined;
    const user = toolbarUser('test.user', (context) => {
      ctx = context;
      context.services.require('toolbar.main').addButton(
        button('test.undo', { onClick: () => context.commands.undo(), enabled: () => context.commands.canUndo })
      );
    });
    const { item } = mountToolbar([user]);
    const element = item('test.undo') as HTMLButtonElement;
    expect(element.disabled).toBe(true);

    // Act
    lengthen(ctx as IEditorContext);

    // Assert
    expect(element.disabled).toBe(false);
    element.click();
    expect(ctx?.commands.canUndo).toBe(false);
    expect(element.disabled).toBe(true);
  });

  it('re-reads enabled() when a document is loaded', () => {
    // Arrange
    let enabled = false;
    const { toolbar, item, editor } = mountToolbar();
    toolbar().addButton(button('test.load', { enabled: () => enabled }));
    enabled = true;

    // Act
    editor.load(editor.document);

    // Assert
    expect((item('test.load') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('toolbar.main layout', () => {
  it('orders groups and items, before and after the render', () => {
    // Arrange
    const user = toolbarUser('test.user', (ctx) => {
      const toolbar = ctx.services.require('toolbar.main');
      toolbar.addButton(button('history.redo', { group: 'history', order: 20 }));
      toolbar.addButton(button('history.undo', { group: 'history', order: 10 }));
    });
    const { toolbar, zone } = mountToolbar([user]);

    // Act
    toolbar().addButton(button('time.fps', { group: 'time', order: 1 }));
    toolbar().addButton(button('history.extra', { group: 'history', order: 15 }));

    // Assert
    expect(groupsOf(zone())).toEqual([
      ['time', ['time.fps']],
      ['history', ['history.undo', 'history.extra', 'history.redo']]
    ]);
    expect(toolbar().items().map((info) => info.id)).toEqual(['time.fps', 'history.undo', 'history.extra', 'history.redo']);
  });

  it('removes an item and its empty group, once', () => {
    // Arrange
    const { toolbar, zone, item } = mountToolbar();
    toolbar().addButton(button('a.one', { group: 'a' }));
    const remove = toolbar().addButton(button('b.one', { group: 'b' }));

    // Act
    remove();
    remove();

    // Assert
    expect(item('b.one')).toBeNull();
    expect(groupsOf(zone())).toEqual([['a', ['a.one']]]);
    expect(() => toolbar().addButton(button('b.one'))).not.toThrow();
  });
});

describe('toolbar.main controls', () => {
  it('renders a control once in a labelled group and cleans it up on removal', () => {
    // Arrange
    const cleanup = jest.fn();
    const render = jest.fn((element: HTMLElement) => {
      element.appendChild(document.createElement('input'));
      return cleanup;
    });
    const { toolbar, item } = mountToolbar();

    // Act
    const remove = toolbar().addControl({ id: 'test.control', label: 'Cadence', render });

    // Assert
    const element = item('test.control');
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(element);
    expect(element?.getAttribute('role')).toBe('group');
    expect(element?.getAttribute('aria-label')).toBe('Cadence');
    expect(element?.querySelector('input')).not.toBeNull();
    remove();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(item('test.control')).toBeNull();
  });

  it('renders a control added during init when the toolbar renders', () => {
    // Arrange
    const render = jest.fn();
    const user = toolbarUser('test.user', (ctx) => {
      ctx.services.require('toolbar.main').addControl({ id: 'test.early', label: 'Tôt', render });
      expect(render).not.toHaveBeenCalled();
    });

    // Act
    const { item } = mountToolbar([user]);

    // Assert
    expect(render).toHaveBeenCalledWith(item('test.early'));
  });

  it('does not keep a control whose render throws', () => {
    // Arrange
    const { toolbar, item } = mountToolbar();

    // Act + Assert
    expect(() =>
      toolbar().addControl({
        id: 'test.broken',
        label: 'Cassé',
        render: () => {
          throw new Error('boom');
        }
      })
    ).toThrow('boom');
    expect(item('test.broken')).toBeNull();
    expect(toolbar().items()).toEqual([]);
  });
});

describe('toolbar.main destroy', () => {
  it('removes its DOM and service, runs control cleanups, and ignores later removals', () => {
    // Arrange
    const cleanup = jest.fn();
    const { editor, toolbar, zone } = mountToolbar();
    const remove = toolbar().addControl({ id: 'test.control', label: 'Contrôle', render: () => cleanup });
    const host = zone();
    const service = toolbar();

    // Act
    editor.destroy();

    // Assert
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(host.querySelector(`.${TOOLBAR_CLASS}`)).toBeNull();
    expect(() => service.items()).toThrow("n'est pas initialisée");
    expect(() => remove()).not.toThrow();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('toolbar.main failures', () => {
  it('does not keep a button whose enabled() throws when it is added', () => {
    // Arrange
    const { toolbar, item } = mountToolbar();

    // Act + Assert
    expect(() =>
      toolbar().addButton(
        button('test.bad', {
          enabled: () => {
            throw new Error('enabled cassé');
          }
        })
      )
    ).toThrow('enabled cassé');
    expect(item('test.bad')).toBeNull();
    expect(() => toolbar().addButton(button('test.bad'))).not.toThrow();
  });

  it('disables a button whose enabled() throws on refresh, and still refreshes the others', () => {
    // Arrange
    let broken = false;
    let otherEnabled = true;
    const { toolbar, item } = mountToolbar();
    toolbar().addButton(
      button('test.first', {
        enabled: () => {
          if (broken) throw new Error('refresh cassé');
          return true;
        }
      })
    );
    toolbar().addButton(button('test.second', { enabled: () => otherEnabled }));
    broken = true;
    otherEnabled = false;

    // Act + Assert
    expect(() => toolbar().refresh()).toThrow('refresh cassé');
    expect((item('test.first') as HTMLButtonElement).disabled).toBe(true);
    expect((item('test.second') as HTMLButtonElement).disabled).toBe(true);
  });

  it('fails the startup when a control added during init throws in render', () => {
    // Arrange
    const user = toolbarUser('test.user', (ctx) => {
      ctx.services.require('toolbar.main').addControl({
        id: 'test.broken',
        label: 'Cassé',
        render: () => {
          throw new Error('render cassé');
        }
      });
    });

    // Act + Assert
    expect(() => mountToolbar([user])).toThrow('render cassé');
  });

  it('keeps the focus in a control when another item is added before it', () => {
    // Arrange
    const { toolbar } = mountToolbar();
    let input: HTMLInputElement | undefined;
    toolbar().addControl({
      id: 'test.field',
      label: 'Champ',
      group: 'time',
      order: 300,
      render: (element) => {
        input = document.createElement('input');
        element.appendChild(input);
      }
    });
    input?.focus();
    expect(document.activeElement).toBe(input);

    // Act
    toolbar().addButton(button('test.before', { group: 'history', order: 200 }));
    toolbar().addButton(button('test.sameGroup', { group: 'time', order: 299 }));

    // Assert
    expect(document.activeElement).toBe(input);
  });
});
