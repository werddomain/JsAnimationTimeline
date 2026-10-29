// packages/editor/src/plugins/interaction/contextMenu/__tests__/easingActions.test.ts
/** Optional W3 integration targets the context cell and preserves dialog focus. */
import { findNodeById } from '@kazo-ca/timeline-runtime';
import type { ILayer } from '@kazo-ca/timeline-runtime';
import { contextMenuActions } from '../menuActions';
import { active, doc, folder, frameLayer, item, key, mount, openFrame } from './fixtures';

const label = 'Modifier l’accélération';

function tween(id: string, locked = false): ILayer {
  return { id, type: 'layer', name: id, locked, spans: [{ id: `${id}-tween`, start: 1, end: 24, kind: 'tween',
    tracks: { x: [{ frame: 1, value: 0 }, { frame: 24, value: 120 }] } }] };
}

it('omits the entry without the optional W3 service and on ordinary frames', () => {
  const without = mount(doc([tween('a')]), [], { withoutEasing: true });
  expect(without.editor.getService('tweens.easing')).toBeUndefined();
  openFrame(without, 'a', 4);
  expect(document.querySelector('[data-context-action="easing"]')).toBeNull();
  const h = mount(doc([frameLayer('a')]));
  openFrame(h, 'a', 4);
  expect(document.querySelector('[data-context-action="easing"]')).toBeNull();
});

it('opens W3 after closing the menu and applies only the clicked tween within multiple selection', () => {
  const h = mount(doc([tween('a'), tween('b')]));
  const before = h.editor.document;
  const selected = [{ rowId: 'a', frame: 3 }, { rowId: 'b', frame: 6 }];
  h.editor.getService('frames.selection')?.set(selected);
  openFrame(h, 'b', 6);
  item(label).click();
  expect(document.querySelector('[role="menu"]')).toBeNull();
  const preset = document.querySelector<HTMLSelectElement>('[aria-label="Préréglage"]')!;
  expect(active()).toBe(preset);
  expect(h.editor.getService('frames.selection')?.cells()).toEqual(selected);
  preset.value = 'ease-in';
  preset.dispatchEvent(new Event('change', { bubbles: true }));
  const form = preset.closest('form')!;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect(findNodeById(h.editor.document.layers, 'a')).toEqual(before.layers[0]);
  expect(findNodeById(h.editor.document.layers, 'b')).toMatchObject({ spans: [{ easing: 'ease-in' }] });
  expect(h.editor.undo()).toBe(true);
  expect(h.editor.document).toEqual(before);
  expect(h.editor.canUndo).toBe(false);
});

it('rechecks layer and ancestor locks through the actual canSetAt verdict', () => {
  const h = mount(doc([tween('a', true), folder('f', [tween('child')], { locked: true })]));
  const before = h.editor.document;
  for (const id of ['a', 'child']) {
    openFrame(h, id, 4);
    const button = item(label);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-description')).toMatch(/verrouillé/);
    button.click();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(h.editor.document).toEqual(before);
    expect(h.editor.canUndo).toBe(false);
    key(active(), 'Escape');
  }
});

it('uses the current W3 lock verdict when rebuilding actions and leaves history untouched on Escape', () => {
  const h = mount(doc([tween('a')]));
  const target = { kind: 'frames' as const, cell: { rowId: 'a', frame: 4 } };
  expect(contextMenuActions(h.ctx, target).find((action) => action.id === 'easing')?.enabled).toBe(true);
  h.editor.getService('layers.lock')?.setLocked('a', true);
  expect(contextMenuActions(h.ctx, target).find((action) => action.id === 'easing')?.enabled).toBe(false);
  h.editor.undo();
  openFrame(h, 'a', 4);
  item(label).click();
  key(active(), 'Escape');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(active()).toBe(h.ctx.container);
  expect(h.editor.canUndo).toBe(false);
});
