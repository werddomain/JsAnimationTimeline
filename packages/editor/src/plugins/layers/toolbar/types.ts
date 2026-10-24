// packages/editor/src/plugins/layers/toolbar/types.ts
/**
 * Contrat de `layers.toolbar` pour les autres plugins : le service
 * `layers.toolbar` (le menu contextuel de I1 s'en sert). Le regroupement et
 * les dossiers restent dans le service `layers.groups`.
 */

/** API publiée sous le service `layers.toolbar`. */
export interface ILayerToolbarService {
  /**
   * « Nouveau calque » : insère un calque vide « Calque N » au-dessus de la
   * première ligne sélectionnée (dans son parent) ou, sans sélection, tout en
   * haut de l'arbre. Le nouveau calque est sélectionné. Il n'a pas de cible.
   *
   * @returns L'id du nouveau calque, ou `undefined` si la commande a été refusée.
   */
  newLayer(): string | undefined;
  /**
   * « Supprimer la sélection » : retire les nœuds sélectionnés de plus haut
   * niveau (un dossier emporte tout son contenu), puis sélectionne la ligne
   * qui a pris la place de la première supprimée.
   *
   * @returns `false` si rien n'est sélectionné (ou si la commande est refusée).
   */
  deleteSelection(): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.toolbar': ILayerToolbarService;
  }
}
