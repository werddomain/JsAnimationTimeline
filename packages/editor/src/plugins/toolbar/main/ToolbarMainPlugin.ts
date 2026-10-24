// packages/editor/src/plugins/toolbar/main/ToolbarMainPlugin.ts
/**
 * Plugin : toolbar.main
 * Epic : toolbar
 * Dépend de : toolbar, layout.shell, interaction.shortcuts
 * Écoute : document:loaded, document:changed, history:changed
 * Émet : —
 *
 * Barre d'outils principale, dessinée dans la zone `toolbar` de la coquille :
 * à gauche la zone « Scène 1 » (nom de la scène), puis les boutons et les
 * contrôles que les autres plugins ajoutent par le service `toolbar.main`
 * (voir `types.ts`), rangés par groupe et par rang.
 *
 * L'infobulle d'un bouton affiche son libellé et, s'il en a un, son
 * raccourci mis en forme par `interaction.shortcuts` (`Annuler (Ctrl+Z)`).
 * L'état actif des boutons (`enabled()`) est relu à chaque changement de
 * document ou d'historique, et sur `refresh()`.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { LAYOUT_SLOTS } from '../../layout/shell/layoutSlots';
import type { IShortcutsService } from '../../interaction/shortcuts/types';
import { ToolbarError } from './ToolbarError';
import { ToolbarItems } from './ToolbarItems';
import type { ToolbarEntry } from './ToolbarItems';
import type {
  IToolbarButtonDefinition,
  IToolbarControlDefinition,
  IToolbarMainOptions,
  IToolbarMainService
} from './types';
import './ToolbarMain.less';

/** Identifiant du plugin (et de son service). */
export const TOOLBAR_MAIN_PLUGIN_ID = 'toolbar.main';

/** Nom de scène affiché par défaut. */
export const DEFAULT_SCENE_NAME = 'Scène 1';

/** Classe de l'élément racine de la barre. */
export const TOOLBAR_CLASS = 'jt-toolbar';

/** Élément du DOM d'un bouton ou d'un contrôle, et son nettoyage. */
interface IMountedItem {
  readonly element: HTMLElement;
  readonly cleanup?: () => void;
}

/** DOM de la barre, créé par `render`. */
interface IToolbarView {
  readonly root: HTMLElement;
  readonly sceneName: HTMLElement;
  readonly itemsHost: HTMLElement;
  readonly groups: Map<string, HTMLElement>;
  readonly mounted: Map<ToolbarEntry, IMountedItem>;
}

/** État d'un plugin initialisé (créé dans `init`, libéré dans `destroy`). */
interface IToolbarState {
  readonly items: ToolbarItems;
  readonly shortcuts: IShortcutsService;
  readonly cleanups: Array<() => void>;
}

function requireSceneName(name: unknown): string {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ToolbarError('invalid-definition', 'Le nom de la scène doit être une chaîne non vide.');
  }
  return name;
}

/** Plugin `toolbar.main` : zone « Scène 1 » et API d'ajout de boutons et de contrôles. */
export class ToolbarMainPlugin implements EditorPlugin {
  readonly id = 'toolbar.main';
  readonly dependencies: readonly string[] = ['toolbar', 'layout.shell', 'interaction.shortcuts'];
  readonly slot = LAYOUT_SLOTS.toolbar;

  private sceneName: string;
  private state: IToolbarState | null = null;
  private view: IToolbarView | null = null;

  constructor(options: IToolbarMainOptions = {}) {
    this.sceneName = requireSceneName(options.sceneName ?? DEFAULT_SCENE_NAME);
  }

  readonly init = (ctx: IEditorContext): void => {
    const items = new ToolbarItems();
    const shortcuts = ctx.services.require('interaction.shortcuts');
    const refresh = (): void => this.refresh();
    const cleanups = [
      ctx.events.on('document:loaded', refresh),
      ctx.events.on('document:changed', refresh),
      ctx.events.on('history:changed', refresh)
    ];
    try {
      cleanups.push(ctx.services.provide(TOOLBAR_MAIN_PLUGIN_ID, this.createService()));
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      throw error;
    }
    this.state = { items, shortcuts, cleanups };
  };

  render(slot: HTMLElement): void {
    const state = this.requireState();
    const doc = slot.ownerDocument;
    const root = doc.createElement('div');
    root.classList.add(TOOLBAR_CLASS);
    const scene = doc.createElement('div');
    scene.classList.add(`${TOOLBAR_CLASS}__scene`);
    const icon = doc.createElement('span');
    icon.classList.add(`${TOOLBAR_CLASS}__sceneIcon`);
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🎬';
    const sceneName = doc.createElement('span');
    sceneName.classList.add(`${TOOLBAR_CLASS}__sceneName`);
    sceneName.textContent = this.sceneName;
    scene.append(icon, sceneName);
    const itemsHost = doc.createElement('div');
    itemsHost.classList.add(`${TOOLBAR_CLASS}__items`);
    root.append(scene, itemsHost);
    slot.appendChild(root);
    this.view = { root, sceneName, itemsHost, groups: new Map(), mounted: new Map() };
    state.items.all().forEach((entry) => this.mount(entry));
    this.arrange();
  }

  destroy(): void {
    const state = this.state;
    const view = this.view;
    this.state = null;
    this.view = null;
    const errors: unknown[] = [];
    const attempt = (cleanup: (() => void) | undefined): void => {
      try {
        cleanup?.();
      } catch (error) {
        errors.push(error);
      }
    };
    state?.cleanups.forEach(attempt);
    view?.mounted.forEach((mounted) => attempt(mounted.cleanup));
    view?.root.remove();
    state?.items.clear();
    if (errors.length > 0) throw errors[0];
  }

