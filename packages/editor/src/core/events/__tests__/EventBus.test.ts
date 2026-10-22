// packages/editor/src/core/events/__tests__/EventBus.test.ts
/**
 * Comportement de l'EventBus : abonnement, ordre, instantané pendant une
 * émission, isolation des erreurs, canal annulable, comptage et nettoyage.
 */

import { ERROR_PREFIX, EventBus } from '../EventBus';
import type { CancellableHandler, EventHandler } from '../EventBus';

interface TestEvents {
  'item:added': { readonly id: string };
  'item:removed': { readonly id: string };
  'count:changed': number;
}

function createBus(onError?: (error: unknown, eventName: string) => void): EventBus<TestEvents> {
  return new EventBus<TestEvents>({ onError });
}

describe('EventBus on / off / emit', () => {
  it('calls a subscribed handler with the payload', () => {
    // Arrange
    const bus = createBus();
    const handler = jest.fn<void, [{ readonly id: string }]>();
    bus.on('item:added', handler);

    // Act
    bus.emit('item:added', { id: 'a' });

    // Assert
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: 'a' });
  });

  it('does not call handlers of other events', () => {
    const bus = createBus();
    const handler = jest.fn();
    bus.on('item:removed', handler);

    bus.emit('item:added', { id: 'a' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when emitting an event without handlers', () => {
    const bus = createBus();

    expect(() => bus.emit('count:changed', 3)).not.toThrow();
  });

  it('stops calling a handler removed with off', () => {
    const bus = createBus();
    const handler = jest.fn();
    bus.on('count:changed', handler);

    bus.off('count:changed', handler);
    bus.emit('count:changed', 1);

    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount('count:changed')).toBe(0);
  });

  it('ignores off for a handler that is not registered', () => {
    const bus = createBus();
    const registered = jest.fn();
    bus.on('count:changed', registered);

    bus.off('count:changed', jest.fn());
    bus.emit('count:changed', 1);

    expect(registered).toHaveBeenCalledTimes(1);
  });

  it('stops calling a handler after its unsubscribe function is called', () => {
    const bus = createBus();
    const handler = jest.fn();
    const unsubscribe = bus.on('count:changed', handler);

    unsubscribe();
    bus.emit('count:changed', 1);

    expect(handler).not.toHaveBeenCalled();
  });

  it('treats a second call to an unsubscribe function as a no-op', () => {
    const bus = createBus();
    const handler = jest.fn();
    const unsubscribeFirst = bus.on('count:changed', handler);
    bus.on('count:changed', handler);

    unsubscribeFirst();
    unsubscribeFirst();
    bus.emit('count:changed', 1);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs handlers synchronously in subscription order', () => {
    const bus = createBus();
    const calls: string[] = [];
    bus.on('count:changed', () => calls.push('first'));
    bus.on('count:changed', () => calls.push('second'));
    bus.on('count:changed', () => calls.push('third'));

    bus.emit('count:changed', 1);
    calls.push('after emit');

    expect(calls).toEqual(['first', 'second', 'third', 'after emit']);
  });
});

