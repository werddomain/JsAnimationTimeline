// packages/editor/src/core/plugin/SlotRegistry.ts
/**
 * Registre des emplacements de rendu nommés : chaque nom désigne l'élément du
 * DOM dans lequel les plugins de cet emplacement dessinent. Les noms suivent
 * la même forme que les identifiants de plugin (ex. « root », « layers »,
 * « timeline.header »).
 */

import { PluginError } from './PluginError';
import { PLUGIN_ID_PATTERN } from './pluginId';

/** Nom de l'emplacement par défaut (le conteneur racine de l'éditeur). */
export const ROOT_SLOT = 'root';

/** Vrai si `name` est un nom d'emplacement valide (forme de `PLUGIN_ID_PATTERN`). */
export function isValidSlotName(name: unknown): name is string {
  return typeof name === 'string' && PLUGIN_ID_PATTERN.test(name);
}

/**
 * Lève une `PluginError` 'invalid-slot' si `name` n'est pas valide.
 *
 * @param pluginId Plugin concerné, repris dans l'erreur s'il est donné.
 */
export function assertValidSlotName(name: unknown, pluginId?: string): asserts name is string {
  if (isValidSlotName(name)) return;
  throw new PluginError(
    'invalid-slot',
    `Nom d'emplacement de rendu invalide : ${JSON.stringify(name)}. ` +
      'Attendu : des segments commençant par une minuscule, séparés par des points ' +
      '(ex. "root", "timeline.header").',
    pluginId
  );
}

/** Emplacements de rendu nommés, partagés par les plugins. */
export class SlotRegistry {
  private readonly elements = new Map<string, HTMLElement>();

  /**
   * Définit l'emplacement `name`. Redéfinir un nom avec le même élément est
   * sans effet ; avec un autre élément, une erreur est levée.
   *
   * @returns Une fonction qui retire l'emplacement (si c'est encore cet élément).
   * @throws PluginError 'invalid-slot' (nom mal formé) ou 'duplicate-slot'
   *   (nom déjà défini avec un autre élément).
   */
  define(name: string, element: HTMLElement): () => void {
    assertValidSlotName(name);
    const current = this.elements.get(name);
    if (current !== undefined && current !== element) {
      throw new PluginError(
        'duplicate-slot',
        `L'emplacement de rendu "${name}" est déjà défini avec un autre élément.`
      );
    }
    this.elements.set(name, element);
    return () => {
      if (this.elements.get(name) === element) this.elements.delete(name);
    };
  }

  /**
   * Retire l'emplacement `name`, quel que soit son élément.
   *
   * @returns Vrai si un emplacement a été retiré.
   */
  remove(name: string): boolean {
    return this.elements.delete(name);
  }

  /** Élément de l'emplacement `name`, ou `undefined` s'il n'est pas défini. */
  get(name: string): HTMLElement | undefined {
    return this.elements.get(name);
  }

  /** Vrai si l'emplacement `name` est défini. */
  has(name: string): boolean {
    return this.elements.has(name);
  }

  /** Noms des emplacements définis, dans l'ordre de définition. */
  names(): string[] {
    return Array.from(this.elements.keys());
  }
}
