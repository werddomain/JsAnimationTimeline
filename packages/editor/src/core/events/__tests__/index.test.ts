// packages/editor/src/core/events/__tests__/index.test.ts
/**
 * API publique du module d'événements.
 */

import * as events from '../index';
import type { CancellableHandler, EventBusOptions, EventHandler, ICancellableEvent } from '../index';

describe('core/events index', () => {
  it('exports only the runtime values of the public API', () => {
    expect(Object.keys(events).sort()).toEqual(['ERROR_PREFIX', 'EventBus']);
    expect(events.ERROR_PREFIX).toBe('[EventBus]');
  });

  it('exposes types usable to build a bus', () => {
    const options: EventBusOptions = { onError: () => undefined };
    const bus = new events.EventBus<{ ping: number }>(options);
    const handler: EventHandler<number> = jest.fn();
    const veto: CancellableHandler<number> = (event: ICancellableEvent<number>) => event.cancel();
    bus.on('ping', handler);
    bus.onCancellable('ping', veto);

    bus.emit('ping', 1);

    expect(handler).toHaveBeenCalledWith(1);
    expect(bus.emitCancellable('ping', 1)).toBe(false);
  });
});
