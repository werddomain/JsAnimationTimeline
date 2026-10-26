// packages/editor/src/plugins/interaction/contextMenu/__tests__/fixtures.ts
/** Isolated menu harness using the real default services and deterministic geometry. */
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import { createEditor } from '../../../../core/editor/createEditor';
import { defaultPlugins } from '../../../../core/editor/defaultPlugins';
import { ContextMenuPlugin } from '../ContextMenuPlugin';

export { doc, folder, layer, unmountAll } from '../../../layers/list/__tests__/fixtures';

const editors: ReturnType<typeof createEditor>[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => { if (!editor.isDestroyed) editor.destroy(); });
  document.body.replaceChildren();
});

export function mount(data: ITimelineDocument, plugins: readonly EditorPlugin[] = []) {
  const host = document.createElement('div');
  document.body.append(host);
  let ctx: IEditorContext | undefined;
  const capture: EditorPlugin = { id: 'test.contextMenuCapture', dependencies: [], init: (value) => { ctx = value; }, destroy: () => undefined };
  const defaults = defaultPlugins().filter((plugin) => plugin.id !== 'interaction.contextMenu');
  const editor = createEditor(host, { data, defaultPlugins: defaults, plugins: [...plugins, capture, new ContextMenuPlugin()] });
  editors.push(editor);
  const list = editor.getService('layers.list');
  const grid = editor.getService('frames.grid');
  if (ctx === undefined || list === undefined || grid === undefined) throw new Error('Missing menu fixture services.');
  const element = grid.element();
  if (element === undefined) throw new Error('Missing grid element.');
  element.getBoundingClientRect = () => new DOMRect(0, 0, 600, 300);
  return { editor, host, list, grid, ctx };
}

export function open(target: HTMLElement, x = 20, y = 20): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
  target.dispatchEvent(event);
  return event;
}

export function item(label: string): HTMLButtonElement {
  const result = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((button) => button.textContent === label);
  if (result === undefined) throw new Error(`Missing menu item: ${label}`);
  return result;
}

export function key(target: Element, value: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

export function active(): HTMLElement {
  if (!(document.activeElement instanceof HTMLElement)) throw new Error('No active element.');
  return document.activeElement;
}

export function openFrame(h: ReturnType<typeof mount>, id: string, frame: number): MouseEvent {
  const row = h.grid.rows().find((row) => row.id === id);
  if (row === undefined) throw new Error(`Missing row: ${id}`);
  return open(h.grid.element()!, (frame - 1) * h.grid.frameWidth() + 2, row.index * h.grid.rowHeight() + 2);
}

export function frameLayer(id: string, locked = false) {
  return { id, type: 'layer' as const, name: id, locked, spans: [
    { id: `${id}-a`, start: 1, end: 8, kind: 'static' as const, tracks: { x: [{ frame: 1, value: 0 }] } },
    { id: `${id}-b`, start: 9, end: 24, kind: 'static' as const, tracks: { x: [{ frame: 9, value: 80 }] } }
  ] };
}
