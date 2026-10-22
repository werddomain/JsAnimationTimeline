// packages/editor/src/core/plugin/__tests__/topologicalSort.test.ts
/**
 * Tests du tri topologique stable : ordre, dépendances fournies, erreurs
 * de dépendance manquante, circulaire et d'identifiant en double.
 */

import { PluginError } from '../PluginError';
import { topologicalSort } from '../topologicalSort';
import { catchError } from './fixtures/plugins';

const node = (id: string, ...dependencies: string[]) => ({ id, dependencies });

function sortError(...args: Parameters<typeof topologicalSort>): PluginError {
  const error = catchError(() => topologicalSort(...args));
  expect(error).toBeInstanceOf(PluginError);
  return error as PluginError;
}

describe('topologicalSort', () => {
  it('returns an empty order for no nodes', () => {
    expect(topologicalSort([])).toEqual([]);
  });

  it('keeps the registration order of independent nodes', () => {
    expect(topologicalSort([node('c'), node('a'), node('b')])).toEqual(['c', 'a', 'b']);
  });

  it('puts dependencies before their dependents', () => {
    // Arrange
    const nodes = [node('a', 'b'), node('b', 'c'), node('c')];

    // Act
    const order = topologicalSort(nodes);

    // Assert
    expect(order).toEqual(['c', 'b', 'a']);
  });

  it('orders a diamond once each, dependencies first, stable otherwise', () => {
    // Arrange: d -> b, c ; b -> a ; c -> a
    const nodes = [node('d', 'b', 'c'), node('b', 'a'), node('c', 'a'), node('a')];

    // Act
    const order = topologicalSort(nodes);

    // Assert
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });

  it('only pulls forward what is needed and keeps the rest in order', () => {
    expect(topologicalSort([node('x'), node('y', 'z'), node('w'), node('z')])).toEqual([
      'x',
      'z',
      'y',
      'w'
    ]);
  });

  it('treats provided ids as satisfied and leaves them out of the order', () => {
    expect(topologicalSort([node('a', 'core')], new Set(['core']))).toEqual(['a']);
  });

  it('throws missing-dependency naming the plugin and the missing id', () => {
    // Act
    const error = sortError([node('a'), node('b', 'a', 'ghost')]);

    // Assert
    expect(error.code).toBe('missing-dependency');
    expect(error.pluginId).toBe('b');
    expect(error.message).toContain('"b"');
    expect(error.message).toContain('"ghost"');
  });

  it('reports a provided id as missing when it is not provided', () => {
    expect(sortError([node('a', 'core')]).code).toBe('missing-dependency');
  });

  it('throws circular-dependency for a 2-node cycle and names it', () => {
    const error = sortError([node('a', 'b'), node('b', 'a')]);

    expect(error.code).toBe('circular-dependency');
    expect(error.message).toContain('a -> b -> a');
  });

  it('throws circular-dependency for a 3-node cycle reached from outside', () => {
    const error = sortError([node('start', 'a'), node('a', 'b'), node('b', 'c'), node('c', 'a')]);

    expect(error.code).toBe('circular-dependency');
    expect(error.message).toContain('a -> b -> c -> a');
    expect(error.message).not.toContain('start');
  });

  it('throws circular-dependency for a self dependency', () => {
    const error = sortError([node('a', 'a')]);

    expect(error.code).toBe('circular-dependency');
    expect(error.message).toContain('a -> a');
  });

  it('throws duplicate-id when the same id appears twice', () => {
    const error = sortError([node('a'), node('a')]);

    expect(error.code).toBe('duplicate-id');
    expect(error.pluginId).toBe('a');
  });

  it('does not mutate its input', () => {
    // Arrange
    const nodes = Object.freeze([node('b', 'a'), node('a')]);

    // Act / Assert
    expect(topologicalSort(nodes)).toEqual(['a', 'b']);
    expect(nodes.map((n) => n.id)).toEqual(['b', 'a']);
  });
});
