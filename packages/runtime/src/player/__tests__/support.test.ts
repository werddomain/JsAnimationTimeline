// packages/runtime/src/player/__tests__/support.test.ts
/**
 * Event emitter, target resolution and the browser clock.
 */

import { createBrowserClock } from '../clock';
import { EventEmitter } from '../EventEmitter';
import { resolveTarget } from '../targets';
import type { ILayer } from '../../model/layer';

describe('EventEmitter', () => {
  interface IMap {
    ping: { n: number };
    pong: Record<string, never>;
  }

  const fail = (error: unknown): void => {
    throw error;
  };

  it('isolates a throwing listener and hands its error to onError', () => {
    const errors: unknown[] = [];
    const emitter = new EventEmitter<IMap>((error) => errors.push(error));
    const after = jest.fn();
    const boom = new Error('boom');
    emitter.on('ping', () => {
      throw boom;
    });
    emitter.on('ping', after);
    emitter.emit('ping', { n: 1 });
    expect(errors).toEqual([boom]);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('calls listeners in order with the payload', () => {
    const emitter = new EventEmitter<IMap>(fail);
    const calls: string[] = [];
    emitter.on('ping', ({ n }) => calls.push(`a${n}`));
    emitter.on('ping', ({ n }) => calls.push(`b${n}`));
    emitter.emit('ping', { n: 1 });
    emitter.emit('pong', {});
    expect(calls).toEqual(['a1', 'b1']);
  });

  it('lets a listener remove itself while emitting', () => {
    const emitter = new EventEmitter<IMap>(fail);
    const later = jest.fn();
    const remove = emitter.on('ping', () => remove());
    emitter.on('ping', later);
    emitter.emit('ping', { n: 1 });
    emitter.emit('ping', { n: 2 });
    expect(later).toHaveBeenCalledTimes(2);
  });

  it('clears every listener', () => {
    const emitter = new EventEmitter<IMap>(fail);
    const listener = jest.fn();
    emitter.on('ping', listener);
    emitter.clear();
    emitter.emit('ping', { n: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('resolveTarget', () => {
  const base: ILayer = { id: 'l', type: 'layer', name: 'L', spans: [] };

  beforeEach(() => {
    document.body.innerHTML = '<p class="t"></p>';
  });

  it('returns null without a target', () => {
    expect(resolveTarget(base, document)).toBeNull();
  });

  it('finds a selector in root, or returns null', () => {
    expect(resolveTarget({ ...base, target: { selector: '.t' } }, document)).toBe(document.querySelector('.t'));
    expect(resolveTarget({ ...base, target: { selector: '.none' } }, document)).toBeNull();
  });

  it('returns an element target as is', () => {
    const element = document.createElement('b');
    expect(resolveTarget({ ...base, target: { element } }, document)).toBe(element);
  });
});

describe('createBrowserClock', () => {
  it('uses requestAnimationFrame and performance.now', () => {
    const request = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 7;
    });
    const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const clock = createBrowserClock();
    const callback = jest.fn();
    expect(clock.requestFrame(callback)).toBe(7);
    expect(callback).toHaveBeenCalledTimes(1);
    clock.cancelFrame(7);
    expect(cancel).toHaveBeenCalledWith(7);
    expect(typeof clock.now()).toBe('number');
    request.mockRestore();
    cancel.mockRestore();
  });

  it('throws without requestAnimationFrame', () => {
    const original = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', { value: undefined, configurable: true, writable: true });
    try {
      expect(() => createBrowserClock()).toThrow('requestAnimationFrame is not available');
    } finally {
      Object.defineProperty(window, 'requestAnimationFrame', { value: original, configurable: true, writable: true });
    }
  });
});
