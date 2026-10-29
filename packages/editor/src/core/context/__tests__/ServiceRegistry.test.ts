// packages/editor/src/core/context/__tests__/ServiceRegistry.test.ts
/**
 * Tests du registre des services entre plugins : fourniture, lecture,
 * exigence, doublon, retrait (y compris après une nouvelle fourniture),
 * vidage et typage par fusion de déclarations de `EditorServiceMap`.
 */

import { catchError, createCounter } from '../../editor/__tests__/fixtures';
import type { EditorServiceId, EditorServiceMap } from '../IEditorContext';
import { ServiceRegistry } from '../ServiceRegistry';

describe('ServiceRegistry', () => {
  it('returns the provided api with get and require', () => {
    // Arrange
    const services = new ServiceRegistry();
    const counter = createCounter();

    // Act
    services.provide('test.counter', counter);

    // Assert
    expect(services.get('test.counter')).toBe(counter);
    expect(services.require('test.counter').increment()).toBe(1);
    expect(services.ids()).toEqual(['test.counter']);
  });

  it('returns undefined from get when no plugin provides the service', () => {
    // Arrange
    const services = new ServiceRegistry();

    // Act
    const api = services.get('test.counter');

    // Assert
    expect(api).toBeUndefined();
  });

  it('throws a French error from require when the service is missing', () => {
    // Arrange
    const services = new ServiceRegistry();

    // Act
    const error = catchError(() => services.require('test.greeter'));

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Le service « test.greeter » est introuvable');
  });

  it('refuses a second provider for the same id', () => {
    // Arrange
    const services = new ServiceRegistry();
    const first = createCounter();
    services.provide('test.counter', first);

    // Act
    const error = catchError(() => services.provide('test.counter', createCounter()));

    // Assert
    expect((error as Error).message).toContain('est déjà fourni');
    expect(services.get('test.counter')).toBe(first);
  });

  it('refuses undefined as an api', () => {
    // Arrange
    const services = new ServiceRegistry();
    const missing = undefined as unknown as EditorServiceMap['test.counter'];

    // Act
    const error = catchError(() => services.provide('test.counter', missing));

    // Assert
    expect((error as Error).message).toContain('undefined');
    expect(services.ids()).toEqual([]);
  });

  it('removes the service with the returned function, once', () => {
    // Arrange
    const services = new ServiceRegistry();
    const remove = services.provide('test.counter', createCounter());

    // Act
    remove();
    remove();

    // Assert
    expect(services.get('test.counter')).toBeUndefined();
  });

  it('keeps a newer provider when a stale removal function is called', () => {
    // Arrange
    const services = new ServiceRegistry();
    const removeFirst = services.provide('test.counter', createCounter());
    removeFirst();
    const second = createCounter();
    services.provide('test.counter', second);

    // Act
    removeFirst();

    // Assert
    expect(services.get('test.counter')).toBe(second);
  });

  it('clears every service', () => {
    // Arrange
    const services = new ServiceRegistry();
    services.provide('test.counter', createCounter());
    services.provide('test.greeter', { greet: (name) => `Bonjour ${name}` });

    // Act
    services.clear();

    // Assert
    expect(services.ids()).toEqual([]);
  });

  it('types each service from EditorServiceMap (declaration merging)', () => {
    // Arrange
    const services = new ServiceRegistry();
    services.provide('test.greeter', { greet: (name) => `Bonjour ${name}` });
    const ids: EditorServiceId[] = ['test.counter', 'test.greeter'];

    // Act
    const greeting = services.require('test.greeter').greet('Ada');

    // Assert
    expect(greeting).toBe('Bonjour Ada');
    expect(ids).toHaveLength(2);
    // @ts-expect-error « test.unknown » n'est pas déclaré dans EditorServiceMap
    expect(() => services.require('test.unknown')).toThrow(Error);
    // @ts-expect-error l'API fournie doit respecter le type déclaré
    const wrongApi = (): unknown => new ServiceRegistry().provide('test.greeter', { greet: 42 });
    expect(typeof wrongApi).toBe('function');
  });
});
