// packages/editor/src/plugins/layers/groups/__tests__/groupCommands.test.ts
/** Commandes de `layers.groups` : exécuter, annuler (arbre identique) et rétablir. */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ICommand } from '../../../../core/commands/ICommand';
import { doc, folder, layer } from '../../list/__tests__/fixtures';
import {
  LayerGroupsCommandLabels,
  createFolderCommand,
  groupSelectionCommand,
  ungroupCommand
} from '../groupCommands';

const source = doc([folder('f', [layer('a'), layer('b')]), layer('c')]);

/** Vérifie do / undo / redo : l'annulation rend le même arbre, le rétablissement le même résultat. */
function roundTrip(command: ICommand, before: ITimelineDocument): ITimelineDocument {
  const after = command.do(before);
  expect(after).not.toBe(before);
  expect(command.undo(after).layers).toBe(before.layers);
  expect(command.undo(after)).toEqual(before);
  expect(command.do(command.undo(after))).toEqual(after);
  return after;
}

describe('createFolderCommand', () => {
  it('inserts "Dossier 1" above the anchor and round-trips', () => {
    const { command, folderId } = createFolderCommand(source, 'b');
    const after = roundTrip(command, source);
    expect(folderId).toBe('folder-1');
    expect(command.label).toBe(LayerGroupsCommandLabels.createFolder);
    expect(JSON.stringify(after.layers)).toContain('"name":"Dossier 1"');
    expect(after.layers[0]).toMatchObject({ id: 'f', children: [{ id: 'a' }, { id: folderId }, { id: 'b' }] });
  });

  it('goes to the top of the tree without anchor', () => {
    const { command, folderId } = createFolderCommand(source, undefined);
    const after = roundTrip(command, source);
    expect(after.layers[0]?.id).toBe(folderId);
  });
});

describe('groupSelectionCommand', () => {
  it('groups the top-most selected nodes and round-trips', () => {
    const created = groupSelectionCommand(source, ['c', 'a']);
    if (created === undefined) throw new Error('commande attendue');
    const after = roundTrip(created.command, source);
    expect(created.command.label).toBe(LayerGroupsCommandLabels.group);
    expect(after.layers).toMatchObject([
      { id: 'f', children: [{ id: created.folderId, children: [{ id: 'a' }, { id: 'c' }] }, { id: 'b' }] }
    ]);
  });

  it('refuses an empty or unknown selection', () => {
    expect(groupSelectionCommand(source, [])).toBeUndefined();
    expect(groupSelectionCommand(source, ['nope'])).toBeUndefined();
  });
});

describe('ungroupCommand', () => {
  it('replaces the folder by its children and round-trips', () => {
    const command = ungroupCommand(source, 'f');
    const after = roundTrip(command, source);
    expect(command.label).toBe(LayerGroupsCommandLabels.ungroup);
    expect(after.layers.map((node) => node.id)).toEqual(['a', 'b', 'c']);
  });

  it('throws for a layer or an unknown id', () => {
    expect(() => ungroupCommand(source, 'c')).toThrow(/introuvable/);
    expect(() => ungroupCommand(source, 'nope')).toThrow(/introuvable/);
  });
});

describe('undo restores the tree seen by do', () => {
  it('uses the document received at execution, not the one at creation', () => {
    const { command } = createFolderCommand(source, undefined);
    const other = doc([layer('z')]);
    const after = command.do(other);
    expect(command.undo(after).layers).toBe(other.layers);
  });
});
