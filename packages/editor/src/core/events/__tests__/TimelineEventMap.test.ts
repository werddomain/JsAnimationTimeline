// packages/editor/src/core/events/__tests__/TimelineEventMap.test.ts
/**
 * Vérifie au niveau des types (ts-jest compile ce fichier avec vérification
 * des types) que la TimelineEventMap s'enrichit par augmentation de module,
 * comme le fera chaque plugin, et que les erreurs de nom ou de charge utile
 * sont refusées par le compilateur.
 */

import { EventBus } from '../EventBus';
import type { EventName } from '../EventBus';
import type { EditorReadyEvent, TimelineEventMap } from '../TimelineEventMap';

declare module '../TimelineEventMap' {
  interface TimelineEventMap {
    'test:colorChanged': { readonly layerId: string; readonly color: string };
  }
}

/** Échoue à la compilation si les deux types ne sont pas identiques. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

function assertType<T extends true>(value: T): T {
  return value;
}

describe('TimelineEventMap augmentation', () => {
  it('exposes the core events and the augmented event on the default bus', () => {
    // Arrange
    const bus = new EventBus();
    const received: string[] = [];
    bus.on('test:colorChanged', (payload) => received.push(`${payload.layerId}=${payload.color}`));
    bus.on('editor:ready', (payload) => received.push(payload.pluginIds.join(',')));

    // Act
    bus.emit('test:colorChanged', { layerId: 'l1', color: '#f00' });
    bus.emit('editor:ready', { pluginIds: ['core', 'layers.list'] });
    bus.emit('editor:destroying', {});

    // Assert
    expect(received).toEqual(['l1=#f00', 'core,layers.list']);
  });

  it('infers the payload type from the event name', () => {
    assertType<Equals<TimelineEventMap['editor:ready'], EditorReadyEvent>>(true);
    assertType<Equals<TimelineEventMap['editor:destroying']['reason'], string | undefined>>(true);
    assertType<
      Equals<TimelineEventMap['test:colorChanged'], { readonly layerId: string; readonly color: string }>
    >(true);
    expect(true).toBe(true);
  });

  it('lists the augmented name among the event names', () => {
    assertType<
      Equals<
        EventName<TimelineEventMap>,
        'editor:ready' | 'editor:destroying' | 'test:colorChanged'
      >
    >(true);
    expect(true).toBe(true);
  });

  it('rejects wrong payloads and unknown event names at compile time', () => {
    // Arrange
    const bus = new EventBus();
    const onError = jest.fn();
    const silentBus = new EventBus({ onError });

    // Act : chaque ligne marquée doit être une erreur de compilation.
    // @ts-expect-error la couleur doit être une chaîne
    bus.emit('test:colorChanged', { layerId: 'l1', color: 42 });
    // @ts-expect-error il manque layerId
    bus.emit('test:colorChanged', { color: '#f00' });
    // @ts-expect-error pluginIds doit être une liste de chaînes
    bus.emit('editor:ready', { pluginIds: 'core' });
    // @ts-expect-error événement inconnu
    bus.emit('test:unknown', {});
    // @ts-expect-error événement inconnu pour un abonnement
    bus.on('test:unknown', () => undefined);
    // @ts-expect-error le gestionnaire lit un champ absent de la charge utile
    silentBus.on('editor:ready', (payload) => payload.missing.length);
    // @ts-expect-error événement inconnu pour un abonnement annulable
    bus.onCancellable('test:unknown', () => undefined);
    // @ts-expect-error mauvaise charge utile pour une émission annulable
    bus.emitCancellable('test:colorChanged', { layerId: 1, color: '#f00' });
    silentBus.emit('editor:ready', { pluginIds: [] });

    // Assert : le gestionnaire fautif a bien levé une erreur à l'exécution.
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError), 'editor:ready');
  });
});
