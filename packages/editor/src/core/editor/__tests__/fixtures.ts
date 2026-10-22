// packages/editor/src/core/editor/__tests__/fixtures.ts
/**
 * Fixtures des tests de l'éditeur et du contexte : service de test déclaré
 * par fusion de déclarations dans `EditorServiceMap`, fabrique de plugins
 * qui consignent leurs appels, conteneur hôte et capture d'erreur.
 */

import type { EditorPlugin, IEditorContext } from '../../context/IEditorContext';

/** API du service de test « test.counter ». */
export interface ICounterApi {
  readonly value: () => number;
  readonly increment: () => number;
}

declare module '../../context/IEditorContext' {
  interface EditorServiceMap {
    'test.counter': ICounterApi;
    'test.greeter': { readonly greet: (name: string) => string };
  }
}

/** Crée un compteur (implémentation du service « test.counter »). */
export function createCounter(): ICounterApi {
  let count = 0;
  return Object.freeze({
    value: () => count,
    increment: () => {
      count += 1;
      return count;
    }
  });
}

/** Options d'un plugin de test de l'éditeur. */
export interface IEditorPluginOptions {
  readonly slot?: string;
  readonly onInit?: (ctx: IEditorContext) => void;
  readonly onRender?: (slot: HTMLElement) => void;
  readonly onDestroy?: () => void;
}

/** Crée un plugin qui ajoute « phase:id » dans `log` à chaque appel. */
export function makeEditorPlugin(
  log: string[],
  id: string,
  dependencies: readonly string[] = [],
  options: IEditorPluginOptions = {}
): EditorPlugin {
  const base: EditorPlugin = {
    id,
    dependencies,
    slot: options.slot,
    init: (ctx) => {
      log.push(`init:${id}`);
      options.onInit?.(ctx);
    },
    destroy: () => {
      log.push(`destroy:${id}`);
      options.onDestroy?.();
    }
  };
  if (options.onRender === undefined) return base;
  const onRender = options.onRender;
  return {
    ...base,
    render: (slot) => {
      log.push(`render:${id}`);
      onRender(slot);
    }
  };
}

/** Plugin qui capture le contexte reçu dans `init`. */
export function captureContext(id = 'capture'): { readonly plugin: EditorPlugin; readonly context: () => IEditorContext } {
  let captured: IEditorContext | undefined;
  const plugin = makeEditorPlugin([], id, [], { onInit: (ctx) => (captured = ctx) });
  const context = (): IEditorContext => {
    if (captured === undefined) throw new Error('Le contexte n\'a pas été capturé.');
    return captured;
  };
  return { plugin, context };
}

/** Crée un conteneur hôte ajouté à `document.body`. */
export function createContainer(): HTMLElement {
  const container = document.createElement('section');
  container.id = 'host';
  document.body.appendChild(container);
  return container;
}

/** Retire tous les conteneurs hôtes (à appeler dans `afterEach`). */
export function cleanBody(): void {
  document.body.innerHTML = '';
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
