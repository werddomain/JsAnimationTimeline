// packages/editor/src/core/editor/createPropertyTimelines.ts
import { PropertyTimelineCommand } from '../../model/propertyTimelines/PropertyTimelineCommand';
import type { PropertyTimelineOperation } from '../../model/propertyTimelines/types';
import { PropertyOperationError } from '../../model/properties/propertyValue';
import type { IEditorParts } from './Editor';
import { propertyChanges } from './propertyChangeEvents';
import type { IEditorPropertyTimelines, IPropertyTimelineTransaction, PropertyTimelineMutationResult } from './propertyTimelineTypes';

/** Frozen closures expose neither the command stack nor mutable editor internals. */
export function createPropertyTimelines(parts: IEditorParts): IEditorPropertyTimelines {
  const { commands, bus, lifecycle, playbackFacade, registry, stageHost } = parts;
  const transactionIds = new WeakMap<object, string>();
  let sequence = 0;
  let loadVersion = 0;
  const transactionId = (token: object | undefined): string | undefined => {
    if (token === undefined) return undefined;
    let id = transactionIds.get(token);
    if (id === undefined) {
      id = `property-transaction-${++sequence}`;
      transactionIds.set(token, id);
    }
    return id;
  };
  bus.on('document:loaded', () => { loadVersion++; });
  const stopObserving = parts.store.observeCommits((event, token) => {
    const version = loadVersion;
    const id = transactionId(token);
    for (const change of propertyChanges(event, registry, id)) {
      if (lifecycle.isDestroyed || loadVersion !== version) break;
      bus.emit('property:changed', change);
    }
  });
  bus.on('editor:destroying', stopObserving);
  const apply = (operation: PropertyTimelineOperation): PropertyTimelineMutationResult => {
    lifecycle.assertActive('propertyTimelines');
    const command = new PropertyTimelineCommand(operation, {
      registry,
      describe: (target) => {
        try { return stageHost.describeForEdit(target); }
        catch { throw new PropertyOperationError('Les propriétés de la cible sont indisponibles.'); }
      }
    });
    let reason: string | undefined;
    const off = bus.on('command:refused', (event) => {
      if (event.command === command) reason = event.reason;
    });
    try {
      const changed = commands.execute(command);
      if (changed) return { status: 'changed' };
      if (reason !== undefined) return { status: 'refused', reason };
      if (lifecycle.isDestroyed) return { status: 'refused', reason: 'La commande a été annulée car l’éditeur a été détruit.' };
      return { status: 'noop' };
    } finally { off(); }
  };
  const beginTransaction = (label: string): IPropertyTimelineTransaction => {
    lifecycle.assertActive('propertyTimelines.beginTransaction');
    const token = commands.beginGroup(label);
    const active = (): boolean => !lifecycle.isDestroyed && commands.groupToken === token;
    const assertActive = (): void => {
      lifecycle.assertActive('propertyTimelines.transaction');
      if (!active()) throw new Error('Cette transaction de propriétés n’est plus active.');
    };
    return Object.freeze({
      get active(): boolean { return active(); },
      commit: (): boolean => { assertActive(); return commands.endGroup(); },
      cancel: (): void => { assertActive(); commands.cancelGroup(); }
    });
  };
  return Object.freeze<IEditorPropertyTimelines>({
    set: (layerId, property, value, options = {}) => apply({ kind: 'set', layerId, property, value,
      frame: options.frame ?? playbackFacade.frame, initialValue: options.initialValue }),
    capture: (layerId, property, options = {}) => apply({ kind: 'capture', layerId, property,
      frame: options.frame ?? playbackFacade.frame, initialValue: options.initialValue }),
    deleteKey: (layerId, property, frame) => apply({ kind: 'delete-key', layerId, property, frame: frame ?? playbackFacade.frame }),
    moveKey: (layerId, property, frame, toFrame) => apply({ kind: 'move-key', layerId, property, frame, toFrame }),
    createTransition: (layerId, property, frames, easing) => apply({ kind: 'create-transition', layerId, property, frames, easing }),
    removeTransition: (layerId, property, transitionId) => apply({ kind: 'remove-transition', layerId, property, transitionId }),
    setEasing: (layerId, property, transitionId, easing) => apply({ kind: 'set-easing', layerId, property, transitionId, easing }),
    migrate: (layerId, property) => apply({ kind: 'migrate', layerId, property }),
    beginTransaction
  });
}
