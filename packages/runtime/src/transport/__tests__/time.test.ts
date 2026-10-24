// packages/runtime/src/transport/__tests__/time.test.ts
/**
 * Conversion temps → images : image fractionnaire, image entière (tolérance,
 * bornes), durée et validations.
 */

import { assertValidSpeed, assertValidTimeline, frameToTime, timelineDuration, toTransportTime } from '../time';

const timeline = { fps: 10, totalFrames: 10 };

describe('toTransportTime', () => {
  it('maps a time to the fractional and integer frames', () => {
    expect(toTransportTime(0, timeline)).toEqual({ timeMs: 0, frame: 1, integerFrame: 1 });
    expect(toTransportTime(250, timeline)).toEqual({ timeMs: 250, frame: 3.5, integerFrame: 3 });
  });

  it('reaches totalFrames + 1 as fractional frame at the end, but keeps the last integer frame', () => {
    expect(toTransportTime(1000, timeline)).toEqual({ timeMs: 1000, frame: 11, integerFrame: 10 });
  });

  it('absorbs float noise just before a frame start', () => {
    // (3 - 1) / 30 * 1000 is not exact in binary; still frame 3.
    const time = frameToTime(3, 30);
    expect(toTransportTime(time - 1e-9, { fps: 30, totalFrames: 60 }).integerFrame).toBe(3);
    expect(toTransportTime(99.9, timeline).integerFrame).toBe(1);
  });

  it('clamps the integer frame to 1..totalFrames', () => {
    expect(toTransportTime(-50, timeline).integerFrame).toBe(1);
    expect(toTransportTime(5000, timeline).integerFrame).toBe(10);
  });
});

describe('frameToTime and timelineDuration', () => {
  it('converts a frame to its start time', () => {
    expect(frameToTime(1, 24)).toBe(0);
    expect(frameToTime(6, 10)).toBe(500);
  });

  it('computes the duration in milliseconds', () => {
    expect(timelineDuration({ fps: 24, totalFrames: 48 })).toBe(2000);
  });
});

describe('validation', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses fps %p', (fps) => {
    expect(() => assertValidTimeline({ fps, totalFrames: 10 })).toThrow('fps must be a finite number above 0');
  });

  it.each([0, 1.5, Number.NaN])('refuses totalFrames %p', (totalFrames) => {
    expect(() => assertValidTimeline({ fps: 10, totalFrames })).toThrow('totalFrames must be an integer of at least 1');
  });

  it('accepts a valid timeline and speed', () => {
    expect(() => assertValidTimeline({ fps: 29.97, totalFrames: 1 })).not.toThrow();
    expect(() => assertValidSpeed(0.25)).not.toThrow();
  });

  it.each([0, -2, Number.NaN])('refuses speed %p', (speed) => {
    expect(() => assertValidSpeed(speed)).toThrow('Speed must be a finite number above 0');
  });
});
