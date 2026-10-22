// packages/editor/src/core/plugin/__tests__/PluginHost.register.test.ts
/**
 * Tests de l'enregistrement dans PluginHost : identifiants, doublons
 * (directs, enfants, fournis), epics et ordre d'initialisation.
 */

import { PluginError } from '../PluginError';
import { PluginHost } from '../PluginHost';
import { catchError, makePlugin } from './fixtures/plugins';
import type { ITestContext } from './fixtures/plugins';

function newHost(providedIds?: readonly string[]): PluginHost<ITestContext> {
  return new PluginHost<ITestContext>(providedIds === undefined ? undefined : { providedIds });
}

function pluginError(fn: () => unknown): PluginError {
  const error = catchError(fn);
  expect(error).toBeInstanceOf(PluginError);
  return error as PluginError;
}

describe('PluginHost.register', () => {
  it('registers plugins and finds them with has/get', () => {
    // Arrange
    const host = newHost();
    const plugin = makePlugin([], 'layers.color', ['core']);

    // Act
    const returned = host.register(plugin);

    // Assert
    expect(returned).toBe(host);
    expect(host.has('layers.color')).toBe(true);
    expect(host.get('layers.color')).toBe(plugin);
    expect(host.has('layers.icon')).toBe(false);
    expect(host.get('layers.icon')).toBeUndefined();
  });

  it('registers a list with registerAll in the given order', () => {
    const host = newHost();

    host.registerAll([makePlugin([], 'b'), makePlugin([], 'a')]);

    expect(host.order()).toEqual(['b', 'a']);
  });

  it.each(['', 'Layers', 'layers.', 'layers-color'])('rejects the invalid id "%s"', (id) => {
    const error = pluginError(() => newHost().register(makePlugin([], id)));

    expect(error.code).toBe('invalid-id');
  });

  it('rejects an invalid child id without registering the parent', () => {
    // Arrange
    const host = newHost();
    const epic = makePlugin([], 'layers', [], { children: [makePlugin([], 'Bad')] });

    // Act
    const error = pluginError(() => host.register(epic));

    // Assert
    expect(error.code).toBe('invalid-id');
    expect(host.has('layers')).toBe(false);
  });

  it('rejects a direct duplicate id', () => {
    // Arrange
    const host = newHost().register(makePlugin([], 'a'));

    // Act
    const error = pluginError(() => host.register(makePlugin([], 'a')));

    // Assert
    expect(error.code).toBe('duplicate-id');
    expect(error.pluginId).toBe('a');
    expect(error.message).toContain('déjà enregistré');
  });

  it('rejects a child whose id is already registered, atomically', () => {
    // Arrange
    const host = newHost().register(makePlugin([], 'layers.list'));
    const epic = makePlugin([], 'layers', [], { children: [makePlugin([], 'layers.list')] });

    // Act
    const error = pluginError(() => host.register(epic));

    // Assert
    expect(error.code).toBe('duplicate-id');
    expect(host.has('layers')).toBe(false);
  });

  it('rejects duplicate ids inside the same epic', () => {
    const epic = makePlugin([], 'layers', [], {
      children: [makePlugin([], 'layers.list'), makePlugin([], 'layers.list')]
    });

    expect(pluginError(() => newHost().register(epic)).code).toBe('duplicate-id');
  });

  it('rejects a plugin using a provided id', () => {
    const error = pluginError(() => newHost().register(makePlugin([], 'core')));

    expect(error.code).toBe('duplicate-id');
    expect(error.message).toContain("fourni par l'hôte");
  });

  it('accepts "core" as a plugin id when it is not provided', () => {
    const host = newHost([]).register(makePlugin([], 'core'));

    expect(host.order()).toEqual(['core']);
  });
});

describe('PluginHost epics', () => {
  it('registers children recursively and orders each after its parent', () => {
    // Arrange
    const host = newHost();
    const epic = makePlugin([], 'layers', ['core'], {
      children: [
        makePlugin([], 'layers.list'),
        makePlugin([], 'layers.color', ['layers.list'])
      ]
    });

    // Act
    host.register(epic);

    // Assert
    expect(host.has('layers.list')).toBe(true);
    expect(host.order()).toEqual(['layers', 'layers.list', 'layers.color']);
  });

  it('initialises the parent first even when a child is listed before its own deps', () => {
    // Arrange: le parent dépend d'un plugin enregistré après lui
    const host = newHost();
    host.register(
      makePlugin([], 'layers', ['layout'], { children: [makePlugin([], 'layers.list')] })
    );
    host.register(makePlugin([], 'layout'));

    // Act
    const order = host.order();

    // Assert
    expect(order).toEqual(['layout', 'layers', 'layers.list']);
  });

  it('handles nested epics', () => {
    // Arrange
    const grandChild = makePlugin([], 'a.b.c');
    const child = makePlugin([], 'a.b', [], { children: [grandChild] });
    const host = newHost().register(makePlugin([], 'a', [], { children: [child] }));

    // Act / Assert
    expect(host.get('a.b.c')).toBe(grandChild);
    expect(host.order()).toEqual(['a', 'a.b', 'a.b.c']);
  });

  it('reports a cycle between a child and its parent', () => {
    const epic = makePlugin([], 'p', ['p.child'], { children: [makePlugin([], 'p.child')] });
    const host = newHost().register(epic);

    const error = pluginError(() => host.order());

    expect(error.code).toBe('circular-dependency');
    expect(error.message).toContain('p -> p.child -> p');
  });

  it('does not duplicate an explicit dependency on the parent', () => {
    const epic = makePlugin([], 'p', [], { children: [makePlugin([], 'p.child', ['p'])] });

    expect(newHost().register(epic).order()).toEqual(['p', 'p.child']);
  });
});

describe('PluginHost.order', () => {
  it('surfaces a missing dependency', () => {
    const host = newHost().register(makePlugin([], 'a', ['ghost']));

    const error = pluginError(() => host.order());

    expect(error.code).toBe('missing-dependency');
    expect(error.message).toContain('"a"');
    expect(error.message).toContain('"ghost"');
  });

  it('treats custom provided ids as satisfied', () => {
    const host = newHost(['core', 'runtime']).register(makePlugin([], 'a', ['runtime']));

    expect(host.order()).toEqual(['a']);
  });
});
