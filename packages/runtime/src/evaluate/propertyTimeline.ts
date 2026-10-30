// packages/runtime/src/evaluate/propertyTimeline.ts
import type { PropertyEasing } from '../model/propertyEasing';
import type {
  IPropertyCurveSource, IPropertyTimeline, IPropertyTimelineKeyframe,
  IPropertyTransition, TimelinePropertyValue
} from '../model/propertyTimeline';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { PropertyDescriptor } from '../properties/types';
import { boundTimelineValue, interpolateTimelineValue } from '../properties/timelineValues';
import type { TimelinePropertyValues } from '../properties/timelineValues';
import { createPropertyEasingFunction } from './propertyEasing';

function curveProgress(start: number, end: number, frame: number, easing?: PropertyEasing): number {
  const progress = Math.max(0, Math.min(1, (frame - start) / (end - start)));
  return createPropertyEasingFunction(easing)(progress);
}

/** A retained source is evaluated in its original domain, even after a split. */
function sourceValue(source: IPropertyCurveSource, frame: number, descriptor?: PropertyDescriptor): TimelinePropertyValue {
  const keys = source.keys;
  if (keys.length < 2 || source.end <= source.start) throw new Error('A curve source requires two keys and a positive duration.');
  const at = curveProgress(source.start, source.end, frame, source.easing);
  const normalize = (key: IPropertyTimelineKeyframe): number => (key.frame - source.start) / (source.end - source.start);
  let index = 0;
  while (index < keys.length - 2 && at > normalize(keys[index + 1])) index++;
  const from = keys[index];
  const to = keys[index + 1];
  return interpolateTimelineValue(from.value, to.value, (at - normalize(from)) / (normalize(to) - normalize(from)), descriptor);
}

function transitionValue(
  transition: IPropertyTransition,
  from: IPropertyTimelineKeyframe,
  to: IPropertyTimelineKeyframe,
  frame: number,
  descriptor?: PropertyDescriptor
): TimelinePropertyValue {
  if (transition.source !== undefined) return sourceValue(transition.source, frame, descriptor);
  const progress = (frame - from.frame) / (to.frame - from.frame);
  return interpolateTimelineValue(from.value, to.value, createPropertyEasingFunction(transition.easing)(progress), descriptor);
}

/** Evaluates one independent property without adding implicit editable keys. */
export function evaluatePropertyTimeline(
  timeline: IPropertyTimeline,
  frame: number,
  descriptor?: PropertyDescriptor
): TimelinePropertyValue {
  if (!Number.isFinite(frame)) throw new Error('Frame must be a finite number.');
  const first = timeline.keys[0];
  if (first === undefined || frame < first.frame) {
    const value = first !== undefined && timeline.beforeFirst === 'first-key' ? first.value : timeline.initialValue;
    return boundTimelineValue(value, descriptor);
  }
  let index = 0;
  while (index < timeline.keys.length - 1 && timeline.keys[index + 1].frame <= frame) index++;
  const from = timeline.keys[index];
  const to = timeline.keys[index + 1];
  if (from.frame === frame || to === undefined) return boundTimelineValue(from.value, descriptor);
  const transition = timeline.transitions?.find((candidate) => candidate.fromFrame === from.frame && candidate.toFrame === to.frame);
  return transition === undefined
    ? boundTimelineValue(from.value, descriptor)
    : transitionValue(transition, from, to, frame, descriptor);
}

/** Modern values carry their own kinds and initial states; a numeric registry remains optional. */
export function evaluatePropertyTimelines(
  timelines: Readonly<Record<string, IPropertyTimeline>>,
  frame: number,
  registry: PropertyRegistry
): TimelinePropertyValues {
  return Object.fromEntries(Object.entries(timelines).map(([name, timeline]) =>
    [name, evaluatePropertyTimeline(timeline, frame, registry.get(name))]));
}
