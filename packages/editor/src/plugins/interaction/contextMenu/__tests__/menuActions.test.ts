// packages/editor/src/plugins/interaction/contextMenu/__tests__/menuActions.test.ts
/** Existing frame semantics, optional services and atomic other-layer flag batches. */
import { findNodeById } from '@werddomain/timeline-runtime';
import { contextMenuActions, setOtherFlags } from '../menuActions';
import { doc, folder, layer, mount, open, item, openFrame, frameLayer } from './fixtures';

it('preserves multi-cell selection and replaces it outside; inserts and undoes keyframes', () => {
  const h = mount(doc([frameLayer('a'), frameLayer('b')]));
  const selection = h.editor.getService('frames.selection')!;
  selection.set([{ rowId: 'a', frame: 3 }, { rowId: 'b', frame: 4 }]);
  openFrame(h, 'a', 3);
  expect(selection.cells()).toHaveLength(2);
  item('Insérer une image clé').click();
  expect(selection.keyframes()).toHaveLength(2);
  h.editor.undo();
  expect(selection.keyframes()).toHaveLength(0);
  openFrame(h, 'a', 6);
  expect(selection.cells()).toEqual([{ rowId: 'a', frame: 6 }]);
  item('Insérer une image clé vide').click();
  expect(findNodeById(h.editor.document.layers, 'a')).toMatchObject({ spans: expect.arrayContaining([expect.objectContaining({ start: 6, kind: 'blank' })]) });
});

it('copies and pastes through the existing memory clipboard only', () => {
  const h = mount(doc([frameLayer('a')]));
  openFrame(h, 'a', 1);
  expect(item('Coller les images').getAttribute('aria-disabled')).toBe('true');
  item('Copier les images').click();
  expect(h.editor.getService('frames.clipboard')?.hasContent()).toBe(true);
  openFrame(h, 'a', 5);
  item('Coller les images').click();
  expect(h.editor.getService('frames.selection')?.keyframes()).toEqual(expect.arrayContaining([expect.objectContaining({ frame: 5 })]));
  h.editor.undo();
  expect(h.editor.getService('frames.selection')?.keyframes()).toHaveLength(0);
});

it('routes property deletion separately from a whole tween, including mixed selections', () => {
  const tween = { id: 'a', type: 'layer' as const, name: 'a', spans: [{ id: 'tw', start: 1, end: 24, kind: 'tween' as const,
    tracks: { x: [{ frame: 1, value: 0 }, { frame: 6, value: 40 }, { frame: 24, value: 80 }] } }] };
  const h = mount(doc([tween, frameLayer('b')]));
  const selection = h.editor.getService('frames.selection')!;
  openFrame(h, 'a', 6);
  item("Supprimer l'image clé de propriété").click();
  expect(findNodeById(h.editor.document.layers, 'a')).toMatchObject({ spans: [{ kind: 'tween', tracks: { x: [{ frame: 1 }, { frame: 24 }] } }] });
  h.editor.undo();
  selection.set([{ rowId: 'a', frame: 6 }, { rowId: 'b', frame: 9 }]);
  openFrame(h, 'a', 6);
  item("Supprimer l'image clé").click();
  expect(findNodeById(h.editor.document.layers, 'b')).toMatchObject({ spans: [{ start: 1, end: 24 }] });
  h.editor.undo();
  openFrame(h, 'a', 3);
  item("Supprimer l'interpolation").click();
  expect(findNodeById(h.editor.document.layers, 'a')).toMatchObject({ spans: [{ kind: 'static' }] });
});

it('creates tweens and uses frame insert/remove services with history', () => {
  const h = mount(doc([frameLayer('a')]));
  const original = h.editor.document;
  const selection = h.editor.getService('frames.selection')!;
  selection.set([{ rowId: 'a', frame: 1 }, { rowId: 'a', frame: 9 }]);
  openFrame(h, 'a', 1);
  item('Créer une interpolation de mouvement').click();
  expect(h.editor.getService('tweens.motion')?.tweenAt('a', 3)).toBeDefined();
  h.editor.undo();
  expect(h.editor.document).toEqual(original);
  openFrame(h, 'a', 3);
  item('Insérer une image').click();
  expect(h.editor.document.settings.totalFrames).toBe(25);
  h.editor.undo();
  openFrame(h, 'a', 3);
  item("Supprimer l'image").click();
  expect(h.editor.document).not.toEqual(original);
  h.editor.undo();
  expect(h.editor.document).toEqual(original);
});

