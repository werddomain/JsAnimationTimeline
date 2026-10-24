// packages/editor/src/plugins/toolbar/main/__tests__/ToolbarItems.test.ts
/**
 * Tests du registre `ToolbarItems` : validation des définitions, unicité des
 * identifiants, ordre d'affichage (groupes, rang, ordre d'ajout) et retrait.
 */

import { ToolbarError } from '../ToolbarError';
import { DEFAULT_TOOLBAR_GROUP, ToolbarItems } from '../ToolbarItems';
import type { IToolbarButtonDefinition } from '../types';

function button(id: string, extra: Partial<IToolbarButtonDefinition> = {}): IToolbarButtonDefinition {
  return { id, label: `Bouton ${id}`, onClick: () => {}, ...extra };
}

function expectToolbarError(action: () => void, code: ToolbarError['code']): ToolbarError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ToolbarError);
  expect((caught as ToolbarError).code).toBe(code);
  return caught as ToolbarError;
}

describe('ToolbarItems validation', () => {
  it.each<[string, Partial<IToolbarButtonDefinition>]>([
    ['an empty id', { id: '' }],
    ['a blank label', { label: '  ' }],
    ['an empty group', { group: '' }],
    ['a non-finite order', { order: Number.NaN }],
    ['an empty icon', { icon: '' }],
    ['a missing onClick', { onClick: undefined as unknown as () => void }],
    ['a non-function enabled', { enabled: true as unknown as () => boolean }]
  ])('refuses a button with %s', (_name, extra) => {
    // Arrange
    const items = new ToolbarItems();

    // Act + Assert
    const error = expectToolbarError(() => items.addButton(button('a', extra)), 'invalid-definition');
    expect(error.message).toMatch(/^Élément de barre d'outils invalide/);
  });

  it('refuses a control without render', () => {
    // Arrange
    const items = new ToolbarItems();

    // Act + Assert
    expectToolbarError(
      () => items.addControl({ id: 'c', label: 'Contrôle', render: undefined as unknown as () => void }),
      'invalid-definition'
    );
  });

  it('refuses a duplicate id, buttons and controls alike, naming the id', () => {
    // Arrange
    const items = new ToolbarItems();
    items.addButton(button('same'));

    // Act + Assert
    const error = expectToolbarError(
      () => items.addControl({ id: 'same', label: 'X', render: () => {} }),
      'duplicate-id'
    );
    expect(error.itemId).toBe('same');
    expect(error.message).toContain('« same »');
  });
});

describe('ToolbarItems layout', () => {
  it('uses the default group and order 0 when they are omitted', () => {
    // Arrange
    const items = new ToolbarItems();

    // Act
    items.addButton(button('a'));

    // Assert
    expect(items.list()).toEqual([
      { id: 'a', kind: 'button', label: 'Bouton a', group: DEFAULT_TOOLBAR_GROUP, order: 0 }
    ]);
  });

  it('sorts items by order then insertion, and groups by their smallest order', () => {
    // Arrange
    const items = new ToolbarItems();
    items.addButton(button('time.b', { group: 'time', order: 50 }));
    items.addButton(button('history.redo', { group: 'history', order: 20 }));
    items.addButton(button('history.undo', { group: 'history', order: 10 }));
    items.addButton(button('time.a', { group: 'time', order: 5 }));
    items.addButton(button('time.c', { group: 'time', order: 50 }));

    // Act
    const layout = items.layout();

    // Assert
    expect(layout.map(({ group, entries }) => [group, entries.map((entry) => entry.info.id)])).toEqual([
      ['time', ['time.a', 'time.b', 'time.c']],
      ['history', ['history.undo', 'history.redo']]
    ]);
    expect(items.list().map((info) => info.id)).toEqual([
      'time.a',
      'time.b',
      'time.c',
      'history.undo',
      'history.redo'
    ]);
  });

  it('removes an entry once, frees its id and empties on clear', () => {
    // Arrange
    const items = new ToolbarItems();
    const entry = items.addButton(button('a'));

    // Act
    const first = items.remove(entry);
    const second = items.remove(entry);
    const again = items.addButton(button('a'));

    // Assert
    expect([first, second]).toEqual([true, false]);
    expect(items.has(entry)).toBe(false);
    expect(items.has(again)).toBe(true);
    items.clear();
    expect(items.all()).toEqual([]);
  });
});