  /** Relit `enabled()` de chaque bouton rendu. */
  private refresh(): void {
    const view = this.view;
    if (view === null) return;
    view.mounted.forEach((mounted, entry) => {
      if (entry.kind === 'button') (mounted.element as HTMLButtonElement).disabled = !isEnabled(entry.definition);
    });
  }

  private createService(): IToolbarMainService {
    const currentSceneName = (): string => this.sceneName;
    return Object.freeze({
      addButton: (definition: IToolbarButtonDefinition) => this.add(() => this.registerButton(definition)),
      addControl: (definition: IToolbarControlDefinition) =>
        this.add(() => this.requireState().items.addControl(definition)),
      refresh: () => this.refresh(),
      items: () => this.requireState().items.list(),
      get sceneName() {
        return currentSceneName();
      },
      setSceneName: (name: string) => this.setSceneName(name)
    } satisfies IToolbarMainService);
  }

  private registerButton(definition: IToolbarButtonDefinition): ToolbarEntry {
    const state = this.requireState();
    // Valide la combinaison avant l'ajout (lève une `ShortcutError`).
    if (definition.shortcut !== undefined) state.shortcuts.format(definition.shortcut);
    return state.items.addButton(definition);
  }

  /** Enregistre un élément, le dessine si la barre est rendue ; retourne son retrait. */
  private add(register: () => ToolbarEntry): () => void {
    const entry = register();
    if (this.view !== null) {
      this.mount(entry);
      this.arrange();
    }
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      this.remove(entry);
    };
  }

  private remove(entry: ToolbarEntry): void {
    const state = this.state;
    if (state === null || !state.items.remove(entry)) return;
    const mounted = this.view?.mounted.get(entry);
    if (mounted === undefined) return;
    this.view?.mounted.delete(entry);
    mounted.element.remove();
    this.arrange();
    mounted.cleanup?.();
  }

  private setSceneName(name: string): void {
    this.requireState();
    this.sceneName = requireSceneName(name);
    if (this.view !== null) this.view.sceneName.textContent = this.sceneName;
  }

  /** Crée le DOM d'un élément ; un contrôle dont `render` lève est retiré du registre. */
  private mount(entry: ToolbarEntry): void {
    const view = this.view;
    const state = this.state;
    if (view === null || state === null) return;
    const doc = view.root.ownerDocument;
    if (entry.kind === 'button') {
      view.mounted.set(entry, { element: this.createButton(doc, entry, state.shortcuts) });
      return;
    }
    const element = doc.createElement('div');
    element.classList.add(`${TOOLBAR_CLASS}__control`);
    element.dataset.toolbarItem = entry.info.id;
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', entry.info.label);
    let cleanup: (() => void) | void;
    try {
      cleanup = entry.definition.render(element);
    } catch (error) {
      state.items.remove(entry);
      throw error;
    }
    view.mounted.set(entry, typeof cleanup === 'function' ? { element, cleanup } : { element });
  }

  private createButton(doc: Document, entry: Extract<ToolbarEntry, { kind: 'button' }>, shortcuts: IShortcutsService): HTMLElement {
    const { definition, info } = entry;
    const button = doc.createElement('button');
    button.type = 'button';
    button.classList.add(`${TOOLBAR_CLASS}__button`);
    button.dataset.toolbarItem = info.id;
    button.setAttribute('aria-label', info.label);
    button.title =
      definition.shortcut === undefined ? info.label : `${info.label} (${shortcuts.format(definition.shortcut)})`;
    const content = doc.createElement('span');
    if (definition.icon === undefined) {
      content.classList.add(`${TOOLBAR_CLASS}__label`);
      content.textContent = info.label;
    } else {
      content.classList.add(`${TOOLBAR_CLASS}__icon`);
      content.setAttribute('aria-hidden', 'true');
      content.textContent = definition.icon;
    }
    button.appendChild(content);
    button.disabled = !isEnabled(definition);
    button.addEventListener('click', () => {
      if (this.state?.items.has(entry) === true && isEnabled(definition)) definition.onClick();
    });
    return button;
  }

  /** Range les groupes et leurs éléments dans l'ordre d'affichage ; retire les groupes vides. */
  private arrange(): void {
    const view = this.view;
    const state = this.state;
    if (view === null || state === null) return;
    const layout = state.items.layout();
    const used = new Set<string>();
    layout.forEach(({ group, entries }) => {
      used.add(group);
      let element = view.groups.get(group);
      if (element === undefined) {
        element = view.root.ownerDocument.createElement('div');
        element.classList.add(`${TOOLBAR_CLASS}__group`);
        element.dataset.group = group;
        view.groups.set(group, element);
      }
      view.itemsHost.appendChild(element);
      const host = element;
      entries.forEach((entry) => {
        const mounted = view.mounted.get(entry);
        if (mounted !== undefined) host.appendChild(mounted.element);
      });
    });
    view.groups.forEach((element, group) => {
      if (used.has(group)) return;
      element.remove();
      view.groups.delete(group);
    });
  }

  private requireState(): IToolbarState {
    if (this.state === null) throw new Error("toolbar.main : la barre d'outils n'est pas initialisée.");
    return this.state;
  }
}

function isEnabled(definition: IToolbarButtonDefinition): boolean {
  return definition.enabled === undefined || definition.enabled();
}

/** Crée le plugin `toolbar.main` (voir `IToolbarMainOptions`). */
export function createToolbarMainPlugin(options: IToolbarMainOptions = {}): ToolbarMainPlugin {
  return new ToolbarMainPlugin(options);
}
