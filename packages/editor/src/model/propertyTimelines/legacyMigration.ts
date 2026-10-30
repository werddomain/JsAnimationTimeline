// packages/editor/src/model/propertyTimelines/legacyMigration.ts
import {
  clampValue, createEasingFunction, isPropertyEasing, parseEasing, resolveEasing, valueAtFrame
} from '@kazo-ca/timeline-runtime';
import type {
  ILayer, IPropertyCurveSource, IPropertyKeyframe, IPropertyTimeline, IPropertyTimelineKeyframe,
  IPropertyTransition, ISpan, ITimelineDocument, PropertyDescriptor, PropertyEasing, PropertyRegistry
} from '@kazo-ca/timeline-runtime';
import { PropertyOperationError } from '../properties/propertyValue';
import { createTransitionIdFactory } from './transitions';

const has = (value: object | undefined, name: string): boolean => value !== undefined && Object.prototype.hasOwnProperty.call(value, name);
const number = (value: number) => ({ kind: 'number' as const, value });

function refuse(reason: string): never {
  throw new PropertyOperationError(`Migration impossible sans modifier le résultat : ${reason}`);
}

function assertHeldValue(value: number, descriptor: PropertyDescriptor): void {
  if (!Number.isFinite(value) || !Object.is(clampValue(descriptor, value), value)) {
    refuse('une valeur historique dépasse les bornes de la propriété.');
  }
}

function legacyTrack(span: ISpan, name: string): readonly IPropertyKeyframe[] {
  return has(span.tracks, name) ? span.tracks![name] : [];
}

function modernEasing(span: ISpan): PropertyEasing {
  const curve = parseEasing(resolveEasing(span));
  if (curve === null) refuse('la courbe historique est invalide.');
  const easing = { kind: 'bezier' as const, ...curve };
  if (!isPropertyEasing(easing)) refuse('la courbe historique dépasse les limites des effets éditables.');
  return easing;
}

function evaluatedValue(descriptor: PropertyDescriptor, points: readonly IPropertyKeyframe[], frame: number, span: ISpan): number {
  try {
    return valueAtFrame(descriptor, points, frame, span);
  } catch {
    return refuse('l’interpolateur personnalisé ne peut pas évaluer cette plage.');
  }
}

function validateTween(span: ISpan, points: readonly IPropertyKeyframe[], descriptor: PropertyDescriptor): void {
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.end <= span.start
      || points.length < 2 || points[0].frame !== span.start || points[points.length - 1].frame !== span.end) {
    refuse('la plage interpolée doit posséder deux extrémités explicites et une durée représentable.');
  }
  const curve = parseEasing(resolveEasing(span));
  if (curve === null) refuse('la courbe historique est invalide.');
  // Convex-hull bounds cover every eased position, including overshoot, without resampling.
  const low = span.start + Math.min(0, curve.y1, curve.y2) * (span.end - span.start);
  const high = span.start + Math.max(1, curve.y1, curve.y2) * (span.end - span.start);
  points.slice(0, -1).forEach((from, index) => {
    const to = points[index + 1];
    const progress = Math.max(Math.abs((low - from.frame) / (to.frame - from.frame)), Math.abs((high - from.frame) / (to.frame - from.frame)));
    if (!Number.isSafeInteger(to.frame) || to.frame <= from.frame
        || !Number.isFinite(Math.abs(from.value) + Math.abs(to.value - from.value) * progress)) {
      refuse('les valeurs de cette plage ne permettent pas une interpolation numérique stable.');
    }
  });
  for (const endpoint of [points[0], points[points.length - 1]]) {
    if (!Object.is(evaluatedValue(descriptor, points, endpoint.frame, span), endpoint.value)) {
      refuse('l’interpolation historique modifie les extrémités conservées après la plage.');
    }
  }
}

function tweenTimeline(doc: ITimelineDocument, layer: ILayer, span: ISpan, name: string, descriptor: PropertyDescriptor): IPropertyTimeline {
  const points = legacyTrack(span, name);
  const easing = modernEasing(span);
  validateTween(span, points, descriptor);
  const legacyEasing = resolveEasing(span);
  const source: IPropertyCurveSource = { start: span.start, end: span.end, legacyEasing,
    keys: points.map((key) => ({ frame: key.frame, value: number(key.value) })) };
  const ease = createEasingFunction(legacyEasing);
  const keys: IPropertyTimelineKeyframe[] = points.map((key) => {
    const at = span.start + ease((key.frame - span.start) / (span.end - span.start)) * (span.end - span.start);
    const value = evaluatedValue(descriptor, points, at, span);
    assertHeldValue(value, descriptor);
    return { frame: key.frame, value: number(value) };
  });
  const nextId = createTransitionIdFactory(doc, layer.id);
  const transitions: IPropertyTransition[] = keys.slice(0, -1).map((key, index) => ({
    id: nextId(), fromFrame: key.frame, toFrame: keys[index + 1].frame, easing, source
  }));
  return { initialValue: number(descriptor.defaultValue), keys, transitions };
}

function removeLegacyProperty(span: ISpan, name: string): ISpan {
  if (!has(span.tracks, name)) return span;
  return { ...span, tracks: Object.fromEntries(Object.entries(span.tracks!).filter(([key]) => key !== name)) };
}

/**
 * Explicit migration, never inferred from an edit. Static holds and a single
 * fully bounded tween retain their exact evaluator; other histories are refused.
 * Spans remain the authority for visibility and unrelated legacy properties.
 */
export function migrateLegacyProperty(doc: ITimelineDocument, layer: ILayer, name: string, registry: PropertyRegistry): ILayer {
  if (has(layer.propertyTimelines, name)) return layer;
  const descriptor = registry.get(name);
  if (descriptor === undefined) throw new PropertyOperationError(`La propriété « ${name} » est inconnue.`);
  const spans = layer.spans.filter((span) => has(span.tracks, name));
  if (spans.length === 0) throw new PropertyOperationError(`La propriété « ${name} » n’a aucune piste historique à migrer.`);
  assertHeldValue(descriptor.defaultValue, descriptor);
  const content = spans.filter((span) => legacyTrack(span, name).length > 0);
  content.forEach((span) => legacyTrack(span, name).forEach((key) => assertHeldValue(key.value, descriptor)));
  const tweens = content.filter((span) => span.kind === 'tween');
  if (tweens.length > 0 && content.length !== 1) refuse('cette propriété combine plusieurs plages de contenu avec une interpolation.');
  const track: IPropertyTimeline = tweens.length === 1
    ? tweenTimeline(doc, layer, tweens[0], name, descriptor)
    : { initialValue: number(descriptor.defaultValue), keys: content.map((span) => ({ frame: span.start, value: number(legacyTrack(span, name)[0].value) })) };
  return { ...layer, spans: layer.spans.map((span) => removeLegacyProperty(span, name)),
    propertyTimelines: { ...layer.propertyTimelines, [name]: track } };
}
