// packages/editor/src/plugins/layers/icon/__tests__/LayerIconMenuMouse.test.ts
/**
 * Menu d'icônes à la souris et à l'accessibilité : focus déplacé vers le
 * conteneur (WebKit), libellés français, menuitemradio, re-placement,
 * clics avec modificateur et rechargement du document.
 */

import { LAYER_ROW_CLASSES } from '../../list/LayerRowView';
import { doc, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';
import { ICON_MENU_CLASSES } from '../IconMenu';
import { BUILTIN_ICON_LABELS, builtinIconLabel } from '../iconChoices';
import { BUILTIN_LAYER_ICONS } from '../../list/layerIcon';

afterEach(unmountAll);

const source = doc([layer('a'), layer('b', { icon: 'audio' })]);

function menu(h: IListHarness): HTMLElement {
  const el = h.host.querySelector<HTMLElement>(`.${ICON_MENU_CLASSES.menu}`);
  if (el === null) throw new Error('menu absent');
  return el;
}

function item(h: IListHarness, choice: string): HTMLButtonElement {
  const el = menu(h).querySelector<HTMLButtonElement>(`[data-choice="${choice}"]`);
  if (el === null) throw new Error(`entrée ${choice} absente`);
  return el;
}

function iconOf(h: IListHarness, id: string): string | undefined {
  const node = h.editor.document.layers.find((n) => n.id === id);
  return node !== undefined && node.type === 'layer' ? node.icon : undefined;
}

function iconSpan(h: IListHarness, id: string): HTMLElement {
  const el = h.host.querySelector<HTMLElement>(`[data-row-id="${id}"] .${LAYER_ROW_CLASSES.icon}`);
  if (el === null) throw new Error(`icône ${id} absente`);
  return el;
}

describe('menu mouse handling', () => {
  it('cancels mousedown inside the menu, except in the text field', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('a');
    const onItem = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    item(h, 'audio').dispatchEvent(onItem);
    expect(onItem.defaultPrevented).toBe(true);
    const onBox = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    menu(h).dispatchEvent(onBox);
    expect(onBox.defaultPrevented).toBe(true);
    item(h, 'custom').click();
    const input = menu(h).querySelector<HTMLInputElement>(`.${ICON_MENU_CLASSES.input}`) as HTMLInputElement;
    const onInput = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    input.dispatchEvent(onInput);
    expect(onInput.defaultPrevented).toBe(false);
  });

  it('still picks when WebKit moves the focus to the (focusable) container on mousedown', () => {
    const h = mount(source);
    h.host.tabIndex = -1;
    h.editor.container.tabIndex = -1;
    h.editor.getService('layers.icon')?.openChooser('a');
    const target = item(h, 'sprite');
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    // Focus déplacé vers un ancêtre du menu, comme Safari le fait sur un clic.
    target.dispatchEvent(new FocusEvent('focusout', { relatedTarget: h.editor.container, bubbles: true }));
    expect(h.host.querySelector(`.${ICON_MENU_CLASSES.menu}`)).not.toBeNull();
    target.click();
    expect(iconOf(h, 'a')).toBe('sprite');
  });

  it('keeps the typed value when a non-focusable part of the menu is pressed', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('a');
    item(h, 'custom').click();
    const input = menu(h).querySelector<HTMLInputElement>(`.${ICON_MENU_CLASSES.input}`) as HTMLInputElement;
    input.value = 'my-class';
    input.dispatchEvent(new FocusEvent('focusout', { relatedTarget: h.host, bubbles: true }));
    expect(h.host.querySelector(`.${ICON_MENU_CLASSES.menu}`)).not.toBeNull();
    expect(input.value).toBe('my-class');
  });
});

describe('menu labels and roles', () => {
  it('shows French labels for every built-in icon', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('a');
    Object.keys(BUILTIN_LAYER_ICONS).forEach((name) => {
      expect(BUILTIN_ICON_LABELS[name]).toBeDefined();
      expect(item(h, name).textContent).toContain(builtinIconLabel(name));
    });
    expect(item(h, 'camera').textContent).toContain('Caméra');
    expect(item(h, 'folderOpen').textContent).toContain('Dossier ouvert');
    expect(builtinIconLabel('unknown')).toBe('unknown');
  });

  it('uses menuitemradio with aria-checked and focuses the current entry', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('b');
    const items = Array.from(menu(h).querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    expect(items.filter((el) => el.getAttribute('aria-checked') === 'true')).toEqual([item(h, 'audio')]);
    expect(document.activeElement).toBe(item(h, 'audio'));
  });

  it('re-places the menu when the custom group and the error line appear', () => {
    const h = mount(source);
    const spy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    h.editor.getService('layers.icon')?.openChooser('a');
    const afterOpen = spy.mock.calls.length;
    item(h, 'custom').click();
    const afterCustom = spy.mock.calls.length;
    expect(afterCustom).toBeGreaterThan(afterOpen);
    const input = menu(h).querySelector<HTMLInputElement>(`.${ICON_MENU_CLASSES.input}`) as HTMLInputElement;
    input.value = 'jt-bad';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(spy.mock.calls.length).toBeGreaterThan(afterCustom);
    spy.mockRestore();
  });
});

describe('plugin gestures', () => {
  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])('ignores a click with %o', (modifier) => {
    const h = mount(source);
    iconSpan(h, 'a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...modifier }));
    expect(h.host.querySelector(`.${ICON_MENU_CLASSES.menu}`)).toBeNull();
  });

  it('closes unconditionally on document:loaded, even if the id still exists', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('a');
    h.editor.load(doc([layer('a')]));
    expect(h.host.querySelector(`.${ICON_MENU_CLASSES.menu}`)).toBeNull();
  });
});
