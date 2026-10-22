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
import { ROOT_SLOT, SlotRegistry, assertValidSlotName } from './SlotRegistry';
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

/** État de l'hôte : `starting` couvre toute la durée de `start` (init et rendu). */
type HostState = 'idle' | 'starting' | 'started';

/** Action publique soumise à l'état de l'hôte. */
type HostAction = 'register' | 'start' | 'destroy';

/** Phase de démarrage pendant laquelle un plugin a échoué. */
type StartPhase = 'init' | 'render';

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
  if (plugin.slot !== undefined) assertValidSlotName(plugin.slot, plugin.id);
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

/** Ce qu'une action refusée pendant le démarrage aurait fait. */
const STARTING_ACTIONS: Readonly<Record<HostAction, string>> = {
  register: "d'enregistrer un plugin",
  start: 'de le démarrer à nouveau',
  destroy: 'de le détruire'
};

/** Erreur d'une action refusée dans l'état `state`. */
function stateError(action: HostAction, state: Exclude<HostState, 'idle'>): PluginError {
  if (state === 'starting') {
    const verb = STARTING_ACTIONS[action];
    return new PluginError(
      'starting',
      `L'hôte de plugins est en cours de démarrage : impossible ${verb} depuis un plugin.`
    );
  }
  const message =
    action === 'register'
      ? "Impossible d'enregistrer un plugin : l'hôte de plugins est déjà démarré."
      : "L'hôte de plugins est déjà démarré.";
  return new PluginError('already-started', message);
}

/** Enregistre, ordonne, démarre et détruit les plugins de l'éditeur. */
export class PluginHost<TContext = unknown> {
  /** Emplacements de rendu nommés, partagés par les plugins. */
  readonly slots = new SlotRegistry();

  private readonly provided: ReadonlySet<string>;
  private registrations: readonly IRegistration<TContext>[] = [];
  private initialised: readonly IPlugin<TContext>[] = [];
  private state: HostState = 'idle';
  /** Emplacements définis avant le démarrage (les autres sont retirés ensuite). */
  private slotsBeforeStart: ReadonlySet<string> = new Set();

  constructor(options: PluginHostOptions = {}) {
    this.provided = new Set(options.providedIds ?? DEFAULT_PROVIDED_IDS);
  }

  /** Vrai entre un `start` réussi et le `destroy` suivant. */
  get isStarted(): boolean {
    return this.state === 'started';
  }

  /**
   * Enregistre un plugin et, récursivement, ses enfants.
   * L'enregistrement est atomique : en cas d'erreur, rien n'est ajouté.
   *
   * @throws PluginError 'invalid-id', 'invalid-slot', 'duplicate-id',
   *   'already-started' ou 'starting' (appel depuis un plugin pendant `start`).
   */
  register(plugin: IPlugin<TContext>): this {
    this.assertIdle('register');
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
   * En cas d'échec, les plugins dont `init` a réussi sont détruits en ordre
   * inverse (pas celui dont `init` a levé), puis les emplacements définis
   * pendant ce démarrage sont retirés. Pendant tout le démarrage, `register`,
   * `start` et `destroy` lèvent 'starting'.
   *
   * @throws PluginError 'already-started', 'starting', 'missing-dependency',
   *   'circular-dependency', 'missing-slot', 'init-failed' ou
   *   'render-failed' (ces deux derniers avec `cause`).
   */
  start(ctx: TContext): void {
    this.assertIdle('start');
    const plugins = this.sortedPlugins();
    this.slotsBeforeStart = new Set(this.slots.names());
    this.initialised = [];
    this.state = 'starting';
    try {
      plugins.forEach((plugin) => this.initOne(plugin, ctx));
      plugins.forEach((plugin) => this.renderOne(plugin));
    } catch (error) {
      const before = this.slotsBeforeStart;
      destroyQuietly(this.initialised);
      this.reset();
      this.removeSlotsSince(before);
      throw error;
    }
    this.state = 'started';
  }

  /**
   * Détruit les plugins en ordre inverse d'initialisation. Continue malgré
   * les erreurs et relance la première à la fin. Retire ensuite les
   * emplacements définis depuis le démarrage. Sans effet si l'hôte n'est pas
   * démarré (idempotent).
   *
   * @throws PluginError 'starting' si appelé pendant `start` ; sinon la
   *   première erreur levée par un `destroy` de plugin.
   */
  destroy(): void {
    if (this.state === 'starting') throw stateError('destroy', 'starting');
    if (this.state === 'idle') return;
    const plugins = [...this.initialised].reverse();
    const before = this.slotsBeforeStart;
    this.reset();
    const errors: unknown[] = [];
    for (const plugin of plugins) {
      try {
        plugin.destroy();
      } catch (error) {
        errors.push(error);
      }
    }
    this.removeSlotsSince(before);
    if (errors.length > 0) throw errors[0];
  }

  /** Plugins enregistrés, dans l'ordre d'initialisation. */
  private sortedPlugins(): IPlugin<TContext>[] {
    const byId = new Map(this.registrations.map((r) => [r.id, r.plugin] as const));
    return this.order()
      .map((id) => byId.get(id))
      .filter((plugin): plugin is IPlugin<TContext> => plugin !== undefined);
  }

  /** Revient à l'état `idle` (avant d'appeler les `destroy` : pas de réentrée). */
  private reset(): void {
    this.initialised = [];
    this.state = 'idle';
    this.slotsBeforeStart = new Set();
  }

  /** Retire les emplacements absents de `before` (définis depuis `start`). */
  private removeSlotsSince(before: ReadonlySet<string>): void {
    this.slots
      .names()
      .filter((name) => !before.has(name))
      .forEach((name) => this.slots.remove(name));
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

  private failure(id: string, phase: StartPhase, cause: unknown): PluginError {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return new PluginError(
      phase === 'init' ? 'init-failed' : 'render-failed',
      `Échec du démarrage du plugin "${id}" (${phase}) : ${detail}`,
      id,
      cause
    );
  }

  private assertIdle(action: Exclude<HostAction, 'destroy'>): void {
    if (this.state !== 'idle') throw stateError(action, this.state);
  }
}
