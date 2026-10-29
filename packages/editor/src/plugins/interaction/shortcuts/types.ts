// packages/editor/src/plugins/interaction/shortcuts/types.ts
/**
 * Types publics du plugin `interaction.shortcuts` : définition d'un
 * raccourci, options du plugin, API du service et événement émis. Ce module
 * ajoute aussi le service à `EditorServiceMap` et l'événement à
 * `TimelineEventMap` (fusion de déclarations).
 *
 * Exemple, dans `init` d'un plugin qui dépend de `interaction.shortcuts` :
 *
 * ```ts
 * const shortcuts = ctx.services.require('interaction.shortcuts');
 * this.unregister = shortcuts.register({
 *   id: 'frames.keyframes.insert',
 *   keys: 'F6',
 *   label: 'Insérer une image clé',
 *   run: () => this.insertKeyframe()
 * });
 * // Dans destroy : this.unregister();
 * ```
 */

/** Un raccourci clavier déclaré par un plugin. */
export interface IShortcutDefinition {
  /**
   * Identifiant unique, préfixé par celui du plugin qui le déclare
   * (`'history.undoRedo.undo'`).
   */
  readonly id: string;
  /**
   * Combinaison(s) qui déclenchent le raccourci : `'F6'`, `'Mod+Z'`
   * (Ctrl ou Cmd), `'Shift+F5'`, `['Mod+Y', 'Mod+Shift+Z']`...
   */
  readonly keys: string | readonly string[];
  /** Libellé en français, affiché dans les menus et l'aide (`'Annuler'`). */
  readonly label: string;
  /**
   * Action du raccourci. Retourner `false` signifie « non traité » : l'action
   * par défaut du navigateur n'est alors pas empêchée et aucun événement
   * n'est émis.
   */
  readonly run: (event: KeyboardEvent) => boolean | void;
  /**
   * Vrai si le raccourci est utilisable en ce moment (lu à chaque frappe).
   * Faux : la touche est laissée au navigateur. Par défaut : toujours vrai.
   */
  readonly enabled?: () => boolean;
  /**
   * Déclencher aussi quand la frappe vient d'un champ de saisie (`input`,
   * `textarea`, `select`, élément `contenteditable`). Par défaut : `false`,
   * pour que Ctrl+Z ou Suppr gardent leur sens dans un champ.
   */
  readonly allowInEditable?: boolean;
}

/** Raccourci enregistré, tel que le service le décrit (lecture seule). */
export interface IShortcutInfo {
  readonly id: string;
  readonly label: string;
  /** Combinaisons en forme canonique (`'Mod+Shift+z'`), dans l'ordre déclaré. */
  readonly keys: readonly string[];
  /** Combinaisons affichables en français (`'Ctrl+Maj+Z'`), même ordre que `keys`. */
  readonly display: readonly string[];
}

/**
 * Options du plugin `interaction.shortcuts`.
 *
 * Le plugin fait partie du jeu par défaut, créé sans options : le passer une
 * seconde fois dans `options.plugins` est refusé (identifiant en double).
 * Pour le configurer, utiliser le service après `createEditor()`
 * (`editor.getService('interaction.shortcuts')?.addScopeElement(canvas)`),
 * ou remplacer le jeu par défaut (`defaultPlugins: [createShortcutsPlugin(opts), ...]`).
 */
export interface IShortcutsOptions {
  /**
   * Éléments ajoutés à la portée des raccourcis, en plus de l'élément racine
   * de l'éditeur : par exemple le canvas de la scène fournie par le
   * développeur, pour que F6 ou Ctrl+Z marchent quand il a le focus.
   */
  readonly scopeElements?: readonly HTMLElement[];
  /**
   * Portée globale : les raccourcis réagissent partout dans la page, et non
   * seulement quand le focus est dans l'éditeur ou un élément ajouté. Les
   * champs de saisie restent exclus, sauf pour les raccourcis
   * `allowInEditable`, qui réagissent alors aussi dans les champs de la page
   * hors de l'éditeur. Par défaut : `false`.
   */
  readonly global?: boolean;
}

/** API du service `interaction.shortcuts`. */
export interface IShortcutsService {
  /**
   * Enregistre un raccourci. Lève une `ShortcutError` si la définition est
   * invalide (`invalid-definition`, `invalid-keys`), si l'identifiant est
   * déjà pris (`duplicate-id`) ou si une combinaison appartient déjà à un
   * autre raccourci (`conflict`, qui nomme les deux raccourcis).
   *
   * @returns La fonction qui retire ce raccourci (idempotente).
   */
  register(definition: IShortcutDefinition): () => void;
  /** Raccourci qui possède la combinaison `keys` (`'Mod+Z'`), ou `undefined` si elle est libre. */
  lookup(keys: string): IShortcutInfo | undefined;
  /** Raccourcis enregistrés, dans l'ordre d'enregistrement. */
  list(): readonly IShortcutInfo[];
  /** Affichage en français d'une combinaison (`'Mod+Shift+Z'` -> `'Ctrl+Maj+Z'`). */
  format(keys: string): string;
  /**
   * Ajoute un élément à la portée (voir `IShortcutsOptions.scopeElements`).
   * S'il n'est pas focalisable, il reçoit `tabindex="-1"` le temps de son
   * ajout, pour qu'un clic lui donne le focus.
   *
   * @returns La fonction qui le retire de la portée (idempotente).
   */
  addScopeElement(element: HTMLElement): () => void;
  /** Active ou désactive la portée globale (voir `IShortcutsOptions.global`). */
  setGlobal(enabled: boolean): void;
  /** Vrai si la portée est globale. */
  readonly isGlobal: boolean;
}

/** Charge utile de `shortcut:triggered` : un raccourci vient d'être exécuté. */
export interface ShortcutTriggeredEvent {
  /** Identifiant du raccourci. */
  readonly id: string;
  /** Combinaison qui l'a déclenché, en forme canonique (`'Mod+z'`). */
  readonly keys: string;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'interaction.shortcuts': IShortcutsService;
  }
}

declare module '../../../core/events/TimelineEventMap' {
  interface TimelineEventMap {
    'shortcut:triggered': ShortcutTriggeredEvent;
  }
}
