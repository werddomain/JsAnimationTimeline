// packages/runtime/src/evaluate/evaluateLayer.ts
/**
 * Évaluation d'un calque à l'image N (modèle motion tween CS4) :
 * - la plage qui contient N donne la visibilité (`blank` masque la cible) ;
 * - une propriété sans image clé dans la plage reprend la dernière valeur
 *   connue des plages précédentes, sinon la valeur par défaut du registre ;
 * - dans une interpolation, l'accélération s'applique à la plage entière :
 *   l'image N devient une image « accélérée », où les pistes sont lues.
 */

import { resolveEasing, resolveTracks } from '../model/defaults';
import type { ILayer } from '../model/layer';
import type { ISpan } from '../model/span';
import { defaultPropertyRegistry } from '../properties/PropertyRegistry';
import type { PropertyRegistry } from '../properties/PropertyRegistry';
import type { PropertyValues } from '../properties/types';
import { numericTimelineValues, typedNumericValues } from '../properties/timelineValues';
import type { TimelinePropertyValues } from '../properties/timelineValues';
import { evaluatePropertyTimelines } from './propertyTimeline';
import { createEasingFunction } from './easingFunction';
import { valueAtFrame, withImplicitStart } from './track';
import { applyUnknownPropertyPolicy, assertUnknownPropertyPolicy } from './unknownProperties';
import type { EvaluateIssueListener, UnknownPropertyPolicy } from './unknownProperties';

/** State of one layer at one frame. */
export interface ILayerFrameState {
  readonly layerId: string;
  /**
   * Content visibility: `false` in a `blank` span, before the first span and
   * after the last one. The editor flags (`layer.visible`, folder visibility,
   * `locked`) are not applied here; the player decides what to do with them.
   */
  readonly visible: boolean;
  /** Span containing the frame, `undefined` outside every span. */
  readonly spanId: string | undefined;
  /** Value of every property animated anywhere in the layer. */
  readonly values: PropertyValues;
  /** Typed values for a layer with independent property timelines; absent for legacy-only layers. */
  readonly propertyValues?: TimelinePropertyValues;
}

/** Options shared by the evaluation functions. */
export interface IEvaluateOptions {
  /** Defaults to `defaultPropertyRegistry`. */
  readonly registry?: PropertyRegistry;
  /**
   * What to do with a track unknown to the registry: `throw` (default) or
   * `skip` (only that track is dropped and reported to `onIssue`).
   */
  readonly unknownProperties?: UnknownPropertyPolicy;
  /** Receives the issues of a `skip` evaluation (`unknown-property`), on every call. */
  readonly onIssue?: EvaluateIssueListener;
}

/**
 * Names of the properties used by the tracks of a layer, in order of first
 * appearance. These are the properties a player writes on the target.
 */
export function collectLayerProperties(layer: ILayer): string[] {
  return Array.from(new Set([...collectLegacyProperties(layer), ...Object.keys(layer.propertyTimelines ?? {})]));
}

function collectLegacyProperties(layer: ILayer): string[] {
  const names = new Set<string>();
  for (const span of layer.spans) {
    Object.keys(resolveTracks(span)).forEach((name) => names.add(name));
  }
  return Array.from(names);
}

/**
 * Span of `layer` holding `frame`: the last span whose `start <= frame`,
 * when `frame < end + 1` (a fractional frame belongs to the span of its
 * integer part). `undefined` before the first span or after the last one.
 */
export function findSpanAt(layer: ILayer, frame: number): ISpan | undefined {
  for (const span of layer.spans) {
    if (frame < span.start) {
      return undefined;
    }
    if (containsFrame(span, frame)) {
      return span;
    }
  }
  return undefined;
}

/** True when `frame` (possibly fractional, already `>= start`) is before the next span. */
function containsFrame(span: ISpan, frame: number): boolean {
  return frame < span.end + 1;
}

type MutableValues = Record<string, number>;

/** Values in force at the end of `span`, given the values at its start. */
function valuesAfterSpan(span: ISpan, carried: PropertyValues): PropertyValues {
  if (span.kind === 'blank') {
    return carried;
  }
  const next: MutableValues = { ...carried };
  for (const [name, track] of Object.entries(resolveTracks(span))) {
    if (track.length > 0) {
      next[name] = span.kind === 'static' ? track[0].value : track[track.length - 1].value;
    }
  }
  return next;
}

/** Frame where the tracks of a tween are read: the eased position in [start, end]. */
function easedFrame(span: ISpan, frame: number): number {
  const length = span.end - span.start;
  if (length <= 0) {
    return span.start;
  }
  const progress = Math.min(1, Math.max(0, (frame - span.start) / length));
  return span.start + createEasingFunction(resolveEasing(span))(progress) * length;
}

function valuesInSpan(span: ISpan, frame: number, carried: PropertyValues, registry: PropertyRegistry): PropertyValues {
  if (span.kind !== 'tween') {
    return valuesAfterSpan(span, carried);
  }
  const at = easedFrame(span, frame);
  const values: MutableValues = { ...carried };
  for (const [name, track] of Object.entries(resolveTracks(span))) {
    const points = withImplicitStart(track, span, carried[name]);
    values[name] = valueAtFrame(registry.require(name), points, at, span);
  }
  return values;
}

function defaultValues(names: readonly string[], registry: PropertyRegistry): PropertyValues {
  const values: MutableValues = {};
  names.forEach((name) => {
    values[name] = registry.require(name).defaultValue;
  });
  return values;
}

/**
 * State of `layer` at `frame` (1-based, fractional frames allowed). Throws for
 * a non-finite frame, an invalid easing or a property unknown to the registry
 * (unless `unknownProperties` is `skip`).
 */
function evaluateLegacyLayer(source: ILayer, frame: number, options: IEvaluateOptions): ILayerFrameState {
  if (!Number.isFinite(frame)) {
    throw new Error(`Frame must be a finite number (got ${frame}).`);
  }
  assertUnknownPropertyPolicy(options.unknownProperties);
  const registry = options.registry ?? defaultPropertyRegistry;
  const layer = applyUnknownPropertyPolicy(source, registry, options.unknownProperties ?? 'throw', options.onIssue);
  let carried = defaultValues(collectLegacyProperties(layer), registry);
  for (const span of layer.spans) {
    if (frame < span.start) {
      break;
    }
    if (containsFrame(span, frame)) {
      const values = valuesInSpan(span, frame, carried, registry);
      return { layerId: layer.id, visible: span.kind !== 'blank', spanId: span.id, values };
    }
    carried = valuesAfterSpan(span, carried);
  }
  return { layerId: layer.id, visible: false, spanId: undefined, values: carried };
}

/** Reads historical spans and independent property timelines without mutating either representation. */
export function evaluateLayer(source: ILayer, frame: number, options: IEvaluateOptions = {}): ILayerFrameState {
  const state = evaluateLegacyLayer(source, frame, options);
  if (source.propertyTimelines === undefined) return state;
  const legacyNames = new Set(collectLegacyProperties(source));
  for (const name of Object.keys(source.propertyTimelines)) {
    if (legacyNames.has(name)) throw new Error(`Property "${name}" has both legacy and independent timelines.`);
  }
  const modern = evaluatePropertyTimelines(source.propertyTimelines, frame, options.registry ?? defaultPropertyRegistry);
  return {
    ...state,
    visible: source.spans.length === 0 ? frame >= 1 : state.visible,
    values: { ...state.values, ...numericTimelineValues(modern) },
    propertyValues: { ...typedNumericValues(state.values), ...modern }
  };
}
