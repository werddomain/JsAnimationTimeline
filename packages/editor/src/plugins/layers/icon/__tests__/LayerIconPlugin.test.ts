// packages/editor/src/plugins/layers/icon/__tests__/LayerIconPlugin.test.ts
import { findNodeById } from '@kazo-ca/timeline-runtime';
import { LAYER_ROW_CLASSES } from '../../list/LayerRowView';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';
import { ICON_MENU_CLASSES } from '../IconMenu';
import { LAYER_ICON_ERRORS } from '../iconCommand';
import { LAYER_ICON_TEXTS } from '../iconChoices';

afterEach(unmountAll);

const source = doc([layer('a'), layer('b', { icon: 'audio' }), folder('f', [layer('c')])]);

function iconOf(h: IListHarness, id: string): string | undefined {
  const node = findNodeById(h.editor.document.layers, id);
  return node !== undefined && node.type === 'layer' ? node.icon : undefined;
}

function iconSpan(h: IListHarness, id: string): HTMLElement {
  const el = h.host.querySelector<HTMLElement>(`[data-row-id="${id}"] .${LAYER_ROW_CLASSES.icon}`);
  if (el === null) throw new Error(`icône ${id} absente`);
  return el;
}

function menu(h: IListHarness): HTMLElement | null {
  return h.host.querySelector<HTMLElement>(`.${ICON_MENU_CLASSES.menu}`);
}

function item(h: IListHarness, choice: string): HTMLButtonElement {
  const el = menu(h)?.querySelector<HTMLButtonElement>(`[data-choice="${choice}"]`);
  if (el === null || el === undefined) throw new Error(`entrée ${choice} absente`);
  return el;
}

