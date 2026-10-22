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
 *   Par défaut `unknown` : un `IPlugin` nu accepte n'importe quel contexte,
 *   donc son `init` ne peut rien supposer du contexte reçu.
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
   * Par défaut : l'emplacement racine (`ROOT_SLOT`). Même forme qu'un
   * identifiant de plugin, vérifiée à l'enregistrement.
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
   * Doit être sûr en cas d'exception : si `init` lève, le plugin n'est pas
   * considéré comme initialisé et son `destroy` n'est PAS appelé ; il doit
   * donc défaire lui-même ce qu'il a déjà fait avant de lever. (Les
   * emplacements de rendu définis pendant le démarrage sont retirés par
   * l'hôte.)
   *
   * Déclaré comme propriété de type fonction (et non comme méthode) pour que
   * `strictFunctionTypes` vérifie le type du contexte : un plugin dont `init`
   * attend un autre contexte est refusé. Une méthode de classe convient.
   *
   * @param ctx Contexte partagé de l'éditeur.
   */
  readonly init: (ctx: TContext) => void;

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
   * Appelé dans l'ordre inverse de l'initialisation, uniquement pour les
   * plugins dont `init` a réussi : à la destruction de l'hôte, ou lors de
   * l'annulation d'un démarrage raté (y compris si son propre `render` a
   * levé, ce qui suppose de tolérer un rendu partiel).
   */
  destroy(): void;
}
