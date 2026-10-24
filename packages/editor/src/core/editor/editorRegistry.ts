// packages/editor/src/core/editor/editorRegistry.ts
/**
 * Registre de propriétés d'un éditeur : construit avant le Store, puis figé.
 *
 * C'est une copie de `options.registry ?? defaultPropertyRegistry`, plus les
 * propriétés supplémentaires (celles des scènes, en C7). Un nom déjà pris lève
 * une erreur claire. Une fois construit, `register` et `unregister` lèvent :
 * le registre ne change plus pendant la vie de l'éditeur, et un
 * `registerProperty()` tardif sur le registre par défaut ne le touche pas.
 * `clone()` reste permis (copie modifiable).
 */

import { PropertyRegistry, defaultPropertyRegistry } from '@werddomain/timeline-runtime';
import type { PropertyDescriptor } from '@werddomain/timeline-runtime';

/** Registre dont le contenu ne change plus après la construction. */
class FrozenPropertyRegistry extends PropertyRegistry {
  // Initialisé après `super()` : les enregistrements faits par le constructeur
  // de la classe de base (champ encore indéfini) passent, les suivants lèvent.
  private readonly sealed: boolean = true;

  override register(descriptor: PropertyDescriptor): this {
    if (this.sealed) throw frozenError(`register("${descriptor.name}")`);
    return super.register(descriptor);
  }

  override unregister(name: string): boolean {
    throw frozenError(`unregister("${name}")`);
  }
}

function frozenError(operation: string): Error {
  return new Error(
    `Registre de l'éditeur figé : ${operation} est refusé. Passez les propriétés dans options.registry avant createEditor().`
  );
}

/**
 * Registre figé de l'éditeur : propriétés de `base` (par défaut
 * `defaultPropertyRegistry`), puis `extra`.
 *
 * @throws Error si une propriété de `extra` porte un nom déjà pris ou écrit
 *   une propriété CSS déjà écrite.
 */
export function createEditorRegistry(
  base: PropertyRegistry = defaultPropertyRegistry,
  extra: readonly PropertyDescriptor[] = []
): PropertyRegistry {
  const descriptors = [...base.list()];
  extra.forEach((descriptor) => {
    if (descriptors.some((existing) => existing.name === descriptor.name)) {
      throw new Error(`Registre de l'éditeur : la propriété « ${descriptor.name} » est déjà définie.`);
    }
    descriptors.push(descriptor);
  });
  const registry = new FrozenPropertyRegistry(descriptors);
  Object.freeze(registry);
  return registry;
}
