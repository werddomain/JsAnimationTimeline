// packages/editor/src/plugins/layers/selection/__tests__/keyboardAndClick.test.ts
/**
 * Fonctions pures de souris et de clavier : `resolveClick` (modificateurs) et
 * `resolveKey` (flèches, Début / Fin, repli, Espace, Ctrl+A, Échap).
 */

import { resolveClick } from '../clickIntent';
import { resolveKey } from '../keyboardNav';
import type { KeyInput, NavContext, NavRow } from '../keyboardNav';

describe('resolveClick', () => {
  it('replaces the selection on a plain click', () => {
    expect(resolveClick({ id: 'a', ctrl: false, shift: false }, 'x')).toEqual({ kind: 'replace', id: 'a' });
  });

  it('toggles on Ctrl / Cmd click', () => {
    expect(resolveClick({ id: 'a', ctrl: true, shift: false }, undefined)).toEqual({ kind: 'toggle', id: 'a' });
  });

  it('selects a range from the anchor on Shift click, additive with Ctrl', () => {
    expect(resolveClick({ id: 'c', ctrl: false, shift: true }, 'a')).toEqual({
      kind: 'range',
      from: 'a',
      to: 'c',
      additive: false
    });
    expect(resolveClick({ id: 'c', ctrl: true, shift: true }, 'a')).toEqual({
      kind: 'range',
      from: 'a',
      to: 'c',
      additive: true
    });
  });

  it('acts like a plain click on Shift click without anchor', () => {
    expect(resolveClick({ id: 'c', ctrl: false, shift: true }, undefined)).toEqual({ kind: 'replace', id: 'c' });
  });

  it('clears on a plain click in the empty area and ignores it with a modifier', () => {
    expect(resolveClick({ id: undefined, ctrl: false, shift: false }, 'a')).toEqual({ kind: 'clear' });
    expect(resolveClick({ id: undefined, ctrl: true, shift: false }, 'a')).toBeUndefined();
    expect(resolveClick({ id: undefined, ctrl: false, shift: true }, 'a')).toBeUndefined();
  });
});

const ROWS: readonly NavRow[] = [
  { id: 'f', isFolder: true, collapsed: false },
  { id: 'a', parentId: 'f', isFolder: false, collapsed: false },
  { id: 'g', parentId: 'f', isFolder: true, collapsed: true },
  { id: 'e', isFolder: true, collapsed: false },
  { id: 'c', isFolder: false, collapsed: false }
];

function key(name: string, mods: Partial<Omit<KeyInput, 'key'>> = {}): KeyInput {
  return { key: name, ctrl: false, shift: false, alt: false, ...mods };
}

function context(current: string | undefined, hasSelection = true): NavContext {
  return { rows: ROWS, current, hasSelection };
}

describe('resolveKey vertical moves', () => {
  it('moves down and up, replacing the selection', () => {
    expect(resolveKey(key('ArrowDown'), context('f'))).toEqual({ kind: 'move', to: 'a', mode: 'replace', additive: false });
    expect(resolveKey(key('ArrowUp'), context('g'))).toEqual({ kind: 'move', to: 'a', mode: 'replace', additive: false });
  });

  it('stays on the first and last rows (no wrap)', () => {
    expect(resolveKey(key('ArrowUp'), context('f'))).toMatchObject({ to: 'f' });
    expect(resolveKey(key('ArrowDown'), context('c'))).toMatchObject({ to: 'c' });
  });

  it('starts from the first row going down and the last going up when nothing is focused', () => {
    expect(resolveKey(key('ArrowDown'), context(undefined))).toMatchObject({ to: 'f' });
    expect(resolveKey(key('ArrowUp'), context(undefined))).toMatchObject({ to: 'c' });
  });

  it('extends with Shift, additively with Ctrl+Shift, and only focuses with Ctrl', () => {
    expect(resolveKey(key('ArrowDown', { shift: true }), context('f'))).toEqual({
      kind: 'move',
      to: 'a',
      mode: 'extend',
      additive: false
    });
    expect(resolveKey(key('ArrowDown', { shift: true, ctrl: true }), context('f'))).toMatchObject({
      mode: 'extend',
      additive: true
    });
    expect(resolveKey(key('ArrowDown', { ctrl: true }), context('f'))).toMatchObject({ mode: 'focus' });
  });

  it('goes to the first and last rows with Home and End', () => {
    expect(resolveKey(key('Home'), context('c'))).toMatchObject({ to: 'f', mode: 'replace' });
    expect(resolveKey(key('End'), context('f'))).toMatchObject({ to: 'c', mode: 'replace' });
    expect(resolveKey(key('End', { shift: true }), context('f'))).toMatchObject({ to: 'c', mode: 'extend' });
    expect(resolveKey(key('Home', { ctrl: true }), context('c'))).toMatchObject({ to: 'f', mode: 'focus' });
  });

  it('does nothing without rows and ignores Alt combinations', () => {
    expect(resolveKey(key('ArrowDown'), { rows: [], current: undefined, hasSelection: false })).toBeUndefined();
    expect(resolveKey(key('Home'), { rows: [], current: undefined, hasSelection: false })).toBeUndefined();
    expect(resolveKey(key('ArrowDown', { alt: true }), context('f'))).toBeUndefined();
  });
});

