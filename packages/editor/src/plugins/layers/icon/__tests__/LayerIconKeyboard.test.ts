// packages/editor/src/plugins/layers/icon/__tests__/LayerIconKeyboard.test.ts
/**
 * `layers.icon` au clavier et au focus : Alt+I, retour du focus, fermeture
 * sur Tab ou focus extérieur, touches cachées aux raccourcis, saisie
 * personnalisée, bascule du clic sur l'icône et menu périmé.
 */

import { LAYER_ROW_CLASSES } from '../../list/LayerRowView';
import { doc, folder, layer, mount, unmountAll } from '../../list/__tests__/fixtures';
import type { IListHarness } from '../../list/__tests__/fixtures';
import { ICON_MENU_CLASSES } from '../IconMenu';

afterEach(unmountAll);

const source = doc([layer('a'), layer('b', { icon: 'audio' }), folder('f', [layer('c')])]);

function menu(h: IListHarness): HTMLElement | null {
  return h.host.querySelector<HTMLElement>(`.${ICON_MENU_CLASSES.menu}`);
}

function item(h: IListHarness, choice: string): HTMLButtonElement {
  const el = menu(h)?.querySelector<HTMLButtonElement>(`[data-choice="${choice}"]`);
  if (el === null || el === undefined) throw new Error(`entrée ${choice} absente`);
  return el;
}

function customInput(h: IListHarness): HTMLInputElement {
  const el = menu(h)?.querySelector<HTMLInputElement>(`.${ICON_MENU_CLASSES.input}`);
  if (el === null || el === undefined) throw new Error('saisie absente');
  return el;
}

function iconSpan(h: IListHarness, id: string): HTMLElement {
  const el = h.host.querySelector<HTMLElement>(`[data-row-id="${id}"] .${LAYER_ROW_CLASSES.icon}`);
  if (el === null) throw new Error(`icône ${id} absente`);
  return el;
}

function row(h: IListHarness, id: string): HTMLElement {
  const el = h.list.rowElement(id);
  if (el === undefined) throw new Error(`ligne ${id} absente`);
  el.tabIndex = 0;
  return el;
}

function key(target: Element, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

function altI(target: Element, extra: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'i',
    code: 'KeyI',
    altKey: true,
    bubbles: true,
    cancelable: true,
    ...extra
  });
  target.dispatchEvent(event);
  return event;
}

function open(h: IListHarness, id: string): void {
  h.editor.getService('layers.icon')?.openChooser(id);
}

describe('layers.icon keyboard and focus', () => {
  it('opens the chooser with Alt+I on a layer row, not on a folder or with Ctrl', () => {
    const h = mount(source);
    const onFolder = altI(row(h, 'f'));
    expect(menu(h)).toBeNull();
    expect(onFolder.defaultPrevented).toBe(false);
    altI(row(h, 'a'), { ctrlKey: true });
    expect(menu(h)).toBeNull();
    const opened = altI(row(h, 'a'));
    expect(menu(h)).not.toBeNull();
    expect(opened.defaultPrevented).toBe(true);
  });

  it('opens from inside the row', () => {
    const h = mount(source);
    const name = h.host.querySelector(`[data-row-id="b"] .${LAYER_ROW_CLASSES.name}`);
    if (name === null) throw new Error('nom absent');
    altI(name);
    expect(item(h, 'audio').dataset.current).toBe('true');
  });

  it.each(['pick', 'Escape', 'Tab'])('returns focus to the row after %s', (how) => {
    const h = mount(source);
    const target = row(h, 'a');
    target.focus();
    altI(target);
    expect(document.activeElement).toBe(item(h, 'default'));
    if (how === 'pick') item(h, 'sprite').click();
    else key(item(h, 'default'), how);
    expect(menu(h)).toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('does not restore the focus after an outside mousedown', () => {
    const h = mount(source);
    const target = row(h, 'a');
    target.focus();
    altI(target);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu(h)).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  it('closes when the focus leaves the menu, without restoring it', () => {
    const h = mount(source);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const target = row(h, 'a');
    target.focus();
    altI(target);
    item(h, 'default').dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside, bubbles: true }));
    expect(menu(h)).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  it('keeps focus moves inside the menu from closing it', () => {
    const h = mount(source);
    open(h, 'a');
    item(h, 'default').dispatchEvent(new FocusEvent('focusout', { relatedTarget: item(h, 'audio'), bubbles: true }));
    expect(menu(h)).not.toBeNull();
  });

  it('hides every keydown of the menu from document listeners', () => {
    const h = mount(source);
    const seen = jest.fn();
    document.addEventListener('keydown', seen);
    open(h, 'a');
    key(item(h, 'default'), 'ArrowDown');
    item(h, 'custom').click();
    key(customInput(h), 'x');
    key(customInput(h), 'Escape');
    document.removeEventListener('keydown', seen);
    expect(seen).not.toHaveBeenCalled();
  });

  it('prefills the custom field and leaves it with the arrows', () => {
    const h = mount(doc([layer('a', { icon: 'fa fa-star' })]));
    open(h, 'a');
    item(h, 'custom').click();
    const input = customInput(h);
    expect(input.value).toBe('fa fa-star');
    key(input, 'ArrowDown');
    expect(document.activeElement).toBe(item(h, 'default'));
    input.focus();
    key(input, 'ArrowUp');
    expect(document.activeElement).toBe(item(h, 'custom'));
  });

  it('leaves the custom field empty for a built-in icon', () => {
    const h = mount(source);
    open(h, 'b');
    expect(customInput(h).value).toBe('');
  });
});

describe('layers.icon toggle and stale menu', () => {
  it('closes on a second click on the same icon and still lets the click reach the row', () => {
    const h = mount(source);
    const rowClick = jest.fn();
    row(h, 'a').addEventListener('click', rowClick);
    iconSpan(h, 'a').click();
    expect(menu(h)).not.toBeNull();
    iconSpan(h, 'a').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu(h)).not.toBeNull();
    iconSpan(h, 'a').click();
    expect(menu(h)).toBeNull();
    expect(rowClick).toHaveBeenCalledTimes(2);
  });

  it('switches the menu to another layer icon', () => {
    const h = mount(source);
    iconSpan(h, 'a').click();
    iconSpan(h, 'b').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    iconSpan(h, 'b').click();
    expect(h.host.querySelectorAll(`.${ICON_MENU_CLASSES.menu}`)).toHaveLength(1);
    expect(item(h, 'audio').dataset.current).toBe('true');
  });

  it('closes when its layer disappears or becomes a folder', () => {
    const h = mount(source);
    open(h, 'a');
    h.editor.load(doc([layer('b')]));
    expect(menu(h)).toBeNull();
    open(h, 'b');
    h.editor.load(doc([folder('b', [])]));
    expect(menu(h)).toBeNull();
  });

  it('stays open when an unrelated change happens', () => {
    const h = mount(source);
    open(h, 'a');
    h.editor.getService('layers.color')?.setColor('b', '#112233');
    expect(menu(h)).not.toBeNull();
  });
});