describe('EventBus duplicate handlers', () => {
  it('calls a handler registered twice two times', () => {
    const bus = createBus();
    const handler = jest.fn();
    bus.on('count:changed', handler);
    bus.on('count:changed', handler);

    bus.emit('count:changed', 1);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('removes only one registration with off', () => {
    const bus = createBus();
    const handler = jest.fn();
    bus.on('count:changed', handler);
    bus.on('count:changed', handler);

    bus.off('count:changed', handler);
    bus.emit('count:changed', 1);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount('count:changed')).toBe(1);
  });
});

describe('EventBus once', () => {
  it('calls a once handler only on the next emit', () => {
    const bus = createBus();
    const handler = jest.fn();
    bus.once('count:changed', handler);

    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
    expect(bus.listenerCount('count:changed')).toBe(0);
  });

  it('does not call a once handler unsubscribed before the emit', () => {
    const bus = createBus();
    const handler = jest.fn();
    const unsubscribe = bus.once('count:changed', handler);

    unsubscribe();
    bus.emit('count:changed', 1);

    expect(handler).not.toHaveBeenCalled();
  });

  it('can be removed with off using the original handler', () => {
    const bus = createBus();
    const handler = jest.fn();
    bus.once('count:changed', handler);

    bus.off('count:changed', handler);
    bus.emit('count:changed', 1);

    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps permanent handlers while consuming once handlers', () => {
    const bus = createBus();
    const permanent = jest.fn();
    const single = jest.fn();
    bus.on('count:changed', permanent);
    bus.once('count:changed', single);

    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);

    expect(permanent).toHaveBeenCalledTimes(2);
    expect(single).toHaveBeenCalledTimes(1);
  });

  it('does not call a once handler again from a re-entrant emit', () => {
    const bus = createBus();
    const single = jest.fn();
    bus.on('count:changed', (value) => {
      if (value === 1) bus.emit('count:changed', 2);
    });
    bus.once('count:changed', single);

    bus.emit('count:changed', 1);

    expect(single).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledWith(1);
  });
});

