// packages/export-css/src/continuous/timeline.ts
import type { IPropertyCurveSource, IPropertyTimeline, IPropertyTransition, PropertyDescriptor, PropertyEasing,
  TimelinePropertyValue } from '@kazo-ca/timeline-runtime';

export interface IContinuousInterval { readonly from: number; readonly to: number; readonly timing: string }
export interface IContinuousTimeline { readonly frames: readonly number[]; readonly intervals: readonly IContinuousInterval[] }

export class ContinuousCssError extends Error {
  constructor(readonly code: string, message: string, readonly fromFrame?: number, readonly toFrame?: number,
    readonly layerId?: string, readonly property?: string) { super(message); }
}

function linear(easing?: PropertyEasing): boolean {
  return easing === undefined || easing.kind === 'effect' && easing.family === 'linear'
    || easing.kind === 'bezier' && easing.x1 === easing.y1 && easing.x2 === easing.y2;
}

function cssTiming(easing?: PropertyEasing): string {
  if (linear(easing)) return 'linear';
  if (easing?.kind !== 'bezier') throw new ContinuousCssError('unsupported-easing', 'Cette courbe ne possède pas de représentation CSS continue exacte. Utilisez JavaScript ou JSON.');
  return `cubic-bezier(${easing.x1}, ${easing.y1}, ${easing.x2}, ${easing.y2})`;
}

function numeric(value: TimelinePropertyValue): number {
  if (value.kind !== 'number') throw new ContinuousCssError('unsupported-interpolation', 'Seules les transitions numériques possèdent une interpolation CSS vérifiée dans cet export.');
  return value.value;
}

function assertBounded(value: number, descriptor?: PropertyDescriptor): void {
  if (!Number.isFinite(value) || descriptor?.min !== undefined && value < descriptor.min || descriptor?.max !== undefined && value > descriptor.max) {
    throw new ContinuousCssError('unsupported-clamping', 'Le bornage de cette propriété modifierait la courbe CSS. Utilisez JavaScript ou JSON.');
  }
}

function sourceNumber(source: IPropertyCurveSource, frame: number): number {
  const progress = (frame - source.start) / (source.end - source.start);
  const position = (index: number): number => (source.keys[index].frame - source.start) / (source.end - source.start);
  let index = 0;
  while (index < source.keys.length - 2 && progress > position(index + 1)) index++;
  const from = numeric(source.keys[index].value);
  const to = numeric(source.keys[index + 1].value);
  return from + (to - from) * (progress - position(index)) / (position(index + 1) - position(index));
}

function sameNumber(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON * 32 * Math.max(1, Math.abs(left), Math.abs(right));
}

function analyzeSource(timeline: IPropertyTimeline, transition: IPropertyTransition, descriptor?: PropertyDescriptor): IContinuousInterval[] {
  const source = transition.source!;
  if (!linear(source.easing) || source.legacyEasing !== undefined && source.legacyEasing !== 'linear') {
    throw new ContinuousCssError('unsupported-source-curve', 'Cette source de courbe découpée ne possède pas de représentation CSS continue exacte.', transition.fromFrame, transition.toFrame);
  }
  source.keys.forEach((key) => assertBounded(numeric(key.value), descriptor));
  for (const frame of [transition.fromFrame, transition.toFrame]) {
    const key = timeline.keys.find((candidate) => candidate.frame === frame)!;
    if (!sameNumber(numeric(key.value), sourceNumber(source, frame))) {
      throw new ContinuousCssError('discontinuous-source', 'La valeur de la clé diffère de sa source de courbe à la frontière ; cet export CSS est refusé.', transition.fromFrame, transition.toFrame);
    }
  }
  const frames = [transition.fromFrame, ...source.keys.map((key) => key.frame)
    .filter((frame) => frame > transition.fromFrame && frame < transition.toFrame), transition.toFrame];
  return frames.slice(0, -1).map((from, index) => ({ from, to: frames[index + 1], timing: 'linear' }));
}

function analyzeTransition(timeline: IPropertyTimeline, transition: IPropertyTransition, descriptor?: PropertyDescriptor): IContinuousInterval[] {
  if (descriptor?.interpolate !== undefined) throw new ContinuousCssError('custom-interpolator', 'Un interpolateur personnalisé ne peut pas être traduit automatiquement en CSS.', transition.fromFrame, transition.toFrame);
  if (transition.source !== undefined) return analyzeSource(timeline, transition, descriptor);
  const from = numeric(timeline.keys.find((key) => key.frame === transition.fromFrame)!.value);
  const to = numeric(timeline.keys.find((key) => key.frame === transition.toFrame)!.value);
  assertBounded(from, descriptor); assertBounded(to, descriptor);
  const timing = cssTiming(transition.easing);
  if (transition.easing?.kind === 'bezier') {
    assertBounded(from + (to - from) * transition.easing.y1, descriptor);
    assertBounded(from + (to - from) * transition.easing.y2, descriptor);
  }
  return [{ from: transition.fromFrame, to: transition.toFrame, timing }];
}

/** Analyze structure, never infer a continuous curve by fitting integer snapshots. */
export function analyzeTimeline(timeline: IPropertyTimeline, totalFrames: number, descriptor?: PropertyDescriptor): IContinuousTimeline {
  const intervals = (timeline.transitions ?? []).flatMap((transition) => analyzeTransition(timeline, transition, descriptor));
  const frames = [...new Set([1, totalFrames + 1, ...timeline.keys.map((key) => key.frame),
    ...intervals.flatMap((interval) => [interval.from, interval.to])])].sort((a, b) => a - b);
  return { frames, intervals };
}

/** CSS may split linear segments freely; a Bezier sub-domain needs another exact curve. */
export function timelineTiming(plan: IContinuousTimeline, from: number, to: number): string {
  const interval = plan.intervals.find((candidate) => from >= candidate.from && to <= candidate.to);
  if (interval === undefined) return 'steps(1, end)';
  if (interval.timing !== 'linear' && (from !== interval.from || to !== interval.to)) {
    throw new ContinuousCssError('incompatible-transform-timing', 'Une courbe de transformation devrait être découpée pour suivre les autres composantes. Utilisez JavaScript ou JSON.', from, to);
  }
  return interval.timing;
}
