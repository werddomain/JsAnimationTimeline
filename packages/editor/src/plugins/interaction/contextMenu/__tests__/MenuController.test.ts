// packages/editor/src/plugins/interaction/contextMenu/__tests__/MenuController.test.ts
/** Menu focus, clamping, invalidation and teardown behavior. */
import { MenuController, menuPosition } from '../MenuController';
import { ContextMenuPlugin } from '../ContextMenuPlugin';
import { active, doc, frameLayer, key, layer, mount, open, openFrame } from './fixtures';

it('clamps menu edges and small viewports', () => {
  expect(menuPosition({ x: 318, y: 475 }, 290, 360, 320, 480)).toEqual({ x: 22, y: 112 });
  expect(menuPosition({ x: -3, y: -4 }, 500, 600, 320, 480)).toEqual({ x: 8, y: 8 });
});

it('uses roving arrows, Home/End and Space/Enter and Escape', () => {
  const h = mount(doc([layer('a')]));
  const row = h.list.rowElement('a')!;
  row.focus();
  key(row, 'ContextMenu');
  const first = active();
  key(first, 'ArrowUp');
  expect(active()).not.toBe(first);
  key(active(), 'Home');
  expect(active()).toBe(first);
  key(active(), 'ArrowDown');
  key(active(), 'End');
  expect(active().tabIndex).toBe(0);
  key(active(), 'Escape');
  expect(active()).toBe(row);
  open(row);
  key(active(), 'Enter');
  expect(h.editor.document.layers).toHaveLength(2);
  open(h.list.rowElement('a')!);
  key(active(), ' ');
  expect(h.editor.document.layers).toHaveLength(3);
});

it('dismisses on outside presses, focus changes, document/selection changes and scroll', () => {
  const h = mount(doc([frameLayer('a')]));
  const row = (): HTMLElement => h.list.rowElement('a')!;
  const expectClosed = (): void => expect(document.querySelector('[role="menu"]')).toBeNull();
  open(row());
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  expectClosed();
  open(row());
  const scroller = h.grid.element()!.parentElement!;
  scroller.scrollTop = 10;
  scroller.dispatchEvent(new Event('scroll'));
  expectClosed();
  open(row());
  window.dispatchEvent(new Event('resize'));
  expectClosed();
  open(row());
  h.editor.getService('layers.selection')?.clear();
  expectClosed();
  openFrame(h, 'a', 3);
  h.editor.getService('frames.selection')?.select({ rowId: 'a', frame: 4 });
  expectClosed();
  open(row());
  h.editor.load(doc([layer('a')]));
  expectClosed();
  open(row());
  h.editor.destroy();
  expectClosed();
  document.body.dispatchEvent(new Event('scroll'));
});

it('ignores a queued scroll notification when its position already preceded menu opening', () => {
  const h = mount(doc([layer('a')]));
  const scroller = h.grid.element()!.parentElement!;
  scroller.scrollTop = 17;
  open(h.list.rowElement('a')!);
  scroller.dispatchEvent(new Event('scroll'));
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  scroller.scrollTop = 18;
  scroller.dispatchEvent(new Event('scroll'));
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

it('distinguishes queued page scroll, real page scroll and scrolling inside the menu', () => {
  const h = mount(doc([layer('a')]));
  const descriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
  try {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 17 });
    open(h.list.rowElement('a')!);
    document.dispatchEvent(new Event('scroll'));
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    menu.dispatchEvent(new Event('scroll'));
    key(active(), 'ArrowLeft');
    expect(menu.isConnected).toBe(true);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 18 });
    document.dispatchEvent(new Event('scroll'));
    expect(menu.isConnected).toBe(false);
    open(h.list.rowElement('a')!);
    const outside = document.createElement('div');
    document.body.append(outside);
    outside.dispatchEvent(new Event('scroll'));
    expect(document.querySelector('[role="menu"]')).toBeNull();
  } finally {
    if (descriptor !== undefined) Object.defineProperty(window, 'scrollY', descriptor);
  }
});

it('cleans a menu in an owner document without an attached browsing window', () => {
  const detachedDocument = document.implementation.createHTMLDocument('Detached menu');
  const root = detachedDocument.createElement('div');
  detachedDocument.body.append(root);
  const controller = new MenuController(root);
  controller.open({ x: 0, y: 0 }, root, () => []);
  expect(detachedDocument.querySelector('[role="menu"]')).not.toBeNull();
  detachedDocument.dispatchEvent(new Event('scroll'));
  controller.close(false);
  expect(detachedDocument.querySelector('[role="menu"]')).toBeNull();
});

