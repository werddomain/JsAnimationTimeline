// packages/editor/src/core/playback/__tests__/defaultClock.test.ts
/**
 * Tests de l'horloge par défaut de l'éditeur : horloge du navigateur quand
 * `requestAnimationFrame` existe, sinon minuteries annulables ; et éditeur
 * créé sans `requestAnimationFrame` qui rend quand même sa première image.
 */

import { createDefaultClock, createTimerClock } from '../defaultClock';
import { createEditor } from '../../editor/createEditor';
import { cleanBody, createContainer } from '../../editor/__tests__/fixtures';

afterEach(() => {
  cleanBody();
  jest.useRealTimers();
});

/** Exécute `fn` avec `requestAnimationFrame` retiré de la fenêtre. */
function withoutAnimationFrame(fn: () => void): void {
  const original = window.requestAnimationFrame;
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: undefined });
  try {
    fn();
  } finally {
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: original });
  }
}

describe('createTimerClock', () => {
  it('runs a requested frame after a timer and cancels it by handle', () => {
    // Arrange
    jest.useFakeTimers();
    const clock = createTimerClock();
    const calls: string[] = [];

    // Act
    clock.requestFrame(() => calls.push('a'));
    const cancelled = clock.requestFrame(() => calls.push('b'));
    clock.cancelFrame(cancelled);
    clock.cancelFrame(999);
    jest.advanceTimersByTime(20);

    // Assert
    expect(calls).toEqual(['a']);
    expect(jest.getTimerCount()).toBe(0);
    expect(typeof clock.now()).toBe('number');
  });
});

describe('createDefaultClock', () => {
  it('uses requestAnimationFrame when it exists', () => {
    // Arrange
    const raf = jest.spyOn(window, 'requestAnimationFrame');
    const clock = createDefaultClock();

    // Act
    const handle = clock.requestFrame(() => undefined);
    clock.cancelFrame(handle);

    // Assert
    expect(raf).toHaveBeenCalledTimes(1);
    raf.mockRestore();
  });

  it('falls back to timers without requestAnimationFrame, so the editor still renders', () => {
    // Arrange
    jest.useFakeTimers();
    const frames: number[] = [];

    withoutAnimationFrame(() => {
      // Act
      const editor = createEditor(createContainer(), { defaultPlugins: false });
      editor.onFrame((sample) => frames.push(sample.time.integerFrame));
      jest.advanceTimersByTime(20);
      editor.destroy();
    });

    // Assert
    expect(frames).toEqual([1]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