it('refuses locked layers and ancestors without document mutation or history', () => {
  const original = doc([frameLayer('locked', true), folder('f', [frameLayer('child')], { locked: true })]);
  const h = mount(original);
  for (const id of ['locked', 'child']) {
    openFrame(h, id, 3);
    const insert = item('Insérer une image clé');
    expect(insert.getAttribute('aria-disabled')).toBe('true');
    expect(insert.getAttribute('aria-description')).toContain('verrouillé');
    insert.click();
    expect(h.editor.document).toEqual(original);
    expect(h.editor.canUndo).toBe(false);
  }
});

it('renames and deletes locked layers, creates layers/folders and groups through services', () => {
  const h = mount(doc([frameLayer('a', true), frameLayer('b')]));
  open(h.list.rowElement('a')!);
  item('Renommer le calque').click();
  const input = h.host.querySelector<HTMLInputElement>('.jt-layer-row__name-input');
  expect(document.activeElement).toBe(input);
  input!.value = 'Renommé';
  input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(findNodeById(h.editor.document.layers, 'a')?.name).toBe('Renommé');
  open(h.list.rowElement('a')!);
  item('Supprimer les calques sélectionnés').click();
  expect(findNodeById(h.editor.document.layers, 'a')).toBeUndefined();
  h.editor.undo();
  open(h.list.rowElement('a')!);
  item('Nouveau calque').click();
  expect(h.editor.document.layers).toHaveLength(3);
  h.editor.undo();
  open(h.list.rowElement('a')!);
  item('Nouveau dossier').click();
  expect(h.editor.document.layers[0].type).toBe('folder');
  h.editor.undo();
  h.editor.getService('layers.selection')?.select(['a', 'b']);
  open(h.list.rowElement('a')!);
  item('Grouper la sélection').click();
  const group = h.editor.document.layers[0];
  expect(group).toMatchObject({ type: 'folder', children: [{ id: 'a' }, { id: 'b' }] });
  open(h.list.rowElement(group.id)!);
  item('Dissocier le dossier').click();
  expect(h.editor.document.layers.map((node) => node.id)).toEqual(['a', 'b']);
});

it('shows, hides and locks flags with one undo and filters genuine noops', () => {
  const h = mount(doc([layer('a'), layer('b'), layer('c', { visible: false, locked: true })]));
  const original = h.editor.document;
  open(h.list.rowElement('a')!);
  item('Masquer les autres calques').click();
  expect(findNodeById(h.editor.document.layers, 'b')?.visible).toBe(false);
  h.editor.undo();
  expect(h.editor.document).toEqual(original);
  expect(h.editor.canUndo).toBe(false);
  open(h.list.rowElement('a')!);
  item('Afficher les autres calques').click();
  expect(findNodeById(h.editor.document.layers, 'c')?.visible).toBe(true);
  h.editor.undo();
  open(h.list.rowElement('a')!);
  item('Masquer le calque').click();
  open(h.list.rowElement('a')!);
  item('Afficher le calque').click();
  open(h.list.rowElement('a')!);
  item('Verrouiller le calque').click();
  open(h.list.rowElement('a')!);
  item('Déverrouiller le calque').click();
});

it('rolls back a partially refused batch without leaving a group or history entry', () => {
  const h = mount(doc([layer('a'), layer('b'), layer('c')]));
  h.editor.getService('layers.selection')?.select(['a']);
  const original = h.editor.document;
  let count = 0;
  h.ctx.events.onCancellable('command:before', (event) => { if (++count === 2) event.cancel(); });
  expect(setOtherFlags(h.ctx, 'locked', true, 'Verrouiller les autres calques')).toBe(false);
  expect(h.editor.document).toEqual(original);
  expect(h.editor.canUndo).toBe(false);
  expect(h.ctx.commands.isGrouping).toBe(false);
});

it('never joins or cancels another operation group and revalidates stale actions', () => {
  const h = mount(doc([frameLayer('a'), frameLayer('b')]));
  open(h.list.rowElement('a')!);
  const stale = item('Nouveau calque');
  h.ctx.commands.beginGroup('Glisser');
  stale.click();
  expect(h.editor.document.layers).toHaveLength(2);
  expect(h.ctx.commands.isGrouping).toBe(true);
  expect(setOtherFlags(h.ctx, 'visible', false, 'Masquer')).toBe(false);
  expect(contextMenuActions(h.ctx, { kind: 'layers', rowId: 'missing' })).toEqual([]);
  h.ctx.commands.cancelGroup();
});