function key(target: Element, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

describe('layers.icon service', () => {
  it('sets, undoes and redoes an icon', () => {
    const h = mount(source);
    const service = h.editor.getService('layers.icon');
    expect(service?.setIcon('a', 'camera')).toBe(true);
    expect(iconOf(h, 'a')).toBe('camera');
    expect(iconSpan(h, 'a').dataset.icon).toBe('camera');
    expect(h.editor.undo()).toBe(true);
    expect('icon' in (findNodeById(h.editor.document.layers, 'a') ?? {})).toBe(false);
    expect(h.editor.redo()).toBe(true);
    expect(iconOf(h, 'a')).toBe('camera');
    expect(service?.setIcon('a', undefined)).toBe(true);
    expect(iconOf(h, 'a')).toBeUndefined();
  });

  it('refuses folders, unknown ids, invalid icons and no-ops', () => {
    const h = mount(source);
    const service = h.editor.getService('layers.icon');
    const before = h.editor.document;
    expect(service?.setIcon('f', 'audio')).toBe(false);
    expect(service?.setIcon('zzz', 'audio')).toBe(false);
    expect(service?.setIcon('a', 'jt-secret')).toBe(false);
    expect(service?.setIcon('b', 'audio')).toBe(false);
    expect(service?.setIcon('a', undefined)).toBe(false);
    expect(h.editor.document).toEqual(before);
  });
});

describe('layers.icon chooser', () => {
  it('opens a menu when a layer icon is clicked and picks a built-in icon', () => {
    const h = mount(source);
    iconSpan(h, 'a').click();
    const element = menu(h);
    expect(element?.getAttribute('role')).toBe('dialog');
    expect(element?.getAttribute('aria-label')).toBe("Choisir l'icône");
    const itemList = element?.querySelector('[role="menu"]');
    expect(itemList?.querySelectorAll('[role="menuitemradio"]').length).toBeGreaterThan(5);
    expect(itemList?.querySelector(`.${ICON_MENU_CLASSES.custom}`)).toBeNull();
    expect(element?.querySelector(`:scope > .${ICON_MENU_CLASSES.custom}[role="group"]`)).not.toBeNull();
    item(h, 'sprite').click();
    expect(iconOf(h, 'a')).toBe('sprite');
    expect(menu(h)).toBeNull();
    expect(h.editor.undo()).toBe(true);
    expect(iconOf(h, 'a')).toBeUndefined();
  });

  it('does nothing when a folder icon is clicked', () => {
    const h = mount(source);
    iconSpan(h, 'f').click();
    expect(menu(h)).toBeNull();
    h.editor.getService('layers.icon')?.openChooser('f');
    h.editor.getService('layers.icon')?.openChooser('zzz');
    expect(menu(h)).toBeNull();
  });

  it('ignores clicks outside the icon', () => {
    const h = mount(source);
    h.host.querySelector<HTMLElement>(`[data-row-id="a"] .${LAYER_ROW_CLASSES.name}`)?.click();
    expect(menu(h)).toBeNull();
  });

  it('removes the icon with the default entry', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('b');
    expect(item(h, 'audio').dataset.current).toBe('true');
    item(h, 'default').click();
    expect(iconOf(h, 'b')).toBeUndefined();
    expect(menu(h)).toBeNull();
  });

  it('accepts a custom value and refuses an invalid one with a message', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('a');
    item(h, 'custom').click();
    const input = menu(h)?.querySelector<HTMLInputElement>(`.${ICON_MENU_CLASSES.input}`);
    const error = menu(h)?.querySelector<HTMLElement>(`.${ICON_MENU_CLASSES.error}`);
    if (input === null || input === undefined || error === null || error === undefined) throw new Error('saisie absente');
    input.value = 'jt-secret';
    key(input, 'Enter');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe(LAYER_ICON_ERRORS.invalid);
    expect(menu(h)).not.toBeNull();
    expect(iconOf(h, 'a')).toBeUndefined();
    input.value = ' fa fa-star ';
    key(input, 'Enter');
    expect(iconOf(h, 'a')).toBe('fa fa-star');
    expect(menu(h)).toBeNull();
  });

  it('applies a custom value with the button', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('a');
    item(h, 'custom').click();
    const input = menu(h)?.querySelector<HTMLInputElement>(`.${ICON_MENU_CLASSES.input}`);
    const apply = Array.from(menu(h)?.querySelectorAll('button') ?? []).find((b) => b.textContent === LAYER_ICON_TEXTS.apply);
    if (input === null || input === undefined || apply === undefined) throw new Error('saisie absente');
    input.value = '';
    apply.click();
    expect(menu(h)?.querySelector<HTMLElement>(`.${ICON_MENU_CLASSES.error}`)?.textContent).toBe(LAYER_ICON_ERRORS.empty);
    input.value = './icons/a.png';
    apply.click();
    expect(iconOf(h, 'a')).toBe('./icons/a.png');
  });

  it('closes on Escape and on an outside mousedown, without changes', () => {
    const h = mount(source);
    const service = h.editor.getService('layers.icon');
    service?.openChooser('a');
    key(item(h, 'default'), 'Escape');
    expect(menu(h)).toBeNull();
    service?.openChooser('a');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu(h)).toBeNull();
    service?.openChooser('a');
    menu(h)?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu(h)).not.toBeNull();
    expect(h.editor.canUndo).toBe(false);
  });

  it('moves focus with arrows, Home and End, wrapping around', () => {
    const h = mount(source);
    h.editor.getService('layers.icon')?.openChooser('a');
    const items = Array.from(menu(h)?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    expect(document.activeElement).toBe(items[0]);
    key(items[0] as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    key(items[1] as HTMLElement, 'ArrowUp');
    key(items[0] as HTMLElement, 'ArrowUp');
    expect(document.activeElement).toBe(items[items.length - 1]);
    key(items[items.length - 1] as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    key(items[0] as HTMLElement, 'End');
    expect(document.activeElement).toBe(items[items.length - 1]);
    key(items[items.length - 1] as HTMLElement, 'Home');
    expect(document.activeElement).toBe(items[0]);
  });

  it('keeps a single menu and removes it on destroy', () => {
    const h = mount(source);
    const service = h.editor.getService('layers.icon');
    service?.openChooser('a');
    service?.openChooser('b');
    expect(h.host.querySelectorAll(`.${ICON_MENU_CLASSES.menu}`)).toHaveLength(1);
    h.editor.destroy();
    expect(h.host.querySelector(`.${ICON_MENU_CLASSES.menu}`)).toBeNull();
  });
});
