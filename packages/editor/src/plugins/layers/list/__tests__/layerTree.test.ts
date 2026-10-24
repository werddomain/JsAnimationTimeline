// packages/editor/src/plugins/layers/list/__tests__/layerTree.test.ts
import { findNodeById, isFolder } from '@werddomain/timeline-runtime';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import {
  LayerListCommandLabels,
  createSetCollapsedCommand,
  createToggleCollapsedCommand,
  findFolder,
  updateLayerNode
} from '../layerTree';
import { doc, folder, layer } from './fixtures';

function collapsedOf(source: ITimelineDocument, id: string): boolean | undefined {
  const node = findNodeById(source.layers, id);
  if (node === undefined || !isFolder(node)) throw new Error(`pas de dossier ${id}`);
  return node.collapsed;
}

describe('updateLayerNode', () => {
  const source = doc([layer('a'), folder('f', [layer('b'), folder('g', [layer('c')])])]);

  it('replaces a nested node and copies only its path', () => {
    const next = updateLayerNode(source, 'c', (node) => ({ ...node, name: 'C' }));
    expect(findNodeById(next.layers, 'c')?.name).toBe('C');
    expect(next.layers[0]).toBe(source.layers[0]);
    expect(next).not.toBe(source);
    expect(findNodeById(source.layers, 'c')?.name).toBe('c');
  });

  it('returns the same document for an unknown id', () => {
    expect(updateLayerNode(source, 'missing', (node) => ({ ...node, name: 'x' }))).toBe(source);
  });

  it('returns the same document when the updater keeps the node', () => {
    expect(updateLayerNode(source, 'b', (node) => node)).toBe(source);
  });
});

describe('findFolder', () => {
  it('finds folders only', () => {
    const source = doc([folder('f', [layer('a')])]);
    expect(findFolder(source, 'f')?.id).toBe('f');
    expect(findFolder(source, 'a')).toBeUndefined();
    expect(findFolder(source, 'zzz')).toBeUndefined();
  });
});

describe('collapse commands', () => {
  it('collapses a folder and undo removes the missing flag again', () => {
    const source = doc([folder('f', [layer('a')])]);
    const command = createSetCollapsedCommand(source, 'f', true);
    const done = command.do(source);
    expect(collapsedOf(done, 'f')).toBe(true);
    expect(command.label).toBe(LayerListCommandLabels.collapse);
    const undone = command.undo(done);
    expect(collapsedOf(undone, 'f')).toBeUndefined();
    expect('collapsed' in (findNodeById(undone.layers, 'f') ?? {})).toBe(false);
  });

  it('undo restores an explicit original value', () => {
    const source = doc([folder('f', [layer('a')], { collapsed: false })]);
    const command = createSetCollapsedCommand(source, 'f', true);
    expect(collapsedOf(command.undo(command.do(source)), 'f')).toBe(false);
  });

  it('leaves the document unchanged when the folder already has the value', () => {
    const source = doc([folder('f', [layer('a')], { collapsed: true })]);
    expect(createSetCollapsedCommand(source, 'f', true).do(source)).toBe(source);
  });

  it('treats a missing collapsed field as expanded (no change, same document)', () => {
    const source = doc([folder('f', [layer('a')])]);
    expect(createSetCollapsedCommand(source, 'f', false).do(source)).toBe(source);
  });

  it('toggles from the resolved state (missing = expanded)', () => {
    const source = doc([folder('f', [layer('a')]), folder('g', [], { collapsed: true })]);
    const collapse = createToggleCollapsedCommand(source, 'f');
    const expand = createToggleCollapsedCommand(source, 'g');
    expect(collapsedOf(collapse.do(source), 'f')).toBe(true);
    expect(collapsedOf(expand.do(source), 'g')).toBe(false);
    expect(expand.label).toBe(LayerListCommandLabels.expand);
  });

  it('allows collapsing a locked folder', () => {
    const source = doc([folder('f', [layer('a')], { locked: true })]);
    expect(collapsedOf(createSetCollapsedCommand(source, 'f', true).do(source), 'f')).toBe(true);
  });

  it('refuses an unknown id or a layer', () => {
    const source = doc([layer('a')]);
    expect(() => createSetCollapsedCommand(source, 'a', true)).toThrow('introuvable');
    expect(() => createToggleCollapsedCommand(source, 'nope')).toThrow('introuvable');
  });
});
