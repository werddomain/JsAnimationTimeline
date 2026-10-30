// packages/runtime/src/properties/timelineValues.ts
import type { TimelinePropertyValue } from '../model/propertyTimeline';
import type { PropertyDescriptor, PropertyValues } from './types';
import { clampValue, interpolateValue, lerp } from './values';

/** Evaluated typed values, including non-numeric properties. */
export type TimelinePropertyValues = Readonly<Record<string, TimelinePropertyValue>>;

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('A property interpolation produced a non-finite value.');
  return value;
}

/** Keep ordinary rounding stable; use weighted endpoints if the difference overflows. */
function stableLerp(from: number, to: number, progress: number): number {
  const value = lerp(from, to, progress);
  return Number.isFinite(value) ? value : from * (1 - progress) + to * progress;
}

/** Applies numeric descriptor bounds without sharing a mutable value with the document. */
export function boundTimelineValue(value: TimelinePropertyValue, descriptor?: PropertyDescriptor): TimelinePropertyValue {
  if (value.kind !== 'number') return { ...value };
  const number = descriptor === undefined ? value.value : clampValue(descriptor, value.value);
  return { kind: 'number', value: finite(number) };
}

/** Interpolates supported value kinds; discrete values require a held key instead. */
export function interpolateTimelineValue(
  from: TimelinePropertyValue,
  to: TimelinePropertyValue,
  progress: number,
  descriptor?: PropertyDescriptor
): TimelinePropertyValue {
  if (progress === 0) return boundTimelineValue(from, descriptor);
  if (progress === 1) return boundTimelineValue(to, descriptor);
  if (from.kind === 'number' && to.kind === 'number') {
    const unbounded = descriptor?.interpolate === undefined
      ? stableLerp(from.value, to.value, progress)
      : interpolateValue(descriptor, from.value, to.value, progress);
    const value = descriptor === undefined ? unbounded : clampValue(descriptor, unbounded);
    return { kind: 'number', value: finite(value) };
  }
  if (from.kind === 'color' && to.kind === 'color') {
    const channel = (a: number, b: number): number => Math.max(0, Math.min(1, finite(lerp(a, b, progress))));
    return { kind: 'color', r: channel(from.r, to.r), g: channel(from.g, to.g),
      b: channel(from.b, to.b), a: channel(from.a, to.a) };
  }
  throw new Error(`A transition cannot interpolate ${from.kind} and ${to.kind} property values.`);
}

/** Projection retained for existing numeric stage consumers. */
export function numericTimelineValues(values: TimelinePropertyValues): PropertyValues {
  return Object.fromEntries(Object.entries(values).flatMap(([name, value]) =>
    value.kind === 'number' ? [[name, value.value]] : []));
}

/** Converts a legacy numeric result without changing the legacy document. */
export function typedNumericValues(values: PropertyValues): TimelinePropertyValues {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { kind: 'number', value }]));
}
