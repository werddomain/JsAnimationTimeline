// packages/editor/src/core/events/__tests__/EventBus.cancellable.test.ts
/**
 * Isolation des erreurs de l'EventBus (onError personnalisé, rapporteur par
 * défaut, onError qui lève) et canal annulable (annulation, valeur de
 * retour, sémantique fail-closed, retraits pendant une émission).
 */

import { ERROR_PREFIX, EventBus } from '../EventBus';
import type { CancellableHandler } from '../EventBus';
import { createBus } from './testBus';
import type { TestEvents } from './testBus';

function silenceConsoleError(): jest.SpyInstance {
  return jest.spyOn(console, 'error').mockImplementation(() => undefined);
}

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
    const spy = silenceConsoleError();
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

  it('keeps emitting and logs both errors when onError throws', () => {
    // Arrange
    const spy = silenceConsoleError();
    const reporterFailure = new Error('reporter down');
    const bus = createBus(() => {
      throw reporterFailure;
    });
    const failure = new Error('boom');
    const after = jest.fn();
    bus.on('count:changed', () => {
      throw failure;
    });
    bus.on('count:changed', after);

    try {
      // Act
      const act = (): void => bus.emit('count:changed', 1);

      // Assert
      expect(act).not.toThrow();
      expect(after).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledTimes(1);
      const [message, loggedReporterError, loggedError] = spy.mock.calls[0] ?? [];
      expect(String(message).startsWith(ERROR_PREFIX)).toBe(true);
      expect(String(message)).toContain('count:changed');
      expect(loggedReporterError).toBe(reporterFailure);
      expect(loggedError).toBe(failure);
    } finally {
      spy.mockRestore();
    }
  });

  it('still returns from emitCancellable when onError throws', () => {
    const spy = silenceConsoleError();
    const bus = createBus(() => {
      throw new Error('reporter down');
    });
    const after = jest.fn();
    bus.onCancellable('item:removed', () => {
      throw new Error('boom');
    });
    bus.onCancellable('item:removed', after);

    try {
      const result = bus.emitCancellable('item:removed', { id: 'a' });

      expect(result).toBe(false);
      expect(after).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
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

  it('treats a throwing handler as a veto (fail-closed) and reports it', () => {
    // Arrange
    const onError = jest.fn<void, [unknown, string]>();
    const bus = createBus(onError);
    const failure = new Error('lock check crashed');
    const seen: boolean[] = [];
    bus.onCancellable('item:removed', () => {
      throw failure;
    });
    bus.onCancellable('item:removed', (event) => seen.push(event.cancelled));

    // Act
    const result = bus.emitCancellable('item:removed', { id: 'a' });

    // Assert
    expect(result).toBe(false);
    expect(seen).toEqual([true]);
    expect(onError).toHaveBeenCalledWith(failure, 'item:removed');
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

  it('skips a cancellable handler removed by an earlier handler of the same emit', () => {
    const bus = createBus();
    const veto: CancellableHandler<{ readonly id: string }> = jest.fn((event) => event.cancel());
    bus.onCancellable('item:removed', () => bus.off('item:removed', veto));
    bus.onCancellable('item:removed', veto);

    const result = bus.emitCancellable('item:removed', { id: 'a' });

    expect(veto).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
