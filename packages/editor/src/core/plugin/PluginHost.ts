// packages/editor/src/core/plugin/PluginHost.ts
/**
 * Hôte des plugins de l'éditeur : enregistrement (epics et leurs enfants
 * compris), vérification des dépendances, initialisation dans l'ordre
 * topologique, rendu dans les emplacements nommés, puis destruction en ordre
 * inverse.
 */

import type { IPlugin } from './IPlugin';
import { PluginError } from './PluginError';
import { assertValidPluginId } from './pluginId';
import { ROOT_SLOT, SlotRegistry } from './SlotRegistry';
import { topologicalSort } from './topologicalSort';

/** Options de construction d'un `PluginHost`. */
export interface PluginHostOptions {
  /**
   * Identifiants satisfaits sans plugin (fournis par l'hôte lui-même).
   * Par défaut : `['core']`.
   */
  readonly providedIds?: readonly string[];
}

/** Identifiants fournis par défaut. */
const DEFAULT_PROVIDED_IDS: readonly string[] = ['core'];

/** Plugin enregistré, avec ses dépendances effectives (epic parent inclus). */
interface IRegistration<TContext> {
  readonly plugin: IPlugin<TContext>;
  readonly id: string;
  readonly dependencies: readonly string[];
}

/** Aplati un plugin et ses enfants ; chaque enfant dépend de son parent. */
function flatten<TContext>(
  plugin: IPlugin<TContext>,
  parentId?: string
): IRegistration<TContext>[] {
  assertValidPluginId(plugin.id);
  const own = parentId === undefined ? plugin.dependencies : [parentId, ...plugin.dependencies];
  const self: IRegistration<TContext> = {
    plugin,
    id: plugin.id,
    dependencies: Array.from(new Set(own))
  };
  const children = plugin.children ?? [];
  return children.reduce<IRegistration<TContext>[]>(
    (acc, child) => [...acc, ...flatten(child, plugin.id)],
    [self]
  );
}

function duplicateError(id: string, provided: boolean): PluginError {
  const reason = provided ? "est fourni par l'hôte" : 'est déjà enregistré';
  return new PluginError('duplicate-id', `Le plugin "${id}" ${reason}.`, id);
}

/** Détruit `plugins` en ordre inverse en ignorant leurs erreurs (annulation). */
function destroyQuietly<TContext>(plugins: readonly IPlugin<TContext>[]): void {
  for (const plugin of [...plugins].reverse()) {
    try {
      plugin.destroy();
    } catch {
      // Annulation d'un démarrage raté : l'erreur d'origine prime.
    }
  }
}

/** Enregistre, ordonne, démarre et détruit les plugins de l'éditeur. */
export class PluginHost<TContext = unknown> {
  /** Emplacements de rendu nommés, partagés par les plugins. */
  readonly slots = new SlotRegistry();

  private readonly provided: ReadonlySet<string>;
  private registrations: readonly IRegistration<TContext>[] = [];
  private initialised: readonly IPlugin<TContext>[] = [];
  private started = false;

  constructor(options: PluginHostOptions = {}) {
    this.provided = new Set(options.providedIds ?? DEFAULT_PROVIDED_IDS);
  }

  /** Vrai entre un `start` réussi et le `destroy` suivant. */
  get isStarted(): boolean {
    return this.started;
  }

  /**
   * Enregistre un plugin et, récursivement, ses enfants.
   * L'enregistrement est atomique : en cas d'erreur, rien n'est ajouté.
   *
   * @throws PluginError 'invalid-id', 'duplicate-id' ou 'already-started'.
   */
  register(plugin: IPlugin<TContext>): this {
    this.assertNotStarted('register');
    const incoming = flatten(plugin);
    const seen = new Set(this.registrations.map((r) => r.id));
    for (const { id } of incoming) {
      if (this.provided.has(id)) throw duplicateError(id, true);
      if (seen.has(id)) throw duplicateError(id, false);
      seen.add(id);
    }
    this.registrations = [...this.registrations, ...incoming];
    return this;
  }

