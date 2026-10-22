// packages/editor/src/core/context/ServiceRegistry.ts
/**
 * Registre des services entre plugins (implémentation de `IEditorServices`).
 * Interne au noyau : les plugins n'en reçoivent qu'une façade sans `clear`.
 *
 * Chaque fourniture a sa propre identité : la fonction de retrait rendue par
 * `provide` ne retire que cette fourniture, même si le même identifiant a été
 * fourni de nouveau entre-temps.
 */

import type { EditorServiceId, EditorServiceMap, IEditorServices } from './IEditorContext';

/** Une fourniture : l'API publiée (identité propre). */
interface IServiceEntry {
  readonly api: unknown;
}

/** Services fournis par les plugins, par identifiant. */
export class ServiceRegistry implements IEditorServices {
  private readonly entries = new Map<string, IServiceEntry>();

  provide<K extends EditorServiceId>(id: K, api: EditorServiceMap[K]): () => void {
    if (this.entries.has(id)) {
      throw new Error(`Le service « ${id} » est déjà fourni ; un seul plugin peut le fournir.`);
    }
    if (api === undefined) {
      throw new Error(`Le service « ${id} » ne peut pas être fourni avec la valeur undefined.`);
    }
    const entry: IServiceEntry = { api };
    this.entries.set(id, entry);
    return () => {
      if (this.entries.get(id) === entry) this.entries.delete(id);
    };
  }

  get<K extends EditorServiceId>(id: K): EditorServiceMap[K] | undefined {
    return this.entries.get(id)?.api as EditorServiceMap[K] | undefined;
  }

  require<K extends EditorServiceId>(id: K): EditorServiceMap[K] {
    const api = this.get(id);
    if (api === undefined) {
      throw new Error(
        `Le service « ${id} » est introuvable : aucun plugin ne le fournit. ` +
          'Ajoutez le plugin qui le fournit aux dépendances du plugin qui le demande.'
      );
    }
    return api;
  }

  /** Identifiants des services fournis, dans l'ordre de fourniture. */
  ids(): string[] {
    return Array.from(this.entries.keys());
  }

  /** Retire tous les services (destruction de l'éditeur). */
  clear(): void {
    this.entries.clear();
  }
}
