// packages/editor/src/plugins/interaction/shortcuts/ShortcutsPlugin.ts
/**
 * Plugin : interaction.shortcuts
 * Epic : interaction
 * Dépend de : core
 * Écoute : —
 * Émet : shortcut:triggered
 *
 * Registre des raccourcis clavier de l'éditeur. Il ne déclare aucun
 * raccourci lui-même : chaque plugin déclare les siens par le service
 * `interaction.shortcuts` (voir `types.ts`) et les retire dans son `destroy`.
 *
 * Une frappe déclenche un raccourci si :
 * 1. elle concerne l'éditeur (`ShortcutScope` : focus dans l'élément racine
 *    ou dans un élément ajouté à la portée, ou portée globale) ;
 * 2. personne ne l'a déjà traitée (`defaultPrevented`) et aucune composition
 *    de saisie n'est en cours ;
 * 3. sa combinaison appartient à un raccourci (le registre refuse les
 *    conflits : une combinaison n'a qu'un propriétaire) ;
 * 4. elle ne vient pas d'un champ de saisie, sauf `allowInEditable` ;
 * 5. `enabled()` est vrai (ou absent).
 * L'action est alors exécutée ; sauf si elle retourne `false`, l'action par
 * défaut du navigateur est empêchée et `shortcut:triggered` est émis.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { chordToString, chordsFromEvent, formatChord, parseChord } from './keyChord';
import { ShortcutRegistry } from './ShortcutRegistry';
import type { IShortcutEntry } from './ShortcutRegistry';
import { ShortcutScope, isEditableTarget } from './ShortcutScope';
import type { IShortcutsOptions, IShortcutsService } from './types';

/** Identifiant du plugin (et de son service). */
export const SHORTCUTS_PLUGIN_ID = 'interaction.shortcuts';

/** État d'un plugin initialisé (créé dans `init`, libéré dans `destroy`). */
interface IShortcutsState {
  readonly ctx: IEditorContext;
  readonly registry: ShortcutRegistry;
  readonly scope: ShortcutScope;
  readonly removeService: () => void;
}

/** Plugin `interaction.shortcuts` : registre de raccourcis limité à l'éditeur. */
export class ShortcutsPlugin implements EditorPlugin {
  readonly id = 'interaction.shortcuts';
  readonly dependencies: readonly string[] = ['core'];
  private readonly options: IShortcutsOptions;
  private state: IShortcutsState | null = null;

  constructor(options: IShortcutsOptions = {}) {
    this.options = options;
  }

  init(ctx: IEditorContext): void {
    const registry = new ShortcutRegistry();
    const scope = new ShortcutScope(ctx.container, (event) => this.handle(event), this.options.global === true);
    try {
      (this.options.scopeElements ?? []).forEach((element) => scope.add(element));
      const removeService = ctx.services.provide(SHORTCUTS_PLUGIN_ID, createService(registry, scope));
      this.state = { ctx, registry, scope, removeService };
    } catch (error) {
      scope.destroy();
      throw error;
    }
  }

  destroy(): void {
    const state = this.state;
    if (state === null) return;
    this.state = null;
    state.removeService();
    state.scope.destroy();
    state.registry.clear();
  }

  private handle(event: KeyboardEvent): void {
    const state = this.state;
    if (state === null || event.defaultPrevented || event.isComposing) return;
    const found = findEntry(state.registry, event);
    if (found === undefined) return;
    const { entry, keys } = found;
    const { definition } = entry;
    if (definition.allowInEditable !== true && isEditableTarget(event.target)) return;
    if (definition.enabled !== undefined && !definition.enabled()) return;
    if (definition.run(event) === false) return;
    event.preventDefault();
    if (this.state !== null) state.ctx.events.emit('shortcut:triggered', { id: entry.info.id, keys });
  }
}

/** Premier raccourci dont la combinaison correspond à `event` (touche produite, puis physique). */
function findEntry(
  registry: ShortcutRegistry,
  event: KeyboardEvent
): { readonly entry: IShortcutEntry; readonly keys: string } | undefined {
  for (const chord of chordsFromEvent(event)) {
    const keys = chordToString(chord);
    const entry = registry.match(keys);
    if (entry !== undefined) return { entry, keys };
  }
  return undefined;
}

/** API du service, figée : une façade sur le registre et la portée. */
function createService(registry: ShortcutRegistry, scope: ShortcutScope): IShortcutsService {
  return Object.freeze({
    register: (definition) => registry.register(definition),
    lookup: (keys) => registry.lookup(keys),
    list: () => registry.list(),
    format: (keys) => formatChord(parseChord(keys)),
    addScopeElement: (element) => scope.add(element),
    setGlobal: (enabled) => scope.setGlobal(enabled),
    get isGlobal() {
      return scope.isGlobal;
    }
  } satisfies IShortcutsService);
}

/** Crée le plugin `interaction.shortcuts` (voir `IShortcutsOptions`). */
export function createShortcutsPlugin(options: IShortcutsOptions = {}): ShortcutsPlugin {
  return new ShortcutsPlugin(options);
}