  /** Enregistre plusieurs plugins, dans l'ordre donné. */
  registerAll(plugins: readonly IPlugin<TContext>[]): this {
    plugins.forEach((plugin) => this.register(plugin));
    return this;
  }

  /** Vrai si un plugin (ou un enfant d'epic) porte cet identifiant. */
  has(id: string): boolean {
    return this.registrations.some((r) => r.id === id);
  }

  /** Plugin enregistré sous cet identifiant, ou `undefined`. */
  get(id: string): IPlugin<TContext> | undefined {
    return this.registrations.find((r) => r.id === id)?.plugin;
  }

  /**
   * Ordre d'initialisation (tri topologique stable), calculé à la demande.
   *
   * @throws PluginError 'missing-dependency' ou 'circular-dependency'.
   */
  order(): string[] {
    return topologicalSort(this.registrations, this.provided);
  }

  /**
   * Initialise tous les plugins dans l'ordre, puis appelle `render` de ceux
   * qui en ont un, dans le même ordre. L'emplacement de chaque plugin est
   * résolu juste avant son rendu (un plugin rendu plus tôt peut le définir).
   * En cas d'échec, les plugins déjà initialisés sont détruits en ordre inverse.
   *
   * @throws PluginError 'already-started', 'missing-dependency',
   *   'circular-dependency', 'missing-slot' ou 'init-failed' (avec `cause`).
   */
  start(ctx: TContext): void {
    this.assertNotStarted('start');
    const byId = new Map(this.registrations.map((r) => [r.id, r.plugin] as const));
    const plugins = this.order()
      .map((id) => byId.get(id))
      .filter((plugin): plugin is IPlugin<TContext> => plugin !== undefined);
    this.initialised = [];
    try {
      plugins.forEach((plugin) => this.initOne(plugin, ctx));
      plugins.forEach((plugin) => this.renderOne(plugin));
    } catch (error) {
      destroyQuietly(this.initialised);
      this.initialised = [];
      throw error;
    }
    this.started = true;
  }

  /**
   * Détruit les plugins en ordre inverse d'initialisation. Continue malgré
   * les erreurs et relance la première à la fin. Sans effet si l'hôte n'est
   * pas démarré (idempotent).
   */
  destroy(): void {
    if (!this.started) return;
    const plugins = [...this.initialised].reverse();
    this.initialised = [];
    this.started = false;
    const errors: unknown[] = [];
    for (const plugin of plugins) {
      try {
        plugin.destroy();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) throw errors[0];
  }

  private initOne(plugin: IPlugin<TContext>, ctx: TContext): void {
    try {
      plugin.init(ctx);
    } catch (error) {
      throw this.failure(plugin.id, 'init', error);
    }
    this.initialised = [...this.initialised, plugin];
  }

  private renderOne(plugin: IPlugin<TContext>): void {
    if (plugin.render === undefined) return;
    const slotName = plugin.slot ?? ROOT_SLOT;
    const element = this.slots.get(slotName);
    if (element === undefined) {
      throw new PluginError(
        'missing-slot',
        `Le plugin "${plugin.id}" veut dessiner dans l'emplacement "${slotName}", qui n'est pas défini.`,
        plugin.id
      );
    }
    try {
      plugin.render(element);
    } catch (error) {
      throw this.failure(plugin.id, 'render', error);
    }
  }

  private failure(id: string, phase: 'init' | 'render', cause: unknown): PluginError {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return new PluginError(
      'init-failed',
      `Échec du démarrage du plugin "${id}" (${phase}) : ${detail}`,
      id,
      cause
    );
  }

  private assertNotStarted(action: 'register' | 'start'): void {
    if (!this.started) return;
    const message =
      action === 'start'
        ? "L'hôte de plugins est déjà démarré."
        : "Impossible d'enregistrer un plugin : l'hôte de plugins est déjà démarré.";
    throw new PluginError('already-started', message);
  }
}
