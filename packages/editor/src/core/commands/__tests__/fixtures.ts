// packages/editor/src/core/commands/__tests__/fixtures.ts
/**
 * Fixtures partagées des tests du Store et de la CommandStack : document v2
 * valide figé en profondeur, commandes pures d'exemple, enregistreur
 * d'événements et fabrique Store + pile.
 */

import type { ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { EventBus } from '../../events/EventBus';
import type { TimelineEventMap } from '../../events/TimelineEventMap';
import { Store } from '../../store/Store';
import type { CommandStack, CommandStackOptions } from '../CommandStack';
import { CommandRefusedError } from '../CommandRefusedError';
import { createCommand } from '../createCommand';
import type { ICommand } from '../ICommand';

/** Fige récursivement `value` (objets et tableaux) et le retourne. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}

/** Document v2 valide (deux calques), figé en profondeur. */
export function createDocument(fps = 24): ITimelineDocument {
  return deepFreeze<ITimelineDocument>({
    version: '2.0.0',
    settings: { fps, totalFrames: 48 },
    layers: [
      { id: 'l1', type: 'layer', name: 'Logo', spans: [{ id: 's1', start: 1, end: 48, kind: 'static' }] },
      { id: 'l2', type: 'layer', name: 'Fond', locked: true, spans: [] }
    ]
  });
}

function withLayerName(doc: ITimelineDocument, layerId: string, name: string): ITimelineDocument {
  const rename = (node: LayerNode): LayerNode => (node.id === layerId ? { ...node, name } : node);
  return { ...doc, layers: doc.layers.map(rename) };
}

/** Nom du calque de premier niveau `layerId` ('' s'il est absent). */
export function layerName(doc: ITimelineDocument, layerId: string): string {
  return doc.layers.find((node) => node.id === layerId)?.name ?? '';
}

/** Commande pure : renomme un calque de premier niveau (undo restaure l'ancien nom). */
export function renameLayer(layerId: string, name: string, previousName: string): ICommand {
  return createCommand(
    `Renommer ${layerId} en ${name}`,
    (doc) => withLayerName(doc, layerId, name),
    (doc) => withLayerName(doc, layerId, previousName)
  );
}

/** Commande pure : change les fps (undo restaure `previousFps`). */
export function setFps(fps: number, previousFps: number): ICommand {
  return createCommand(
    `Fps ${fps}`,
    (doc) => ({ ...doc, settings: { ...doc.settings, fps } }),
    (doc) => ({ ...doc, settings: { ...doc.settings, fps: previousFps } })
  );
}

/** Commande qui refuse si le calque est verrouillé (règle du verrou dans la commande). */
export function renameUnlessLocked(layerId: string, name: string, previousName: string): ICommand {
  const label = `Renommer ${layerId}`;
  const assertUnlocked = (doc: ITimelineDocument): void => {
    const node = doc.layers.find((candidate) => candidate.id === layerId);
    if (node?.locked === true) throw new CommandRefusedError(label, 'calque verrouillé');
  };
  return createCommand(
    label,
    (doc) => {
      assertUnlocked(doc);
      return withLayerName(doc, layerId, name);
    },
    (doc) => {
      assertUnlocked(doc);
      return withLayerName(doc, layerId, previousName);
    }
  );
}

/** Commande sans effet : retourne la même référence. */
export const NOOP_COMMAND: ICommand = createCommand('Rien', (doc) => doc, (doc) => doc);

/** Enregistre, dans l'ordre, les émissions ordinaires des événements demandés. */
export function recordEvents<K extends keyof TimelineEventMap & string>(
  bus: EventBus,
  names: readonly K[]
): Array<{ readonly name: K; readonly payload: TimelineEventMap[K] }> {
  const events: Array<{ readonly name: K; readonly payload: TimelineEventMap[K] }> = [];
  names.forEach((name) => bus.on(name, (payload) => events.push({ name, payload })));
  return events;
}

/** Ensemble bus + Store + pile prêt à l'emploi. */
export interface IHarness {
  readonly bus: EventBus;
  readonly store: Store;
  readonly stack: CommandStack;
  readonly onError: jest.Mock;
}

/** Crée un bus (erreurs capturées par `onError`), un Store et sa pile. */
export function createHarness(options: CommandStackOptions = {}): IHarness {
  const onError = jest.fn();
  const bus = new EventBus({ onError });
  const store = new Store(bus, createDocument());
  const stack = store.createCommandStack(options);
  return { bus, store, stack, onError };
}
