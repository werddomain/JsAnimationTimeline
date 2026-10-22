// packages/editor/src/core/plugin/__tests__/SlotRegistry.test.ts
/**
 * Tests du registre des emplacements de rendu nommés.
 */

import { ROOT_SLOT, SlotRegistry } from '../SlotRegistry';

describe('SlotRegistry', () => {
  it('exposes "root" as the default slot name', () => {
    expect(ROOT_SLOT).toBe('root');
  });

  it('defines, gets and lists slots in definition order', () => {
    // Arrange
    const slots = new SlotRegistry();
    const root = document.createElement('div');
    const header = document.createElement('header');

    // Act
    slots.define(ROOT_SLOT, root);
    slots.define('header', header);

    // Assert
    expect(slots.get(ROOT_SLOT)).toBe(root);
    expect(slots.get('header')).toBe(header);
    expect(slots.has('header')).toBe(true);
    expect(slots.names()).toEqual(['root', 'header']);
  });

  it('returns undefined and false for an unknown slot', () => {
    const slots = new SlotRegistry();

    expect(slots.get('nope')).toBeUndefined();
    expect(slots.has('nope')).toBe(false);
    expect(slots.names()).toEqual([]);
  });

  it('accepts redefining a slot with the same element', () => {
    // Arrange
    const slots = new SlotRegistry();
    const el = document.createElement('div');
    slots.define('a', el);

    // Act / Assert
    expect(() => slots.define('a', el)).not.toThrow();
    expect(slots.get('a')).toBe(el);
  });

  it('throws a French error when redefining a slot with another element', () => {
    // Arrange
    const slots = new SlotRegistry();
    slots.define('a', document.createElement('div'));

    // Act / Assert
    expect(() => slots.define('a', document.createElement('span'))).toThrow(
      /emplacement de rendu "a" est déjà défini/
    );
  });

  it('throws when the slot name is empty', () => {
    const slots = new SlotRegistry();

    expect(() => slots.define('', document.createElement('div'))).toThrow(/vide/);
  });

  it('removes the slot with the returned undefine function', () => {
    // Arrange
    const slots = new SlotRegistry();
    const undefine = slots.define('a', document.createElement('div'));

    // Act
    undefine();

    // Assert
    expect(slots.has('a')).toBe(false);
  });

  it('does not remove a slot redefined with another element after undefine', () => {
    // Arrange
    const slots = new SlotRegistry();
    const undefineFirst = slots.define('a', document.createElement('div'));
    undefineFirst();
    const second = document.createElement('span');
    slots.define('a', second);

    // Act
    undefineFirst();

    // Assert
    expect(slots.get('a')).toBe(second);
  });
});
