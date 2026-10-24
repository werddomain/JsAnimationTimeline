// packages/editor/src/plugins/layout/shell/__tests__/LayoutShellPlugin.test.ts
/**
 * Tests de `layout.shell` : grille des zones (ordre, classes, rôles,
 * libellés), emplacements de rendu utilisables par les plugins suivants,
 * service `layout.shell`, absence de zone de scène et nettoyage.
 */

import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import { cleanBody, createContainer, mountLayout } from '../../__tests__/layoutFixtures';
import { LayoutShellPlugin } from '../LayoutShellPlugin';
import { LAYOUT_SLOTS, LAYOUT_ZONES, SHELL_CLASS, ZONE_CLASS, ZONE_LABELS } from '../layoutSlots';

afterEach(cleanBody);

/** Plugin qui écrit `text` dans l'emplacement `slot`. */
function writer(id: string, slot: string, text: string): EditorPlugin {
  return {
    id,
    dependencies: ['layout.shell'],
    slot,
    init: () => {},
    render: (element) => {
      element.textContent = text;
    },
    destroy: () => {}
  };
}

/** Plugin qui capture le contexte reçu dans `init`. */
function probe(): { readonly plugin: EditorPlugin; readonly ctx: () => IEditorContext } {
  let captured: IEditorContext | undefined;
  const plugin: EditorPlugin = {
    id: 'test.probe',
    dependencies: ['layout.shell'],
    init: (context) => (captured = context),
    destroy: () => {}
  };
  return {
    plugin,
    ctx: () => {
      if (captured === undefined) throw new Error('Contexte non capturé.');
      return captured;
    }
  };
}

describe('layout.shell grid', () => {
  it('renders one grid with every zone, in reading order, inside the editor root', () => {
    // Act
    const { editor } = mountLayout();

    // Assert
    const shell = editor.container.querySelector(`.${SHELL_CLASS}`);
    expect(shell?.parentElement).toBe(editor.container);
    const zones = Array.from(shell?.children ?? []).map((child) => (child as HTMLElement).dataset.zone);
    expect(zones).toEqual([...LAYOUT_ZONES]);
  });

  it('gives each zone its classes, an accessible French label and a role', () => {
    // Act
    const { zone } = mountLayout();

    // Assert
    LAYOUT_ZONES.forEach((name) => {
      const element = zone(name);
      expect(element.classList.contains(ZONE_CLASS)).toBe(true);
      expect(element.classList.contains(`${ZONE_CLASS}--${name}`)).toBe(true);
      expect(element.getAttribute('aria-label')).toBe(ZONE_LABELS[name]);
    });
    expect(zone('toolbar').getAttribute('role')).toBe('toolbar');
    expect(zone('frames').getAttribute('role')).toBe('group');
  });

  it('holds the timeline only: no stage zone and nothing outside the editor root', () => {
    // Act
    const { container, editor } = mountLayout();

    // Assert
    expect(LAYOUT_ZONES).not.toContain('stage');
    expect(editor.container.querySelector('[data-zone="stage"], .jt-zone--stage')).toBeNull();
    expect(Array.from(container.children)).toEqual([editor.container]);
  });

  it('names every slot after its zone, in frozen tables', () => {
    // Assert
    LAYOUT_ZONES.forEach((name) => expect(LAYOUT_SLOTS[name]).toBe(`layout.${name}`));
    expect(Object.isFrozen(LAYOUT_SLOTS)).toBe(true);
    expect(Object.isFrozen(LAYOUT_ZONES)).toBe(true);
  });
});

describe('layout.shell slots', () => {
  it('lets the next plugins render into each zone through LAYOUT_SLOTS', () => {
    // Arrange
    const writers = LAYOUT_ZONES.map((name) => writer(`test.${name}`, LAYOUT_SLOTS[name], `contenu ${name}`));

    // Act
    const { zone } = mountLayout(writers);

    // Assert
    LAYOUT_ZONES.forEach((name) => expect(zone(name).textContent).toBe(`contenu ${name}`));
  });

  it('defines the slots on the zone elements', () => {
    // Arrange
    const { plugin, ctx } = probe();

    // Act
    const { zone } = mountLayout([plugin]);

    // Assert
    LAYOUT_ZONES.forEach((name) => expect(ctx().slots.get(LAYOUT_SLOTS[name])).toBe(zone(name)));
  });

  it('publishes the zones through the layout.shell service', () => {
    // Act
    const { editor, zone } = mountLayout();
    const api = editor.getService('layout.shell');

    // Assert
    expect(api?.element()).toBe(editor.container.querySelector(`.${SHELL_CLASS}`));
    LAYOUT_ZONES.forEach((name) => expect(api?.zone(name)).toBe(zone(name)));
  });
});

describe('layout.shell lifecycle', () => {
  it('removes its grid and its slots on destroy, and its service then reports nothing', () => {
    // Arrange
    const { plugin, ctx } = probe();
    const { editor } = mountLayout([plugin]);
    const api = editor.getService('layout.shell');
    const root = editor.container;

    // Act
    editor.destroy();

    // Assert
    expect(root.querySelector(`.${SHELL_CLASS}`)).toBeNull();
    LAYOUT_ZONES.forEach((name) => expect(ctx().slots.has(LAYOUT_SLOTS[name])).toBe(false));
    expect(api?.element()).toBeUndefined();
    expect(api?.zone('frames')).toBeUndefined();
  });

  it('reports no zone before it is rendered', () => {
    // Arrange
    let seen: HTMLElement | undefined | null = null;
    const early: EditorPlugin = {
      id: 'test.early',
      dependencies: ['layout.shell'],
      init: (ctx) => {
        seen = ctx.services.require('layout.shell').zone('frames');
      },
      destroy: () => {}
    };

    // Act
    mountLayout([early]);

    // Assert
    expect(seen).toBeUndefined();
  });

  it('refuses to render before init', () => {
    // Arrange
    const plugin = new LayoutShellPlugin();

    // Act
    const act = (): void => plugin.render(document.createElement('div'));

    // Assert
    expect(act).toThrow('layout.shell : render appelé avant init.');
  });

  it('can be started with its epic alone, without layout.scrollSync', () => {
    // Arrange
    const epic: EditorPlugin = { id: 'layout', dependencies: [], init: () => {}, destroy: () => {} };

    // Act
    const editor = createEditor(createContainer(), {
      defaultPlugins: false,
      plugins: [epic, new LayoutShellPlugin()]
    });

    // Assert
    expect(editor.container.querySelectorAll(`.${ZONE_CLASS}`)).toHaveLength(LAYOUT_ZONES.length);
  });
});
