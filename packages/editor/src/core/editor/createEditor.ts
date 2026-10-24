// packages/editor/src/core/editor/createEditor.ts
/**
 * `createEditor(container, options)` : crée l'éditeur v2 et le démarre.
 *
 * Étapes :
 * 1. registre de propriétés figé (`createEditorRegistry`), `EventBus`,
 *    `Store` (le document est validé avec ce registre : un document invalide
 *    ou une cible vivante lève une `StoreError` avant toute modification du
 *    DOM) puis la pile de
 *    commandes `store.createCommandStack({ limit: historyLimit })` ; le
 *    document initial est gelé en profondeur, comme chaque document annoncé
 *    ensuite par le Store (`freezeDocument.ts`) ;
 * 2. `PluginHost<IEditorContext>` : jeu par défaut (ou celui de
 *    `options.defaultPlugins`), puis `options.plugins` ;
 * 3. élément racine `<div class="JsTimeLine">` ajouté au conteneur et défini
 *    comme `ROOT_SLOT`, puis la lecture (`PlaybackController` sur l'horloge
 *    `options.clock` ou `createDefaultClock()`) ; le premier rendu est demandé à
 *    l'horloge ;
 * 4. `host.start(ctx)` avec le contexte de façades (`createEditorContext`) ;
 *    en cas d'échec, la lecture est arrêtée, l'élément racine est retiré, les
 *    abonnements et les services sont vidés, puis l'erreur est relancée ;
 * 5. émission de `editor:ready` { pluginIds } (ordre d'initialisation).
 *
 * `editor:ready` est émis avant le retour de `createEditor()` : seuls les
 * plugins (abonnés pendant `init`) le reçoivent.
 */

import { EventBus } from '../events/EventBus';
import { createEditorContext } from '../context/createEditorContext';
import type { EditorPlugin, IEditorContext } from '../context/IEditorContext';
import { ServiceRegistry } from '../context/ServiceRegistry';
import { createDefaultClock } from '../playback/defaultClock';
import { PlaybackController } from '../playback/PlaybackController';
import { createPlaybackFacade } from '../playback/playbackFacade';
import { PluginHost } from '../plugin/PluginHost';
import { ROOT_SLOT } from '../plugin/SlotRegistry';
import { Store } from '../store/Store';
import { defaultPlugins } from './defaultPlugins';
import { createEditorRegistry } from './editorRegistry';
import { freezeAnnouncedDocuments, freezeDocument } from './freezeDocument';
import { Editor, releaseEditorParts } from './Editor';
import type { IEditorParts } from './Editor';
import { EditorLifecycle } from './EditorLifecycle';
import { createEmptyDocument } from './emptyDocument';
import type { EditorOptions, IEditor } from './types';

/** Classe de l'élément racine de l'éditeur (portée des styles LESS, même nom que le contrôle v1). */
export const EDITOR_ROOT_CLASS = 'JsTimeLine';

/** `Node.ELEMENT_NODE`, sans dépendre du global `Node`. */
const ELEMENT_NODE = 1;

function assertContainer(container: unknown): asserts container is HTMLElement {
  const node = container as { readonly nodeType?: unknown } | null | undefined;
  if (typeof node === 'object' && node !== null && node.nodeType === ELEMENT_NODE) return;
  throw new TypeError(`createEditor : « container » doit être un élément HTML (reçu : ${String(container)}).`);
}

/** Plugins à enregistrer : jeu par défaut (ou son remplaçant), puis `options.plugins`. */
export function resolvePlugins(options: EditorOptions): readonly EditorPlugin[] {
  const base = options.defaultPlugins ?? true;
  const defaults = base === true ? defaultPlugins() : base === false ? [] : base;
  return [...defaults, ...(options.plugins ?? [])];
}

function createRootElement(container: HTMLElement): HTMLElement {
  const element = container.ownerDocument.createElement('div');
  element.classList.add(EDITOR_ROOT_CLASS);
  container.appendChild(element);
  return element;
}

/** Crée les pièces du noyau ; ne touche au DOM qu'une fois les plugins enregistrés. */
function createParts(container: HTMLElement, options: EditorOptions): IEditorParts {
  const registry = createEditorRegistry(options.registry);
  const bus = new EventBus();
  const store = new Store(bus, options.data ?? createEmptyDocument(), {
    registry,
    strictProperties: options.strictProperties,
    onWarning: options.onWarning
  });
  const commands = store.createCommandStack({ limit: options.historyLimit });
  freezeDocument(store.document);
  freezeAnnouncedDocuments(bus);
  const host = new PluginHost<IEditorContext>().registerAll(resolvePlugins(options));
  const clock = options.clock ?? createDefaultClock();
  const playback = new PlaybackController({ bus, store, registry, clock });
  const element = createRootElement(container);
  host.slots.define(ROOT_SLOT, element);
  const lifecycle = new EditorLifecycle();
  const playbackFacade = createPlaybackFacade(playback, (operation) => lifecycle.assertActive(operation));
  const services = new ServiceRegistry();
  return { bus, store, commands, host, services, registry, playback, playbackFacade, element, lifecycle };
}

/** Démarre les plugins ; en cas d'échec, libère les pièces et relance l'erreur. */
function startPlugins(parts: IEditorParts): void {
  const ctx = createEditorContext({
    bus: parts.bus,
    store: parts.store,
    commands: parts.commands,
    slots: parts.host.slots,
    services: parts.services,
    container: parts.element,
    playback: parts.playbackFacade,
    registry: parts.registry,
    assertActive: (operation) => parts.lifecycle.assertActive(operation)
  });
  try {
    parts.host.start(ctx);
  } catch (error) {
    releaseEditorParts(parts);
    parts.lifecycle.finishDestroy();
    throw error;
  }
}

/**
 * Crée et démarre un éditeur dans `container`.
 *
 * @throws TypeError si `container` n'est pas un élément ; `StoreError` si
 *   `options.data` est invalide (cible vivante comprise, ou piste inconnue
 *   avec `strictProperties`) ; `RangeError` si `historyLimit` est
 *   invalide ; `PluginError` (enregistrement, dépendances, emplacements,
 *   `init-failed`, `render-failed`). Dans tous les cas, le conteneur est
 *   laissé tel qu'il était.
 */
export function createEditor(container: HTMLElement, options: EditorOptions = {}): IEditor {
  assertContainer(container);
  const parts = createParts(container, options);
  startPlugins(parts);
  const editor = new Editor(parts);
  parts.bus.emit('editor:ready', { pluginIds: parts.host.order() });
  return editor;
}
