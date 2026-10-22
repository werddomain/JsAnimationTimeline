// packages/editor/src/core/plugin/__tests__/PluginHost.state.test.ts
/**
 * Tests de l'état de PluginHost pendant le démarrage (appels réentrants
 * depuis un plugin refusés avec 'starting') et du nettoyage des emplacements
 * de rendu définis pendant un démarrage (annulation et destruction).
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

/** Démarre `host` et retourne l'erreur levée par `start`, avec sa cause. */
function startFailure(host: PluginHost<ITestContext>): { error: PluginError; cause: PluginError } {
  const error = pluginError(() => host.start(ctx));
  expect(error.cause).toBeInstanceOf(PluginError);
  return { error, cause: error.cause as PluginError };
}

describe('PluginHost while starting', () => {
  it('refuses a registration from inside init with starting', () => {
    // Arrange
    const host = new PluginHost<ITestContext>();
    host.register(
      makePlugin([], 'a', [], { onInit: () => { host.register(makePlugin([], 'late')); } })
    );

    // Act
    const { error, cause } = startFailure(host);

    // Assert
    expect(error.code).toBe('init-failed');
    expect(cause.code).toBe('starting');
    expect(cause.message).toContain("d'enregistrer un plugin");
    expect(host.has('late')).toBe(false);
    expect(host.isStarted).toBe(false);
  });

  it('refuses a nested start from inside init, so no plugin is initialised twice', () => {
    // Arrange
    const log: string[] = [];
    const host = new PluginHost<ITestContext>();
    host.registerAll([
      makePlugin(log, 'a'),
      makePlugin(log, 'b', ['a'], { onInit: () => host.start(ctx) })
    ]);

    // Act
    const { cause } = startFailure(host);

    // Assert
    expect(cause.code).toBe('starting');
    expect(cause.message).toContain('démarrer à nouveau');
    expect(log).toEqual(['init:a', 'init:b', 'destroy:a']);
  });

  it('refuses a destroy from inside render with starting', () => {
    // Arrange
    const host = new PluginHost<ITestContext>();
    host.slots.define(ROOT_SLOT, document.createElement('div'));
    host.register(makePlugin([], 'a', [], { onRender: () => host.destroy() }));

    // Act
    const { error, cause } = startFailure(host);

    // Assert
    expect(error.code).toBe('render-failed');
    expect(cause.code).toBe('starting');
    expect(cause.message).toContain('de le détruire');
  });

  it('accepts register, start and destroy again once a failed start is rolled back', () => {
    // Arrange
    let fail = true;
    const host = new PluginHost<ITestContext>().register(
      makePlugin([], 'a', [], { onInit: () => { if (fail) throw new Error('x'); } })
    );
    catchError(() => host.start(ctx));
    fail = false;

    // Act
    host.register(makePlugin([], 'b'));
    host.start(ctx);
    host.destroy();

    // Assert
    expect(host.has('b')).toBe(true);
    expect(host.isStarted).toBe(false);
  });
});

describe('PluginHost slot cleanup', () => {
  it('removes a slot left by a half-initialised plugin, so a retry can redefine it', () => {
    // Arrange
    let attempt = 0;
    const host = new PluginHost<ITestContext>();
    host.register(
      makePlugin([], 'panel', [], {
        onInit: () => {
          attempt += 1;
          host.slots.define('panel.body', document.createElement('div'));
          if (attempt === 1) throw new Error('init partiel');
        }
      })
    );
    const first = pluginError(() => host.start(ctx));

    // Act
    host.start(ctx);

    // Assert
    expect(first.code).toBe('init-failed');
    expect(host.isStarted).toBe(true);
    expect(host.slots.has('panel.body')).toBe(true);
  });

  it('removes slots defined during a rolled-back start, keeping those defined before', () => {
    // Arrange
    const host = new PluginHost<ITestContext>();
    const root = document.createElement('div');
    host.slots.define(ROOT_SLOT, root);
    host.registerAll([
      makePlugin([], 'layout.shell', [], {
        onRender: () => host.slots.define('layers', document.createElement('section'))
      }),
      makePlugin([], 'layers.list', ['layout.shell'], { slot: 'nowhere', withRender: true })
    ]);

    // Act
    const error = pluginError(() => host.start(ctx));

    // Assert
    expect(error.code).toBe('missing-slot');
    expect(host.slots.names()).toEqual([ROOT_SLOT]);
    expect(host.slots.get(ROOT_SLOT)).toBe(root);
  });

  it('removes slots defined since start after the plugins are destroyed', () => {
    // Arrange
    const seenDuringDestroy: boolean[] = [];
    const host = new PluginHost<ITestContext>();
    host.slots.define(ROOT_SLOT, document.createElement('div'));
    host.register(
      makePlugin([], 'layout.shell', [], {
        onRender: () => host.slots.define('layers', document.createElement('section')),
        onDestroy: () => seenDuringDestroy.push(host.slots.has('layers'))
      })
    );
    host.start(ctx);

    // Act
    host.destroy();

    // Assert
    expect(seenDuringDestroy).toEqual([true]);
    expect(host.slots.names()).toEqual([ROOT_SLOT]);
  });

  it('removes slots defined since start even when a plugin destroy throws', () => {
    // Arrange
    const host = new PluginHost<ITestContext>();
    host.register(
      makePlugin([], 'a', [], {
        onInit: () => host.slots.define('a.slot', document.createElement('div')),
        onDestroy: () => { throw new Error('destroy cassé'); }
      })
    );
    host.start(ctx);

    // Act
    const error = catchError(() => host.destroy());

    // Assert
    expect(error).toEqual(new Error('destroy cassé'));
    expect(host.slots.has('a.slot')).toBe(false);
  });
});
