// packages/editor/src/plugins/interaction/contextMenu/__tests__/reviewRegressions.test.ts
/** Review regressions for inherited flags and reentrant focus restoration. */
import { findNodeById } from '@werddomain/timeline-runtime';
import { MenuController } from '../MenuController';
import { active, doc, folder, frameLayer, item, layer, mount, open, openFrame } from './fixtures';

const batches = [
  { label: 'Masquer les autres calques', flag: 'visible' as const, value: false },
  { label: 'Afficher les autres calques', flag: 'visible' as const, value: true },
  { label: 'Verrouiller les autres calques', flag: 'locked' as const, value: true }
];

it.each(batches)('$label protects every selected-child ancestor but changes unselected siblings', ({ label, flag, value }) => {
  const other = (id: string) => layer(id, { [flag]: !value });
  const selected = frameLayer('a');
  const original = doc([folder('outer', [other('outer-sibling'), folder('inner', [selected, other('b')])]), other('c')]);
  const h = mount(original);
  open(h.list.rowElement('a')!);
  item(label).click();
  for (const id of ['outer', 'inner']) expect(findNodeById(h.editor.document.layers, id)?.[flag]).toBeUndefined();
  expect(findNodeById(h.editor.document.layers, 'a')).toEqual(selected);
  for (const id of ['outer-sibling', 'b', 'c']) expect(findNodeById(h.editor.document.layers, id)?.[flag]).toBe(value);
  expect(h.list.row('a')).toMatchObject({ lockedByAncestor: false, hiddenByAncestor: false });
  openFrame(h, 'a', 3);
  expect(item('Insérer une image clé').getAttribute('aria-disabled')).toBeNull();
  item('Insérer une image clé').click();
  expect(h.editor.getService('frames.selection')?.keyframes()).toHaveLength(1);
  h.editor.undo(); // The independent edit succeeds on the protected selected child.
  h.editor.undo(); // The flag batch itself remains exactly one undo entry.
  expect(h.editor.document).toEqual(original);
  expect(h.editor.canUndo).toBe(false);
});

it.each(batches)('$label protects a selected folder subtree and its ancestors without excluding sibling branches', ({ label, flag, value }) => {
  const selected = folder('selected', [layer('leaf', { visible: false }), folder('nested', [layer('deep', { locked: true })])]);
  const original = doc([folder('outer', [selected, layer('sibling', { [flag]: !value })]), layer('other', { [flag]: !value })]);
  const h = mount(original);
  open(h.list.rowElement('selected')!);
  item(label).click();
  expect(findNodeById(h.editor.document.layers, 'outer')?.[flag]).toBeUndefined();
  expect(findNodeById(h.editor.document.layers, 'selected')).toEqual(selected);
  for (const id of ['sibling', 'other']) expect(findNodeById(h.editor.document.layers, id)?.[flag]).toBe(value);
  h.editor.undo();
  expect(h.editor.document).toEqual(original);
  expect(h.editor.canUndo).toBe(false);
});

it('cancels deletion when restoring focus changes selection while the editor stays connected', () => {
  const original = doc([layer('a'), layer('b')]);
  const h = mount(original);
  const row = h.list.rowElement('a')!;
  open(row);
  let commands = 0;
  h.ctx.events.onCancellable('command:before', () => { commands++; });
  row.addEventListener('focus', () => h.editor.getService('layers.selection')?.select(['b']), { once: true });
  item('Supprimer les calques sélectionnés').click();
  expect(h.ctx.container.isConnected).toBe(true);
  expect(h.editor.document).toEqual(original);
  expect(h.editor.getService('layers.selection')?.selected()).toEqual(['b']);
  expect(commands).toBe(0);
  expect(h.editor.canUndo).toBe(false);
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

it('cancels deletion when restoring focus changes the document', () => {
  const original = doc([layer('a'), layer('b')]);
  const h = mount(original);
  const row = h.list.rowElement('a')!;
  open(row);
  let commands = 0;
  h.ctx.events.onCancellable('command:before', () => { commands++; });
  row.addEventListener('focus', () => h.editor.getService('layers.rename')?.rename('b', 'Changed'), { once: true });
  item('Supprimer les calques sélectionnés').click();
  expect(h.editor.document.layers.map((node) => node.id)).toEqual(['a', 'b']);
  expect(findNodeById(h.editor.document.layers, 'b')?.name).toBe('Changed');
  expect(commands).toBe(1); // Only the explicit rename performed by the focus handler.
  h.editor.undo();
  expect(h.editor.document).toEqual(original);
  expect(h.editor.canUndo).toBe(false);
});

it('cancels an old activation when focus restoration opens a new menu', () => {
  const root = document.createElement('button');
  document.body.append(root);
  const controller = new MenuController(root);
  const oldRun = jest.fn();
  const newRun = jest.fn();
  controller.open({ x: 20, y: 20 }, root, () => [{ id: 'old', label: 'Old action', enabled: true, run: oldRun }]);
  const oldButton = active();
  root.addEventListener('focus', () => controller.open({ x: 20, y: 20 }, root,
    () => [{ id: 'new', label: 'New action', enabled: true, run: newRun }]), { once: true });
  oldButton.click();
  expect(oldRun).not.toHaveBeenCalled();
  expect(newRun).not.toHaveBeenCalled();
  expect(active().textContent).toBe('New action');
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
  controller.close(false);
});

it('allows focus-only changes that preserve selected IDs to execute the intended action', () => {
  const h = mount(doc([layer('a'), layer('b')]));
  h.editor.getService('layers.selection')?.select(['a', 'b']);
  h.list.rowElement('b')!.focus();
  open(h.list.rowElement('a')!);
  item('Nouveau calque').click();
  expect(h.editor.document.layers).toHaveLength(3);
  h.editor.undo();
  expect(h.editor.document.layers.map((node) => node.id)).toEqual(['a', 'b']);
});