describe('EventBus snapshot during emit', () => {
  it('does not call a handler subscribed during the emit until the next emit', () => {
    const bus = createBus();
    const late = jest.fn();
    const subscriber = jest.fn(() => {
      bus.on('count:changed', late);
    });
    bus.once('count:changed', subscriber);

    bus.emit('count:changed', 1);
    expect(late).not.toHaveBeenCalled();
    bus.emit('count:changed', 2);

    expect(late).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledWith(2);
  });

  it('still calls a handler unsubscribed during the emit, but not on the next one', () => {
    const bus = createBus();
    const target = jest.fn();
    let unsubscribeTarget = (): void => undefined;
    bus.on('count:changed', () => unsubscribeTarget());
    unsubscribeTarget = bus.on('count:changed', target);

    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);

    expect(target).toHaveBeenCalledTimes(1);
    expect(target).toHaveBeenCalledWith(1);
  });

  it('keeps calling the snapshot when clear is called during the emit', () => {
    const bus = createBus();
    const second = jest.fn();
    bus.on('count:changed', () => bus.clear());
    bus.on('count:changed', second);

    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);

    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('EventBus error isolation', () => {
  it('reports a throwing handler to onError and keeps calling the others', () => {
    // Arrange
    const onError = jest.fn<void, [unknown, string]>();
    const bus = createBus(onError);
    const failure = new Error('boom');
    const after = jest.fn();
    bus.on('item:added', () => {
      throw failure;
    });
    bus.on('item:added', after);

    // Act
    bus.emit('item:added', { id: 'a' });

    // Assert
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure, 'item:added');
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('reports to console.error with a prefix by default', () => {
    // Arrange
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = new EventBus<TestEvents>();
    const failure = new Error('boom');
    const after = jest.fn();
    bus.on('count:changed', () => {
      throw failure;
    });
    bus.on('count:changed', after);

    try {
      // Act
      bus.emit('count:changed', 1);

      // Assert
      expect(spy).toHaveBeenCalledTimes(1);
      const [message, reported] = spy.mock.calls[0] ?? [];
      expect(String(message).startsWith(ERROR_PREFIX)).toBe(true);
      expect(String(message)).toContain('count:changed');
      expect(reported).toBe(failure);
      expect(after).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('isolates errors thrown by cancellable handlers too', () => {
    const onError = jest.fn<void, [unknown, string]>();
    const bus = createBus(onError);
    const after = jest.fn();
    bus.onCancellable('item:removed', () => {
      throw new Error('boom');
    });
    bus.onCancellable('item:removed', after);

    const result = bus.emitCancellable('item:removed', { id: 'a' });

    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'item:removed');
    expect(after).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });
});

describe('EventBus cancellable events', () => {
  it('returns true when no handler cancels', () => {
    const bus = createBus();
    const handler = jest.fn();
    bus.onCancellable('item:removed', handler);

    const result = bus.emitCancellable('item:removed', { id: 'a' });

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const [event] = handler.mock.calls[0] ?? [];
    expect(event.payload).toEqual({ id: 'a' });
    expect(event.cancelled).toBe(false);
  });

  it('returns true when there are no cancellable handlers', () => {
    const bus = createBus();

    expect(bus.emitCancellable('item:removed', { id: 'a' })).toBe(true);
  });

  it('returns false when a handler cancels, and later handlers still run and see it', () => {
    // Arrange
    const bus = createBus();
    const seen: boolean[] = [];
    bus.onCancellable('item:removed', (event) => seen.push(event.cancelled));
    bus.onCancellable('item:removed', (event) => event.cancel());
    bus.onCancellable('item:removed', (event) => seen.push(event.cancelled));

    // Act
    const result = bus.emitCancellable('item:removed', { id: 'a' });

    // Assert
    expect(result).toBe(false);
    expect(seen).toEqual([false, true]);
  });

  it('creates a fresh, non-cancelled event for every emit', () => {
    const bus = createBus();
    let shouldCancel = true;
    bus.onCancellable('item:removed', (event) => {
      if (shouldCancel) event.cancel();
    });

    const first = bus.emitCancellable('item:removed', { id: 'a' });
    shouldCancel = false;
    const second = bus.emitCancellable('item:removed', { id: 'a' });

    expect(first).toBe(false);
    expect(second).toBe(true);
  });

  it('stops calling a cancellable handler after its unsubscribe function is called', () => {
    const bus = createBus();
    const handler = jest.fn();
    const unsubscribe = bus.onCancellable('item:removed', handler);

    unsubscribe();
    bus.emitCancellable('item:removed', { id: 'a' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('removes a cancellable handler with off', () => {
    const bus = createBus();
    const handler: CancellableHandler<{ readonly id: string }> = jest.fn();
    bus.onCancellable('item:removed', handler);

    bus.off('item:removed', handler);
    bus.emitCancellable('item:removed', { id: 'a' });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('EventBus separate channels', () => {
  it('does not call regular handlers from emitCancellable', () => {
    const bus = createBus();
    const regular = jest.fn();
    bus.on('item:removed', regular);

    bus.emitCancellable('item:removed', { id: 'a' });

    expect(regular).not.toHaveBeenCalled();
  });

  it('does not call cancellable handlers from emit', () => {
    const bus = createBus();
    const cancellable = jest.fn();
    bus.onCancellable('item:removed', cancellable);

    bus.emit('item:removed', { id: 'a' });

    expect(cancellable).not.toHaveBeenCalled();
  });
});

describe('EventBus listenerCount and clear', () => {
  function populated(): EventBus<TestEvents> {
    const bus = createBus();
    const noop: EventHandler<number> = () => undefined;
    bus.on('count:changed', noop);
    bus.once('count:changed', noop);
    bus.on('item:added', () => undefined);
    bus.onCancellable('item:added', () => undefined);
    return bus;
  }

  it('counts registrations of both channels for a name', () => {
    const bus = populated();

    expect(bus.listenerCount('count:changed')).toBe(2);
    expect(bus.listenerCount('item:added')).toBe(2);
    expect(bus.listenerCount('item:removed')).toBe(0);
  });

  it('counts all registrations without a name', () => {
    expect(populated().listenerCount()).toBe(4);
  });

  it('clears both channels of one name only', () => {
    const bus = populated();

    bus.clear('item:added');

    expect(bus.listenerCount('item:added')).toBe(0);
    expect(bus.listenerCount('count:changed')).toBe(2);
  });

  it('clears everything without a name', () => {
    const bus = populated();
    const handler = jest.fn();
    bus.on('item:removed', handler);

    bus.clear();
    bus.emit('item:removed', { id: 'a' });

    expect(bus.listenerCount()).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });
});
