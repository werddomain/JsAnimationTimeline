// packages/editor/src/core/plugin/__tests__/IPlugin.types.test.ts
/**
 * Tests de typage du contrat IPlugin : le type du contexte de `init` est
 * vérifié strictement (pas de bivariance), y compris pour un plugin écrit
 * comme une classe. Les cas refusés sont marqués `@ts-expect-error` : si le
 * compilateur les acceptait, la vérification de types (ts-jest et
 * `npm run typecheck`) échouerait.
 */

import type { IPlugin } from '../IPlugin';
import { PluginHost } from '../PluginHost';

interface IEditorLikeContext {
  readonly a: number;
}

class NarrowPlugin {
  readonly id = 'narrow';
  readonly dependencies: readonly string[] = [];
  received?: IEditorLikeContext;

  init(ctx: IEditorLikeContext): void {
    this.received = ctx;
  }

  destroy(): void {
    this.received = undefined;
  }
}

describe('IPlugin typing', () => {
  it('accepts a class whose init takes exactly the host context', () => {
    // Arrange
    const plugin: IPlugin<IEditorLikeContext> = new NarrowPlugin();
    const host = new PluginHost<IEditorLikeContext>().register(plugin);

    // Act
    host.start({ a: 1 });

    // Assert
    expect((plugin as NarrowPlugin).received).toEqual({ a: 1 });
  });

  it('rejects a plugin whose init expects another context', () => {
    // @ts-expect-error init attend IEditorLikeContext, pas le contexte inconnu d'un IPlugin nu
    const bare: IPlugin = new NarrowPlugin();
    const typed: IPlugin<IEditorLikeContext> = new NarrowPlugin();
    // @ts-expect-error IPlugin<IEditorLikeContext> n'est pas un IPlugin<unknown>
    const widened: IPlugin<unknown> = typed;
    // @ts-expect-error le contexte d'un hôte nu est inconnu
    const register = (): unknown => new PluginHost().register(new NarrowPlugin());

    expect([bare, widened, typeof register]).toHaveLength(3);
  });

  it('rejects a start with a context of the wrong type', () => {
    const host = new PluginHost<IEditorLikeContext>().register(new NarrowPlugin());

    // @ts-expect-error 'oops' n'est pas un IEditorLikeContext
    const start = (): void => host.start('oops');

    expect(typeof start).toBe('function');
  });

  it('accepts a context-agnostic plugin in any host', () => {
    // Arrange
    const agnostic: IPlugin = { id: 'any', dependencies: [], init: () => undefined, destroy: () => undefined };

    // Act
    const host = new PluginHost<IEditorLikeContext>().register(agnostic);

    // Assert
    expect(host.has('any')).toBe(true);
  });
});
