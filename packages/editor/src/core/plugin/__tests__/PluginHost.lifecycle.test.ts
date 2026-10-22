// packages/editor/src/core/plugin/__tests__/PluginHost.lifecycle.test.ts
/**
 * Tests du cycle de vie de PluginHost : démarrage (init puis rendu dans les
 * emplacements), annulation en cas d'échec, destruction et double démarrage.
 */

import { PluginError } from '../PluginError';
import { PluginHost } from '../PluginHost';
import { ROOT_SLOT } from '../SlotRegistry';
import { catchError, makePlugin } from './fixtures/plugins';
import type { ITestContext } from './fixtures/plugins';

const ctx: ITestContext = { name: 'test' };

function pluginError(fn: () => unknown): PluginError {
  const error = catchError(fn);
  expect(error).toBeInstanceOf(PluginError);
  return error as PluginError;
}

function hostWithRoot(): { host: PluginHost<ITestContext>; root: HTMLElement } {
  const host = new PluginHost<ITestContext>();
  const root = document.createElement('div');
  host.slots.define(ROOT_SLOT, root);
  return { host, root };
}

describe('PluginHost.start', () => {
  it('initialises in dependency order, then renders in the same order', () => {
    // Arrange
    const log: string[] = [];
    const { host } = hostWithRoot();
    host.registerAll([
      makePlugin(log, 'b', ['a'], { withRender: true }),
      makePlugin(log, 'a', ['core'], { withRender: true }),
      makePlugin(log, 'c')
    ]);

    // Act
    host.start(ctx);

    // Assert
    expect(log).toEqual(['init:a', 'init:b', 'init:c', 'render:a', 'render:b']);
    expect(host.isStarted).toBe(true);
  });

  it('passes the context to init and the slot element to render', () => {
    // Arrange
    const { host, root } = hostWithRoot();
    const onInit = jest.fn();
    const onRender = jest.fn();
    host.register(makePlugin([], 'a', [], { onInit, onRender }));

    // Act
    host.start(ctx);

    // Assert
    expect(onInit).toHaveBeenCalledWith(ctx);
    expect(onRender).toHaveBeenCalledWith(root);
  });

  it('renders into a named slot defined by an earlier plugin render', () => {
    // Arrange
    const { host } = hostWithRoot();
    const panel = document.createElement('section');
    const onRender = jest.fn();
    host.registerAll([
      makePlugin([], 'layout.shell', [], {
        onRender: (root) => {
          root.appendChild(panel);
          host.slots.define('layers', panel);
        }
      }),
      makePlugin([], 'layers.list', ['layout.shell'], { slot: 'layers', onRender })
    ]);

    // Act
    host.start(ctx);

    // Assert
    expect(onRender).toHaveBeenCalledWith(panel);
  });

  it('does not need a root slot when no plugin renders', () => {
    const host = new PluginHost<ITestContext>().register(makePlugin([], 'a'));

    expect(() => host.start(ctx)).not.toThrow();
  });

  it('throws missing-slot and rolls back when the slot is not defined', () => {
    // Arrange
    const log: string[] = [];
    const host = new PluginHost<ITestContext>();
    host.registerAll([makePlugin(log, 'a'), makePlugin(log, 'b', [], { slot: 'nowhere', withRender: true })]);

    // Act
    const error = pluginError(() => host.start(ctx));

    // Assert
    expect(error.code).toBe('missing-slot');
    expect(error.pluginId).toBe('b');
    expect(error.message).toContain('"nowhere"');
    expect(log).toEqual(['init:a', 'init:b', 'destroy:b', 'destroy:a']);
    expect(host.isStarted).toBe(false);
  });

  it('surfaces dependency errors before any init', () => {
    // Arrange
    const log: string[] = [];
    const host = new PluginHost<ITestContext>().registerAll([
      makePlugin(log, 'a', ['b']),
      makePlugin(log, 'b', ['a'])
    ]);

    // Act
    const error = pluginError(() => host.start(ctx));

    // Assert
    expect(error.code).toBe('circular-dependency');
    expect(log).toEqual([]);
  });

  it('throws already-started when started twice, and refuses registration', () => {
    // Arrange
    const { host } = hostWithRoot();
    host.start(ctx);

    // Act / Assert
    expect(pluginError(() => host.start(ctx)).code).toBe('already-started');
    expect(pluginError(() => host.register(makePlugin([], 'late'))).code).toBe(
      'already-started'
    );
  });
});

