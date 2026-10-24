// packages/editor/src/plugins/interaction/shortcuts/__tests__/ShortcutRegistry.test.ts
/**
 * Registre des raccourcis : validation, conflits, recherche et retrait.
 */

import { ShortcutError } from '../ShortcutError';
import type { ShortcutErrorCode } from '../ShortcutError';
import { ShortcutRegistry } from '../ShortcutRegistry';
import type { IShortcutDefinition } from '../types';

function shortcut(id: string, keys: string | readonly string[], label = id): IShortcutDefinition {
  return { id, keys, label, run: () => undefined };
}

function errorOf(act: () => unknown): ShortcutError {
  try {
    act();
  } catch (error) {
    if (error instanceof ShortcutError) return error;
    throw error;
  }
  throw new Error('aucune erreur levée');
}

describe('ShortcutRegistry', () => {
  it('registers a shortcut and finds it by its keys', () => {
    // Arrange
    const registry = new ShortcutRegistry();

    // Act
    registry.register(shortcut('history.undoRedo.undo', 'Mod+Z', 'Annuler'));

    // Assert
    expect(registry.lookup('Ctrl+z')).toEqual({
      id: 'history.undoRedo.undo',
      label: 'Annuler',
      keys: ['Mod+z'],
      display: ['Ctrl+Z']
    });
    expect(registry.match('Mod+z')?.info.id).toBe('history.undoRedo.undo');
    expect(registry.lookup('Mod+Y')).toBeUndefined();
  });

  it('accepts several keys and drops duplicates', () => {
    // Arrange
    const registry = new ShortcutRegistry();

    // Act
    registry.register(shortcut('history.undoRedo.redo', ['Mod+Y', 'Ctrl+y', 'Mod+Shift+Z']));

    // Assert
    expect(registry.list()[0]?.keys).toEqual(['Mod+y', 'Mod+Shift+z']);
    expect(registry.list()[0]?.display).toEqual(['Ctrl+Y', 'Ctrl+Maj+Z']);
  });

  it('refuses a combination already owned by another shortcut and names both', () => {
    // Arrange
    const registry = new ShortcutRegistry();
    registry.register(shortcut('frames.keyframes.insert', 'F6', 'Insérer une image clé'));

    // Act
    const error = errorOf(() => registry.register(shortcut('playback.controls.step', ['F7', 'f6'])));

    // Assert
    expect(error.code).toBe('conflict');
    expect(error.shortcutId).toBe('playback.controls.step');
    expect(error.conflictsWith).toBe('frames.keyframes.insert');
    expect(error.message).toContain('« F6 »');
    expect(error.message).toContain('Insérer une image clé');
    // Rien n'est enregistré pour le raccourci refusé.
    expect(registry.lookup('F7')).toBeUndefined();
    expect(registry.list().map((info) => info.id)).toEqual(['frames.keyframes.insert']);
  });

  it('detects conflicts across key aliases (Ctrl / Cmd, Maj / Shift)', () => {
    // Arrange
    const registry = new ShortcutRegistry();
    registry.register(shortcut('a.one', 'Cmd+Maj+Z'));

    // Act / Assert
    expect(errorOf(() => registry.register(shortcut('b.two', 'Ctrl+Shift+z'))).code).toBe('conflict');
  });

  it('refuses a duplicate id', () => {
    // Arrange
    const registry = new ShortcutRegistry();
    registry.register(shortcut('a.one', 'F1'));

    // Act / Assert
    expect(errorOf(() => registry.register(shortcut('a.one', 'F2'))).code).toBe('duplicate-id');
  });

  it.each<[string, unknown, ShortcutErrorCode]>([
    ['a null definition', null, 'invalid-definition'],
    ['an empty id', { id: ' ', keys: 'F1', label: 'x', run: () => undefined }, 'invalid-definition'],
    ['an empty label', { id: 'a.b', keys: 'F1', label: '', run: () => undefined }, 'invalid-definition'],
    ['a missing run', { id: 'a.b', keys: 'F1', label: 'x' }, 'invalid-definition'],
    ['a non-function enabled', { id: 'a.b', keys: 'F1', label: 'x', run: () => undefined, enabled: true }, 'invalid-definition'],
    ['empty keys', { id: 'a.b', keys: [], label: 'x', run: () => undefined }, 'invalid-definition'],
    ['non-string keys', { id: 'a.b', keys: [1], label: 'x', run: () => undefined }, 'invalid-definition'],
    ['unparsable keys', { id: 'a.b', keys: 'Mod+', label: 'x', run: () => undefined }, 'invalid-keys']
  ])('refuses %s', (_name, definition, code) => {
    // Arrange
    const registry = new ShortcutRegistry();

    // Act
    const error = errorOf(() => registry.register(definition as IShortcutDefinition));

    // Assert
    expect(error.code).toBe(code);
    expect(registry.list()).toEqual([]);
  });

  it('names the shortcut in an invalid-keys error', () => {
    // Act
    const error = errorOf(() => new ShortcutRegistry().register(shortcut('a.b', 'Hyper+Z')));

    // Assert
    expect(error.shortcutId).toBe('a.b');
    expect(error.message).toContain('Raccourci « a.b »');
  });

  it('frees the id and keys on removal (idempotent)', () => {
    // Arrange
    const registry = new ShortcutRegistry();
    const remove = registry.register(shortcut('a.one', ['F1', 'F2']));

    // Act
    remove();
    remove();

    // Assert
    expect(registry.list()).toEqual([]);
    expect(registry.lookup('F1')).toBeUndefined();
    expect(() => registry.register(shortcut('a.one', 'F1'))).not.toThrow();
  });

  it('does not let a stale remover remove a newer registration', () => {
    // Arrange
    const registry = new ShortcutRegistry();
    const removeOld = registry.register(shortcut('a.one', 'F1'));
    removeOld();
    registry.register(shortcut('a.one', 'F1'));

    // Act
    removeOld();

    // Assert
    expect(registry.lookup('F1')?.id).toBe('a.one');
  });

  it('lists in registration order and clears everything', () => {
    // Arrange
    const registry = new ShortcutRegistry();
    registry.register(shortcut('b.two', 'F2'));
    registry.register(shortcut('a.one', 'F1'));

    // Act / Assert
    expect(registry.list().map((info) => info.id)).toEqual(['b.two', 'a.one']);
    expect(Object.isFrozen(registry.list()[0])).toBe(true);
    registry.clear();
    expect(registry.list()).toEqual([]);
    expect(registry.match('F1')).toBeUndefined();
  });
});
