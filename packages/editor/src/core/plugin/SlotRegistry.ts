// packages/editor/src/core/plugin/SlotRegistry.ts
/**
 * Registre des emplacements de rendu nommés : chaque nom désigne l'élément du
 * DOM dans lequel les plugins de cet emplacement dessinent.
 */

/** Nom de l'emplacement par défaut (le conteneur racine de l'éditeur). */
export const ROOT_SLOT = 'root';

/** Emplacements de rendu nommés, partagés par les plugins. */
export class SlotRegistry {
  private readonly elements = new Map<string, HTMLElement>();

  /**
   * Définit l'emplacement `name`. Redéfinir un nom avec le même élément est
   * sans effet ; avec un autre élément, une erreur est levée.
   *
   * @returns Une fonction qui retire l'emplacement (si c'est encore cet élément).
   */
  define(name: string, element: HTMLElement): () => void {
    if (name.length === 0) {
      throw new Error("Le nom d'un emplacement de rendu ne peut pas être vide.");
    }
    const current = this.elements.get(name);
    if (current !== undefined && current !== element) {
      throw new Error(
        `L'emplacement de rendu "${name}" est déjà défini avec un autre élément.`
      );
    }
    this.elements.set(name, element);
    return () => {
      if (this.elements.get(name) === element) this.elements.delete(name);
    };
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
