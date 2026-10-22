// packages/editor/src/core/events/__tests__/EventBus.test.ts
/**
 * Comportement de l'EventBus : abonnement, ordre, doublons, `once`,
 * instantané et retraits pendant une émission, canaux séparés, comptage et
 * nettoyage. L'isolation des erreurs et le canal annulable sont couverts par
 * EventBus.cancellable.test.ts.
 */

import type { EventBus, EventHandler } from '../EventBus';
import { createBus } from './testBus';
import type { TestEvents } from './testBus';

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

  it('calls a once handler a single time when an earlier handler re-emits', () => {
    // Arrange : le gestionnaire réentrant précède le `once`, qui est donc
    // consommé par l'émission imbriquée (sémantique DOM et Node).
    const bus = createBus();
    const single = jest.fn();
    bus.on('count:changed', (value) => {
      if (value === 1) bus.emit('count:changed', 2);
    });
    bus.once('count:changed', single);

    // Act
    bus.emit('count:changed', 1);

    // Assert
    expect(single).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledWith(2);
    expect(bus.listenerCount('count:changed')).toBe(1);
  });

  it('does not call a once handler again when it re-emits itself', () => {
    const bus = createBus();
    const values: number[] = [];
    bus.once('count:changed', (value) => {
      values.push(value);
      bus.emit('count:changed', value + 1);
    });

    bus.emit('count:changed', 1);

    expect(values).toEqual([1]);
  });
});

describe('EventBus subscriptions and removals during an emit', () => {
  it('does not call a handler subscribed during the emit until the next emit', () => {
    const bus = createBus();
    const late = jest.fn();
    bus.once('count:changed', () => {
      bus.on('count:changed', late);
    });

    bus.emit('count:changed', 1);
    expect(late).not.toHaveBeenCalled();
    bus.emit('count:changed', 2);

    expect(late).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledWith(2);
  });

  it('skips a handler unsubscribed by an earlier handler of the same emit', () => {
    const bus = createBus();
    const target = jest.fn();
    let unsubscribeTarget = (): void => undefined;
    bus.on('count:changed', () => unsubscribeTarget());
    unsubscribeTarget = bus.on('count:changed', target);

    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);

    expect(target).not.toHaveBeenCalled();
  });

  it('skips a handler removed with off by an earlier handler of the same emit', () => {
    const bus = createBus();
    const target = jest.fn();
    bus.on('count:changed', () => bus.off('count:changed', target));
    bus.on('count:changed', target);

    bus.emit('count:changed', 1);

    expect(target).not.toHaveBeenCalled();
  });

  it('skips a once handler removed with off by an earlier handler of the same emit', () => {
    const bus = createBus();
    const single = jest.fn();
    bus.on('count:changed', () => bus.off('count:changed', single));
    bus.once('count:changed', single);

    bus.emit('count:changed', 1);

    expect(single).not.toHaveBeenCalled();
    expect(bus.listenerCount('count:changed')).toBe(1);
  });

  it('skips the remaining handlers when clear is called during the emit', () => {
    const bus = createBus();
    const second = jest.fn();
    bus.on('count:changed', () => bus.clear());
    bus.on('count:changed', second);

    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);

    expect(second).not.toHaveBeenCalled();
  });

  it('keeps calling the other handlers when one unsubscribes itself', () => {
    const bus = createBus();
    const calls: string[] = [];
    const unsubscribeSelf = bus.on('count:changed', () => {
      calls.push('self');
      unsubscribeSelf();
    });
    bus.on('count:changed', () => calls.push('other'));

    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);

    expect(calls).toEqual(['self', 'other', 'other']);
  });

  it('does not reach a plugin torn down by an earlier destroying handler', () => {
    // Arrange : le plugin A détruit le plugin B pendant la même émission.
    const bus = createBus();
    const pluginB = { destroyed: false, unsubscribe: (): void => undefined };
    const useAfterDestroy = jest.fn();
    bus.on('item:removed', () => {
      pluginB.unsubscribe();
      pluginB.destroyed = true;
    });
    pluginB.unsubscribe = bus.on('item:removed', () => {
      if (pluginB.destroyed) useAfterDestroy();
    });

    // Act
    bus.emit('item:removed', { id: 'a' });

    // Assert
    expect(pluginB.destroyed).toBe(true);
    expect(useAfterDestroy).not.toHaveBeenCalled();
    expect(bus.listenerCount('item:removed')).toBe(1);
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

  it('accepts new subscriptions after clear', () => {
    const bus = populated();
    const handler = jest.fn();

    bus.clear();
    bus.on('count:changed', handler);
    bus.emit('count:changed', 1);

    expect(handler).toHaveBeenCalledWith(1);
  });
});