it('keeps two editor menus and outside focus isolated, including nested editors', () => {
  const first = mount(doc([layer('a')]));
  const second = mount(doc([layer('b')]));
  first.host.querySelector('.JsTimeLine')!.append(second.host);
  open(first.list.rowElement('a')!);
  open(second.list.rowElement('b')!);
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  first.editor.getService('layers.selection')?.clear();
  expect(active()).toBe(outside);
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(0);
});

it('does not steal focus when the return element was disconnected or outside already focused', () => {
  const root = document.createElement('div');
  const restore = document.createElement('button');
  document.body.append(root, restore);
  const controller = new MenuController(root);
  const run = jest.fn();
  controller.open({ x: 0, y: 0 }, restore, () => [{ id: 'a', label: 'Action', enabled: true, run }]);
  restore.remove();
  key(active(), 'Escape');
  expect(document.querySelector('[role="menu"]')).toBeNull();
  controller.open({ x: 0, y: 0 }, root, () => [{ id: 'a', label: 'Action', enabled: false, reason: 'Indisponible', run }]);
  key(active(), 'Enter');
  expect(run).not.toHaveBeenCalled();
  key(active(), 'Tab');
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

it('removes detached menu listeners so stale DOM references cannot invoke actions', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const controller = new MenuController(root);
  const run = jest.fn();
  controller.open({ x: 20, y: 20 }, root, () => [{ id: 'a', label: 'Action', enabled: true, run }]);
  const stale = active();
  controller.close(false);
  stale.click();
  key(stale, 'Enter');
  expect(run).not.toHaveBeenCalled();
});

it('ignores stale keydown without attempting focus or closing a newly opened menu', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const controller = new MenuController(root);
  const actions = () => [{ id: 'a', label: 'Action', enabled: true, run: jest.fn() }];
  controller.open({ x: 20, y: 20 }, root, actions);
  const stale = active();
  const focus = jest.spyOn(stale, 'focus');
  controller.close(false);
  controller.open({ x: 20, y: 20 }, root, actions);
  const current = active();
  expect(key(stale, 'Home').defaultPrevented).toBe(false);
  expect(focus).not.toHaveBeenCalled();
  expect(active()).toBe(current);
  expect(key(stale, 'Escape').defaultPrevented).toBe(false);
  expect(current.isConnected).toBe(true);
  expect(active()).toBe(current);
  controller.close(false);
});

it('retains native input, textarea, select and contenteditable menus', () => {
  const h = mount(doc([layer('a')]));
  for (const name of ['input', 'textarea', 'select', 'div']) {
    const element = document.createElement(name);
    if (name === 'div') element.setAttribute('contenteditable', 'true');
    h.list.rowElement('a')!.append(element);
    expect(open(element).defaultPrevented).toBe(false);
    expect(key(element, 'F10', { shiftKey: true }).defaultPrevented).toBe(false);
  }
  expect(openFrame(h, 'a', 1).defaultPrevented).toBe(true);
});

it('ignores keyboard frame targets without selection and unsupported targets', () => {
  const h = mount(doc([frameLayer('a')]));
  const grid = h.grid.element()!;
  expect(key(grid, 'ContextMenu').defaultPrevented).toBe(false);
  expect(open(h.host).defaultPrevented).toBe(false);
  expect(open(grid, -20, -20).defaultPrevented).toBe(false);
  expect(key(grid, 'F10').defaultPrevented).toBe(false);
  h.editor.getService('frames.selection')?.select({ rowId: 'a', frame: 4 });
  expect(key(grid, 'ContextMenu').defaultPrevented).toBe(true);
});

it('opens from the focused editor root after a grid click and restores that focus', () => {
  const h = mount(doc([frameLayer('a')]));
  h.editor.getService('frames.selection')?.select({ rowId: 'a', frame: 4 });
  h.ctx.container.focus();
  expect(key(h.ctx.container, 'F10', { shiftKey: true }).defaultPrevented).toBe(true);
  key(active(), 'Escape');
  expect(active()).toBe(h.ctx.container);
});

it('cleans listeners even when event subscription fails during init', () => {
  const h = mount(doc([layer('a')]));
  const plugin = new ContextMenuPlugin();
  const remove = jest.spyOn(h.ctx.container, 'removeEventListener');
  const broken = { ...h.ctx, events: { ...h.ctx.events, on: () => { throw new Error('subscription failure'); } } };
  expect(() => plugin.init(broken)).toThrow('subscription failure');
  expect(remove).toHaveBeenCalledWith('contextmenu', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
  plugin.destroy();
});