describe('PluginHost.start rollback', () => {
  it('destroys only the initialised plugins, in reverse, when an init throws', () => {
    // Arrange
    const log: string[] = [];
    const cause = new Error('init cassé');
    const { host } = hostWithRoot();
    host.registerAll([
      makePlugin(log, 'a'),
      makePlugin(log, 'b', ['a']),
      makePlugin(log, 'c', ['b'], { onInit: () => { throw cause; } }),
      makePlugin(log, 'd', ['c'])
    ]);

    // Act
    const error = pluginError(() => host.start(ctx));

    // Assert
    expect(error.code).toBe('init-failed');
    expect(error.pluginId).toBe('c');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('init cassé');
    expect(log).toEqual(['init:a', 'init:b', 'init:c', 'destroy:b', 'destroy:a']);
    expect(host.isStarted).toBe(false);
  });

  it('throws render-failed and destroys every initialised plugin when a render throws a non-Error', () => {
    // Arrange
    const log: string[] = [];
    const { host } = hostWithRoot();
    host.registerAll([
      makePlugin(log, 'a', [], { withRender: true }),
      makePlugin(log, 'b', [], { onRender: () => { throw 'rendu cassé'; } })
    ]);

    // Act
    const error = pluginError(() => host.start(ctx));

    // Assert
    expect(error.code).toBe('render-failed');
    expect(error.pluginId).toBe('b');
    expect(error.cause).toBe('rendu cassé');
    expect(error.message).toContain('rendu cassé');
    expect(log).toEqual(['init:a', 'init:b', 'render:a', 'render:b', 'destroy:b', 'destroy:a']);
  });

  it('swallows destroy errors during rollback and keeps the original cause', () => {
    // Arrange
    const cause = new Error('init cassé');
    const host = new PluginHost<ITestContext>().registerAll([
      makePlugin([], 'a', [], { onDestroy: () => { throw new Error('destroy cassé'); } }),
      makePlugin([], 'b', [], { onInit: () => { throw cause; } })
    ]);

    // Act
    const error = pluginError(() => host.start(ctx));

    // Assert
    expect(error.cause).toBe(cause);
  });

  it('can be started again after a failed start', () => {
    // Arrange
    let fail = true;
    const host = new PluginHost<ITestContext>().register(
      makePlugin([], 'a', [], { onInit: () => { if (fail) throw new Error('x'); } })
    );
    catchError(() => host.start(ctx));
    fail = false;

    // Act
    host.start(ctx);

    // Assert
    expect(host.isStarted).toBe(true);
  });
});

describe('PluginHost.destroy', () => {
  it('destroys in reverse init order', () => {
    // Arrange
    const log: string[] = [];
    const host = new PluginHost<ITestContext>().registerAll([
      makePlugin(log, 'b', ['a']),
      makePlugin(log, 'a')
    ]);
    host.start(ctx);
    log.length = 0;

    // Act
    host.destroy();

    // Assert
    expect(log).toEqual(['destroy:b', 'destroy:a']);
    expect(host.isStarted).toBe(false);
  });

  it('continues after a destroy error and rethrows the first one', () => {
    // Arrange
    const log: string[] = [];
    const first = new Error('premier');
    const host = new PluginHost<ITestContext>().registerAll([
      makePlugin(log, 'a', [], { onDestroy: () => { throw new Error('second'); } }),
      makePlugin(log, 'b', [], { onDestroy: () => { throw first; } }),
      makePlugin(log, 'c')
    ]);
    host.start(ctx);
    log.length = 0;

    // Act
    const error = catchError(() => host.destroy());

    // Assert
    expect(error).toBe(first);
    expect(log).toEqual(['destroy:c', 'destroy:b', 'destroy:a']);
    expect(host.isStarted).toBe(false);
  });

  it('is idempotent and a no-op on a never-started host', () => {
    // Arrange
    const log: string[] = [];
    const never = new PluginHost<ITestContext>().register(makePlugin(log, 'x'));
    const host = new PluginHost<ITestContext>().register(makePlugin(log, 'a'));
    host.start(ctx);

    // Act
    never.destroy();
    host.destroy();
    host.destroy();

    // Assert
    expect(log).toEqual(['init:a', 'destroy:a']);
  });
});
