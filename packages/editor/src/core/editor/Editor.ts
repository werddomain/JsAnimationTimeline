// packages/editor/src/core/editor/Editor.ts
/**
 * Implémentation de `IEditor` : délègue au Store, à la `CommandStack`, à
 * l'`EventBus` et au registre des services créés par `createEditor()`, et
 * gère la destruction (ordre : `editor:destroying`, `destroy` des plugins en
 * ordre inverse, abonnements, services, emplacement racine, élément racine).
 *
 * Interne au noyau : l'application ne reçoit que le type `IEditor`.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { CommandStack } from '../commands/CommandStack';
import type { ICommand } from '../commands/ICommand';
import type {
  EditorEventName,
  EditorServiceId,
  EditorServiceMap,
  IEditorContext
} from '../context/IEditorContext';
import type { ServiceRegistry } from '../context/ServiceRegistry';
import type { EventBus, EventHandler } from '../events/EventBus';
import type { EditorDestroyingEvent, TimelineEventMap } from '../events/TimelineEventMap';
import type { PluginHost } from '../plugin/PluginHost';
import { ROOT_SLOT } from '../plugin/SlotRegistry';
import type { Store } from '../store/Store';
import type { EditorLifecycle } from './EditorLifecycle';
import type { IEditor } from './types';

/** Pièces d'un éditeur, créées par `createEditor()`. */
export interface IEditorParts {
  readonly bus: EventBus;
  readonly store: Store;
  readonly commands: CommandStack;
  readonly host: PluginHost<IEditorContext>;
  readonly services: ServiceRegistry;
  /** Élément racine (classe `JsTimeLine`), défini comme `ROOT_SLOT`. */
  readonly element: HTMLElement;
  readonly lifecycle: EditorLifecycle;
}

/**
 * Libère ce que l'éditeur a mis en place hors des plugins : services,
 * abonnements, emplacement racine et élément racine. Sert à `destroy` et à
 * l'annulation d'un démarrage raté.
 */
export function releaseEditorParts(parts: IEditorParts): void {
  parts.services.clear();
  parts.bus.clear();
  parts.host.slots.remove(ROOT_SLOT);
  parts.element.remove();
}

/** Éditeur v2 retourné par `createEditor()`. */
export class Editor implements IEditor {
  constructor(private readonly parts: IEditorParts) {}

  get isDestroyed(): boolean {
    return this.parts.lifecycle.isDestroyed;
  }

  get container(): HTMLElement {
    this.assertActive('container');
    return this.parts.element;
  }

  get document(): ITimelineDocument {
    this.assertActive('document');
    return this.parts.store.document;
  }

  get canUndo(): boolean {
    this.assertActive('canUndo');
    return this.parts.commands.canUndo;
  }

  get canRedo(): boolean {
    this.assertActive('canRedo');
    return this.parts.commands.canRedo;
  }

  on<K extends EditorEventName>(name: K, handler: EventHandler<TimelineEventMap[K]>): () => void {
    this.assertActive('on');
    return this.parts.bus.on(name, handler);
  }

  once<K extends EditorEventName>(name: K, handler: EventHandler<TimelineEventMap[K]>): () => void {
    this.assertActive('once');
    return this.parts.bus.once(name, handler);
  }

  off<K extends EditorEventName>(name: K, handler: EventHandler<TimelineEventMap[K]>): void {
    this.assertActive('off');
    this.parts.bus.off(name, handler);
  }

  execute(command: ICommand): boolean {
    this.assertActive('execute');
    return this.parts.commands.execute(command);
  }

  undo(): boolean {
    this.assertActive('undo');
    return this.parts.commands.undo();
  }

  redo(): boolean {
    this.assertActive('redo');
    return this.parts.commands.redo();
  }

  toJSON(): ITimelineDocument {
    this.assertActive('toJSON');
    return this.parts.store.document;
  }

  load(doc: ITimelineDocument): void {
    this.assertActive('load');
    this.parts.store.load(doc);
  }

  getService<K extends EditorServiceId>(id: K): EditorServiceMap[K] | undefined {
    this.assertActive('getService');
    return this.parts.services.get(id);
  }

  destroy(reason?: string): void {
    const { lifecycle, bus, host } = this.parts;
    if (!lifecycle.beginDestroy()) return;
    const payload: EditorDestroyingEvent = reason === undefined ? {} : { reason };
    try {
      bus.emit('editor:destroying', payload);
      host.destroy();
    } finally {
      releaseEditorParts(this.parts);
      lifecycle.finishDestroy();
    }
  }

  private assertActive(operation: string): void {
    this.parts.lifecycle.assertActive(operation);
  }
}
