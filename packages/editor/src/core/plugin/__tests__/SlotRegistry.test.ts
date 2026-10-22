// packages/editor/src/core/plugin/__tests__/SlotRegistry.test.ts
/**
 * Tests du registre des emplacements de rendu nommés.
 */

import { PluginError } from '../PluginError';
import { ROOT_SLOT, SlotRegistry, assertValidSlotName, isValidSlotName } from '../SlotRegistry';
import { catchError } from './fixtures/plugins';

function pluginError(fn: () => unknown): PluginError {
  const error = catchError(fn);
  expect(error).toBeInstanceOf(PluginError);
  return error as PluginError;
}

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

  it('throws duplicate-slot when redefining a slot with another element', () => {
    // Arrange
    const slots = new SlotRegistry();
    const first = document.createElement('div');
    slots.define('a', first);

    // Act
    const error = pluginError(() => slots.define('a', document.createElement('span')));

    // Assert
    expect(error.code).toBe('duplicate-slot');
    expect(error.message).toMatch(/emplacement de rendu "a" est déjà défini/);
    expect(slots.get('a')).toBe(first);
  });

  it.each(['', 'Root', '1a', 'a-b', 'a.', 'a..b'])(
    'throws invalid-slot for the malformed name %p',
    (name) => {
      // Arrange
      const slots = new SlotRegistry();

      // Act
      const error = pluginError(() => slots.define(name, document.createElement('div')));

      // Assert
      expect(error.code).toBe('invalid-slot');
      expect(error.pluginId).toBeUndefined();
      expect(slots.names()).toEqual([]);
    }
  );

  it('accepts dotted slot names', () => {
    const slots = new SlotRegistry();

    slots.define('timeline.header', document.createElement('div'));

    expect(slots.has('timeline.header')).toBe(true);
  });

  it('removes a slot by name with remove, whatever its element', () => {
    // Arrange
    const slots = new SlotRegistry();
    slots.define('a', document.createElement('div'));

    // Act / Assert
    expect(slots.remove('a')).toBe(true);
    expect(slots.has('a')).toBe(false);
    expect(slots.remove('a')).toBe(false);
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

describe('slot name validation', () => {
  it('validates names with the plugin id pattern', () => {
    expect(isValidSlotName('root')).toBe(true);
    expect(isValidSlotName('layout.scrollSync')).toBe(true);
    expect(isValidSlotName('Root')).toBe(false);
    expect(isValidSlotName(42)).toBe(false);
  });

  it('names the plugin in the invalid-slot error when given', () => {
    // Act
    const error = pluginError(() => assertValidSlotName('Bad', 'layers.list'));

    // Assert
    expect(error.code).toBe('invalid-slot');
    expect(error.pluginId).toBe('layers.list');
    expect(error.message).toContain('"Bad"');
  });
});
