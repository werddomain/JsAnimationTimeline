// packages/editor/src/core/plugin/__tests__/fixtures/plugins.ts
/**
 * Fabriques de plugins de test qui consignent leurs appels (init, render,
 * destroy) dans un journal partagé.
 */

import type { IPlugin } from '../../IPlugin';

/** Contexte de test transmis à `init`. */
export interface ITestContext {
  readonly name: string;
}

/** Options d'un plugin de test. */
export interface ITestPluginOptions {
  readonly slot?: string;
  readonly children?: readonly IPlugin<ITestContext>[];
  readonly withRender?: boolean;
  readonly onInit?: (ctx: ITestContext) => void;
  readonly onRender?: (slot: HTMLElement) => void;
  readonly onDestroy?: () => void;
}

/** Crée un plugin qui ajoute « phase:id » dans `log` à chaque appel. */
export function makePlugin(
  log: string[],
  id: string,
  dependencies: readonly string[] = [],
  options: ITestPluginOptions = {}
): IPlugin<ITestContext> {
  const base: IPlugin<ITestContext> = {
    id,
    dependencies,
    slot: options.slot,
    children: options.children,
    init: (ctx) => {
      log.push(`init:${id}`);
      options.onInit?.(ctx);
    },
    destroy: () => {
      log.push(`destroy:${id}`);
      options.onDestroy?.();
    }
  };
  if (options.withRender !== true && options.onRender === undefined) return base;
  return {
    ...base,
    render: (slot) => {
      log.push(`render:${id}`);
      options.onRender?.(slot);
    }
  };
}

/** Exécute `fn` et retourne l'erreur levée (échoue si rien n'est levé). */
export function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Une erreur était attendue.');
}