describe('resolveKey tree moves', () => {
  it('collapses an expanded folder on Left', () => {
    expect(resolveKey(key('ArrowLeft'), context('f'))).toEqual({ kind: 'collapse', id: 'f' });
  });

  it('goes to the parent on Left from a child or a collapsed child folder', () => {
    expect(resolveKey(key('ArrowLeft'), context('a'))).toMatchObject({ kind: 'move', to: 'f' });
    expect(resolveKey(key('ArrowLeft'), context('g'))).toMatchObject({ kind: 'move', to: 'f' });
  });

  it('does nothing on Left from a top-level layer or collapsed top-level folder', () => {
    expect(resolveKey(key('ArrowLeft'), context('c'))).toBeUndefined();
    const rows: readonly NavRow[] = [{ id: 'z', isFolder: true, collapsed: true }];
    expect(resolveKey(key('ArrowLeft'), { rows, current: 'z', hasSelection: false })).toBeUndefined();
  });

  it('expands a collapsed folder on Right', () => {
    expect(resolveKey(key('ArrowRight'), context('g'))).toEqual({ kind: 'expand', id: 'g' });
  });

  it('goes to the first child on Right from an expanded folder', () => {
    expect(resolveKey(key('ArrowRight'), context('f'))).toMatchObject({ kind: 'move', to: 'a' });
  });

  it('does nothing on Right from a layer or an expanded empty folder', () => {
    expect(resolveKey(key('ArrowRight'), context('a'))).toBeUndefined();
    expect(resolveKey(key('ArrowRight'), context('e'))).toBeUndefined();
  });

  it('ignores Left and Right with Ctrl or Shift, and without a current row', () => {
    expect(resolveKey(key('ArrowLeft', { ctrl: true }), context('f'))).toBeUndefined();
    expect(resolveKey(key('ArrowRight', { shift: true }), context('g'))).toBeUndefined();
    expect(resolveKey(key('ArrowLeft'), context(undefined))).toBeUndefined();
  });
});

describe('resolveKey other keys', () => {
  it('toggles the current row on Space and Ctrl+Space', () => {
    expect(resolveKey(key(' '), context('a'))).toEqual({ kind: 'toggleRow', id: 'a' });
    expect(resolveKey(key(' ', { ctrl: true }), context('a'))).toEqual({ kind: 'toggleRow', id: 'a' });
    expect(resolveKey(key(' '), context(undefined))).toBeUndefined();
    expect(resolveKey(key(' ', { shift: true }), context('a'))).toBeUndefined();
  });

  it('selects all on Ctrl+A only', () => {
    expect(resolveKey(key('a', { ctrl: true }), context('a'))).toEqual({ kind: 'selectAll' });
    expect(resolveKey(key('A', { ctrl: true }), context(undefined))).toEqual({ kind: 'selectAll' });
    expect(resolveKey(key('a'), context('a'))).toBeUndefined();
    expect(resolveKey(key('a', { ctrl: true, shift: true }), context('a'))).toBeUndefined();
  });

  it('clears on Escape only when something is selected', () => {
    expect(resolveKey(key('Escape'), context('a', true))).toEqual({ kind: 'clear' });
    expect(resolveKey(key('Escape'), context('a', false))).toBeUndefined();
  });

  it('ignores other keys', () => {
    expect(resolveKey(key('Enter'), context('a'))).toBeUndefined();
    expect(resolveKey(key('x'), context('a'))).toBeUndefined();
  });
});
