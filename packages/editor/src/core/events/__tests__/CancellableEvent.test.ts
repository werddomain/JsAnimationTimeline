// packages/editor/src/core/events/__tests__/CancellableEvent.test.ts
/**
 * Implémentation interne de l'événement annulable.
 */

import { CancellableEvent } from '../CancellableEvent';

describe('CancellableEvent', () => {
  it('exposes the payload and starts not cancelled', () => {
    const event = new CancellableEvent({ id: 'a' });

    expect(event.payload).toEqual({ id: 'a' });
    expect(event.cancelled).toBe(false);
  });

  it('stays cancelled after repeated cancel calls', () => {
    const event = new CancellableEvent(1);

    event.cancel();
    event.cancel();

    expect(event.cancelled).toBe(true);
  });
});
