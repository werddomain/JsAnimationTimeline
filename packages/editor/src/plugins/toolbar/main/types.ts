// packages/editor/src/plugins/toolbar/main/types.ts
/**
 * Types publics du plugin `toolbar.main` : définitions d'un bouton et d'un
 * contrôle, options du plugin et API du service. Ce module ajoute aussi le
 * service à `EditorServiceMap` (fusion de déclarations).
 *
 * Exemple, dans `init` d'un plugin qui dépend de `toolbar.main` :
 *
 * ```ts
 * const toolbar = ctx.services.require('toolbar.main');
 * this.removeButton = toolbar.addButton({
 *   id: 'history.undoRedo.undo',
 *   label: 'Annuler',
 *   icon: '↶',
 *   group: 'history',
 *   order: 10,
 *   shortcut: 'Mod+Z',
 *   onClick: () => ctx.commands.undo(),
 *   enabled: () => ctx.commands.canUndo
 * });
 * // Dans destroy : this.removeButton();
 * ```
 */

/** Champs communs à un bouton et à un contrôle de la barre d'outils. */
export interface IToolbarItemDefinition {
  /**
   * Identifiant unique, préfixé par celui du plugin qui ajoute l'élément
   * (`'history.undoRedo.undo'`).
   */
  readonly id: string;
  /** Libellé en français : nom accessible et infobulle (`'Annuler'`). */
  readonly label: string;
  /**
   * Groupe d'éléments voisins (`'history'`, `'time'`...), séparé des autres
   * groupes. Par défaut : `DEFAULT_TOOLBAR_GROUP`.
   */
  readonly group?: string;
  /**
   * Rang dans le groupe (croissant ; à égalité, l'ordre d'ajout). Les groupes
   * sont rangés par le plus petit rang de leurs éléments. Par défaut : 0.
   */
  readonly order?: number;
}

/** Un bouton de la barre d'outils. */
export interface IToolbarButtonDefinition extends IToolbarItemDefinition {
  /**
   * Icône courte (un caractère ou un symbole, `'↶'`), affichée à la place du
   * libellé. Sans icône, le libellé est affiché.
   */
  readonly icon?: string;
  /**
   * Combinaison du raccourci clavier qui fait la même action (`'Mod+Z'`),
   * affichée dans l'infobulle par `interaction.shortcuts` (`Annuler (Ctrl+Z)`).
   * Elle est seulement affichée : le raccourci lui-même s'enregistre auprès
   * de `interaction.shortcuts`.
   */
  readonly shortcut?: string;
  /** Action du bouton (appelée seulement s'il est actif). */
  readonly onClick: () => void;
  /**
   * Vrai si le bouton est actif. Relu à chaque `document:loaded`,
   * `document:changed`, `history:changed` et `refresh()`. Par défaut :
   * toujours vrai.
   */
  readonly enabled?: () => boolean;
}

/** Un contrôle libre (champs, listes...) dessiné par le plugin qui l'ajoute. */
export interface IToolbarControlDefinition extends IToolbarItemDefinition {
  /**
   * Dessine le contrôle dans `element` (un conteneur vide, nommé par
   * `label`). Appelé une seule fois, au rendu de la barre ou tout de suite
   * si elle est déjà rendue.
   *
   * @returns Une fonction de nettoyage, appelée au retrait du contrôle ou à
   *   la destruction de la barre.
   */
  readonly render: (element: HTMLElement) => (() => void) | void;
}

/** Élément de la barre, tel que le service le décrit (lecture seule). */
export interface IToolbarItemInfo {
  readonly id: string;
  readonly kind: 'button' | 'control';
  readonly label: string;
  readonly group: string;
  readonly order: number;
}

/** Options du plugin `toolbar.main`. */
export interface IToolbarMainOptions {
  /** Nom de la scène affiché à gauche de la barre. Par défaut : `DEFAULT_SCENE_NAME`. */
  readonly sceneName?: string;
}

/** API du service `toolbar.main`. */
export interface IToolbarMainService {
  /**
   * Ajoute un bouton. Lève une `ToolbarError` si la définition est invalide
   * (`invalid-definition`) ou si l'identifiant est déjà pris (`duplicate-id`),
   * et une `ShortcutError` si `shortcut` n'est pas une combinaison valide.
   *
   * @returns La fonction qui retire ce bouton (idempotente).
   */
  addButton(definition: IToolbarButtonDefinition): () => void;
  /**
   * Ajoute un contrôle libre (mêmes erreurs que `addButton`).
   *
   * @returns La fonction qui retire ce contrôle et appelle son nettoyage (idempotente).
   */
  addControl(definition: IToolbarControlDefinition): () => void;
  /** Relit `enabled()` de chaque bouton (après un changement que la barre n'écoute pas). */
  refresh(): void;
  /** Éléments de la barre, dans l'ordre d'affichage. */
  items(): readonly IToolbarItemInfo[];
  /** Nom de la scène affiché. */
  readonly sceneName: string;
  /** Change le nom de la scène ; lève une `ToolbarError` pour un nom vide. */
  setSceneName(name: string): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'toolbar.main': IToolbarMainService;
  }
}
