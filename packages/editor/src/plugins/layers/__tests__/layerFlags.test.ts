// packages/editor/src/plugins/layers/__tests__/layerFlags.test.ts
/**
 * Commandes de drapeaux partagées (`visible`, `locked`) : un nœud, tous les
 * nœuds de premier niveau, absence de changement et annulation exacte.
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import {
  LOCKED_FLAG,
  VISIBLE_FLAG,
  allSet,
  createSetAllFlagCommand,
  createSetFlagCommand,
  nextAllValue
} from '../layerFlags';
import { doc, folder, layer } from '../list/__tests__/fixtures';

const source = doc([layer('a'), folder('f', [layer('b', { visible: false }), layer('c')], { locked: true })]);

describe('createSetFlagCommand', () => {
  it('sets a nested node flag and undoes to an equal document', () => {
    const command = createSetFlagCommand(source, VISIBLE_FLAG, 'c', false, 'L');
    const done = command.do(source);
    expect(findNodeById(done.layers, 'c')?.visible).toBe(false);
    expect(command.undo(done)).toEqual(source);
    expect(findNodeById(command.undo(done).layers, 'c')).not.toHaveProperty('visible');
    expect(command.label).toBe('L');
  });

  it('restores an explicit original value, not the default', () => {
    const command = createSetFlagCommand(source, VISIBLE_FLAG, 'b', true, 'L');
    const done = command.do(source);
    expect(findNodeById(done.layers, 'b')?.visible).toBe(true);
    expect(findNodeById(command.undo(done).layers, 'b')?.visible).toBe(false);
  });

  it('returns the same document when the effective value already matches', () => {
    expect(createSetFlagCommand(source, VISIBLE_FLAG, 'a', true, 'L').do(source)).toBe(source);
    expect(createSetFlagCommand(source, LOCKED_FLAG, 'f', true, 'L').do(source)).toBe(source);
  });

  it('throws for an unknown node', () => {
    expect(() => createSetFlagCommand(source, LOCKED_FLAG, 'zz', true, 'L')).toThrow('zz');
  });
});

describe('createSetAllFlagCommand', () => {
  it('changes top-level nodes only and undoes exactly', () => {
    const command = createSetAllFlagCommand(source, LOCKED_FLAG, true, 'All');
    const done = command.do(source);
    expect(done.layers.map((node) => node.locked)).toEqual([true, true]);
    expect(findNodeById(done.layers, 'b')).toBe(findNodeById(source.layers, 'b'));
    expect(done.layers[1]).toBe(source.layers[1]);
    expect(command.undo(done)).toEqual(source);
    expect(command.undo(done).layers[0]).not.toHaveProperty('locked');
  });

  it('returns the same document when nothing changes', () => {
    expect(createSetAllFlagCommand(source, VISIBLE_FLAG, true, 'All').do(source)).toBe(source);
    const empty = doc([]);
    expect(createSetAllFlagCommand(empty, VISIBLE_FLAG, false, 'All').do(empty)).toBe(empty);
  });
});

describe('allSet and nextAllValue', () => {
  it('targets "all on" while one node is off, then "all off"', () => {
    const mixed = doc([layer('a'), layer('b', { visible: false })]);
    expect(allSet(mixed, VISIBLE_FLAG)).toBe(false);
    expect(nextAllValue(mixed, VISIBLE_FLAG)).toBe(true);
    const on = doc([layer('a'), layer('b')]);
    expect(allSet(on, VISIBLE_FLAG)).toBe(true);
    expect(nextAllValue(on, VISIBLE_FLAG)).toBe(false);
  });

  it('treats an empty document as not set', () => {
    expect(allSet(doc([]), LOCKED_FLAG)).toBe(false);
  });
});
