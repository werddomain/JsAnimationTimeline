// packages/editor/src/plugins/layers/groups/types.ts
/**
 * Contrat de `layers.groups` pour les autres plugins : le service
 * `layers.groups` (la barre d'outils de Y8 s'en sert).
 */

/** API publiée sous le service `layers.groups`. */
export interface ILayerGroupsService {
  /**
   * « Nouveau dossier » : crée un dossier vide « Dossier N » au-dessus de la
   * première ligne sélectionnée (dans son parent) ou, sans sélection, tout en
   * haut de l'arbre. Le nouveau dossier est sélectionné et déplié.
   *
   * @returns L'id du nouveau dossier, ou `undefined` si la commande a été refusée.
   */
  createFolder(): string | undefined;
  /**
   * « Grouper la sélection » : range les nœuds sélectionnés (de plus haut
   * niveau, dans l'ordre d'affichage) dans un nouveau dossier, à la place du
   * premier. Le dossier est sélectionné et déplié.
   *
   * @returns L'id du dossier, ou `undefined` si rien n'est sélectionné (ou refus).
   */
  groupSelection(): string | undefined;
  /**
   * « Dissocier le dossier » : remplace le dossier par ses enfants, qui sont
   * ensuite sélectionnés. `false` si `folderId` n'est pas un dossier.
   */
  ungroup(folderId: string): boolean;
  /** Vrai si `groupSelection()` ferait quelque chose (au moins une ligne sélectionnée). */
  canGroup(): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layers.groups': ILayerGroupsService;
  }
}
