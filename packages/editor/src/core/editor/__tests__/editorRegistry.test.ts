// packages/editor/src/core/editor/__tests__/editorRegistry.test.ts
/**
 * Tests du registre de l'éditeur : copie figée du registre donné (ou du
 * registre par défaut), propriétés supplémentaires avec erreur claire sur un
 * nom pris, `register` / `unregister` refusés, `clone()` modifiable, et même
 * objet dans `ctx.registry` et `editor.registry`.
 */

import {
  BUILTIN_PROPERTY_NAMES,
  createManualClock,
  createPropertyRegistry,
  defaultPropertyRegistry
} from '@werddomain/timeline-runtime';
import type { PropertyDescriptor } from '@werddomain/timeline-runtime';
import { createEditor } from '../createEditor';
import { createEditorRegistry } from '../editorRegistry';
import { captureContext, cleanBody, createContainer } from './fixtures';

afterEach(cleanBody);

const VOLUME: PropertyDescriptor = { name: 'volume', kind: 'value', unit: '', defaultValue: 1, min: 0, max: 1 };

describe('createEditorRegistry', () => {
  it('copies the default registry when no base is given', () => {
    // Act
    const registry = createEditorRegistry();

    // Assert
    expect(registry).not.toBe(defaultPropertyRegistry);
    expect(registry.list().map((d) => d.name)).toEqual([...BUILTIN_PROPERTY_NAMES]);
  });

  it('adds extra properties after the base ones', () => {
    // Act
    const registry = createEditorRegistry(createPropertyRegistry(), [VOLUME]);
    const names = registry.list().map((d) => d.name);

    // Assert
    expect(registry.get('volume')).toEqual(VOLUME);
    expect(names[names.length - 1]).toBe('volume');
  });

  it('throws a clear error when an extra property name is taken', () => {
    // Arrange
    const clash: PropertyDescriptor = { ...VOLUME, name: 'x' };

    // Act
    const act = (): unknown => createEditorRegistry(createPropertyRegistry(), [clash]);

    // Assert
    expect(act).toThrow('Registre de l\'éditeur : la propriété « x » est déjà définie.');
  });

  it('refuses register and unregister once built, but clone() stays writable', () => {
    // Arrange
    const registry = createEditorRegistry();

    // Act
    const copy = registry.clone().register(VOLUME);

    // Assert
    expect(() => registry.register(VOLUME)).toThrow(/figé : register\("volume"\)/);
    expect(() => registry.unregister('x')).toThrow(/figé : unregister\("x"\)/);
    expect(registry.has('x')).toBe(true);
    expect(registry.has('volume')).toBe(false);
    expect(copy.has('volume')).toBe(true);
    expect(Object.isFrozen(registry)).toBe(true);
  });
});

describe('createEditor registry option', () => {
  it('freezes a copy of options.registry, shared by ctx.registry and editor.registry', () => {
    // Arrange
    const given = createPropertyRegistry([VOLUME]);
    const { plugin, context } = captureContext();

    // Act
    const editor = createEditor(createContainer(), { registry: given, plugins: [plugin], clock: createManualClock() });
    given.unregister('volume');

    // Assert
    expect(editor.registry).not.toBe(given);
    expect(context().registry).toBe(editor.registry);
    expect(editor.registry.has('volume')).toBe(true);
    expect(() => context().registry.register({ ...VOLUME, name: 'pan' })).toThrow(/figé/);
  });

  it('is not changed by a later registerProperty on the default registry', () => {
    // Arrange
    const editor = createEditor(createContainer(), { clock: createManualClock() });
    const late: PropertyDescriptor = { ...VOLUME, name: 'lateValue' };

    // Act
    defaultPropertyRegistry.register(late);

    try {
      // Assert
      expect(defaultPropertyRegistry.has('lateValue')).toBe(true);
      expect(editor.registry.has('lateValue')).toBe(false);
    } finally {
      defaultPropertyRegistry.unregister('lateValue');
    }
  });
});
