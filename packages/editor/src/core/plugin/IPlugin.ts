// packages/editor/src/core/plugin/IPlugin.ts
/**
 * Contrat d'un plugin de l'éditeur.
 * Le type du contexte est générique : `IEditorContext` est défini plus tard
 * (tâche C4), qui exposera l'alias `IPlugin<IEditorContext>`.
 */

/**
 * Un plugin de l'éditeur : une fonctionnalité isolée, initialisée par le
 * `PluginHost` après ses dépendances, et détruite avant elles.
 *
 * @typeParam TContext Contexte transmis à `init` (le futur `IEditorContext`).
 */
export interface IPlugin<TContext = unknown> {
  /**
   * Identifiant unique du plugin, en notation pointée : un ou plusieurs
   * segments commençant par une minuscule, par exemple `"core"`,
   * `"layers.color"` ou `"layout.scrollSync"`.
   */
  readonly id: string;

  /**
   * Identifiants des plugins (ou des identifiants fournis par l'hôte, comme
   * `"core"`) qui doivent être initialisés avant celui-ci.
   * Une dépendance absente ou circulaire fait échouer le démarrage.
   */
  readonly dependencies: readonly string[];

  /**
   * Nom de l'emplacement de rendu dans lequel `render` dessine.
   * Par défaut : l'emplacement racine (`ROOT_SLOT`).
   */
  readonly slot?: string;

  /**
   * Plugins de fonctionnalité d'un epic (plugin parent).
   * L'hôte les enregistre récursivement ; chaque enfant dépend implicitement
   * de son epic, qui est donc toujours initialisé avant lui.
   */
  readonly children?: readonly IPlugin<TContext>[];

  /**
   * Initialise le plugin : abonnement aux événements, enregistrement des
   * commandes, etc. Appelé une seule fois, dans l'ordre des dépendances.
   *
   * @param ctx Contexte partagé de l'éditeur.
   */
  init(ctx: TContext): void;

  /**
   * Dessine le contenu propre du plugin dans son emplacement. Appelé après
   * l'initialisation de tous les plugins, dans le même ordre que `init`.
   * Un plugin peut y définir de nouveaux emplacements pour les suivants.
   *
   * @param slot Élément de l'emplacement désigné par `slot`.
   */
  render?(slot: HTMLElement): void;

  /**
   * Libère les ressources du plugin (abonnements, éléments du DOM...).
   * Appelé dans l'ordre inverse de l'initialisation.
   */
  destroy(): void;
}
