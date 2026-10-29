// packages/editor/src/plugins/interaction/contextMenu/__tests__/ContextMenuPlugin.test.ts
/** Real editor integration for scoped context menus and undoable actions. */
import { findNodeById } from '@kazo-ca/timeline-runtime';
import { doc, folder, layer, mount, open, item } from './fixtures';

describe('interaction.contextMenu', () => {
  it('keeps the menu open when the context gesture flushes only pending row focus', () => {
    const h = mount(doc([layer('a'), layer('b')]));
    h.editor.getService('layers.selection')?.select(['a', 'b']);
    h.list.rowElement('b')!.focus();
    const row = h.list.rowElement('a')!;
    row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
    row.focus();
    open(row);
    expect(h.editor.getService('layers.selection')?.selected()).toEqual(['a', 'b']);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
  });

  it('preserves selected rows and replaces selection on an outside row before opening', () => {
    const h = mount(doc([layer('a'), layer('b'), layer('c')]));
    const selection = h.editor.getService('layers.selection');
    selection?.select(['a', 'b']);
    expect(open(h.list.rowElement('a')!).defaultPrevented).toBe(true);
    expect(selection?.selected()).toEqual(['a', 'b']);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    open(h.list.rowElement('c')!);
    expect(selection?.selected()).toEqual(['c']);
  });

  it('locks other layers atomically as one history entry and skips unchanged flags', () => {
    const original = doc([layer('a'), layer('b', { locked: true }), folder('f', [layer('c')])]);
    const h = mount(original);
    open(h.list.rowElement('a')!);
    item('Verrouiller les autres calques').click();
    expect(findNodeById(h.editor.document.layers, 'a')?.locked).not.toBe(true);
    expect(findNodeById(h.editor.document.layers, 'c')?.locked).toBe(true);
    expect(h.editor.undo()).toBe(true);
    expect(h.editor.document).toEqual(original);
    expect(h.editor.canUndo).toBe(false);
  });

  it('opens with Shift+F10 and restores connected focus on Escape', () => {
    const h = mount(doc([layer('a')]));
    const row = h.list.rowElement('a')!;
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('preserves native editable menus and ignores surfaces outside the owned editor', () => {
    const h = mount(doc([layer('a')]));
    const input = document.createElement('input');
    h.list.rowElement('a')!.append(input);
    expect(open(input).defaultPrevented).toBe(false);
    expect(open(document.body).defaultPrevented).toBe(false);
    expect(open(h.host.querySelector<HTMLElement>('.jt-toolbar') ?? h.host).defaultPrevented).toBe(false);
  });
});
