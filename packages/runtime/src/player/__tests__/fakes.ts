// packages/runtime/src/player/__tests__/fakes.ts
/**
 * Doubles de test : horloge pilotée à la main et faux `Element.animate`
 * (jsdom n'implémente pas Web Animations).
 */

import type { IPlayerClock } from '../types';

/** Clock whose time and frames advance only when the test says so. */
export class FakeClock implements IPlayerClock {
  time = 0;
  private nextHandle = 1;
  private readonly callbacks = new Map<number, () => void>();

  now(): number {
    return this.time;
  }

  requestFrame(callback: () => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancelFrame(handle: number): void {
    this.callbacks.delete(handle);
  }

  get pendingFrames(): number {
    return this.callbacks.size;
  }

  /** Advances the time by `ms`, then runs the pending frame callbacks once. */
  advance(ms: number): void {
    this.time += ms;
    const pending = Array.from(this.callbacks.values());
    this.callbacks.clear();
    pending.forEach((callback) => callback());
  }
}

/** Minimal stand-in for a Web Animations `Animation`. */
export class FakeAnimation {
  currentTime: number | null = 0;
  playbackRate = 1;
  playState: 'running' | 'paused' | 'idle' = 'running';

  constructor(
    readonly target: Element,
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions
  ) {}

  play(): void {
    this.playState = 'running';
  }

  pause(): void {
    this.playState = 'paused';
  }

  cancel(): void {
    this.playState = 'idle';
  }
}

/** Installs a fake `Element.prototype.animate`; returns the created animations and a restore function. */
export function installFakeAnimate(): { animations: FakeAnimation[]; restore: () => void } {
  const animations: FakeAnimation[] = [];
  const proto = Element.prototype as { animate?: Element['animate'] };
  const original = proto.animate;
  proto.animate = function animate(this: Element, keyframes, options) {
    const animation = new FakeAnimation(this, keyframes as Keyframe[], options as KeyframeAnimationOptions);
    animations.push(animation);
    return animation as unknown as Animation;
  };
  return {
    animations,
    restore: () => {
      if (original === undefined) {
        delete proto.animate;
      } else {
        proto.animate = original;
      }
    }
  };
}
