// packages/runtime/src/stage/html/keyframes.ts
/**
 * Construction des images clés Web Animations d'un calque.
 *
 * Temps : la durée est totalFrames / fps et l'image N commence à
 * (N - 1) / totalFrames de la durée ; la dernière image est tenue jusqu'à la
 * fin. Entre deux images, les valeurs sont interpolées (mouvement fluide).
 *
 * - Au début de chaque plage (sauf la 1re), deux images clés au même offset
 *   donnent un changement net : l'état tenu de la plage précédente, puis
 *   celui de la nouvelle plage.
 * - Une interpolation linéaire donne une image clé au début, à la fin et à
 *   chaque image clé de propriété : c'est exact.
 * - Une interpolation accélérée sans image clé de propriété au milieu donne
 *   deux images clés, l'accélération étant portée par la première : exact.
 * - Sinon (accélération + images clés au milieu), la courbe est échantillonnée
 *   à chaque image : exact à chaque image entière.
 * - Le navigateur ne connaît ni les `interpolate` personnalisés ni les bornes
 *   appliquées pendant l'interpolation : un calque qui en dépend est
 *   échantillonné à chaque image dans toutes ses interpolations.
 * - Seules les pistes CSS (`transform`, `style`) décident de l'échantillonnage
 *   et des images clés : les propriétés `value` ne sont pas écrites en CSS, un
 *   calque qui n'a qu'elles ne donne aucune image clé (sauf pour la visibilité).
 */

import { resolveEasing, resolveTracks } from '../../model/defaults';
import type { ITimelineSettings } from '../../model/document';
import { parseEasing } from '../../model/easing';
import type { ILayer } from '../../model/layer';
import type { ISpan } from '../../model/span';
import { collectLayerProperties, evaluateLayer } from '../../evaluate/evaluateLayer';
import type { ILayerFrameState } from '../../evaluate/evaluateLayer';
import { computeCssDeclarations, cssNameToCamelCase } from '../../properties/compose';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import { isCssProperty } from '../../properties/types';
import type { PropertyDescriptor } from '../../properties/types';
import { lerp } from '../../properties/values';
import { StageDocumentError } from '../reports';

/** Prevent legacy HTML adapters from silently changing independent track semantics. */
export function assertHtmlLayerSupported(layer: ILayer): void {
  if (Object.keys(layer.propertyTimelines ?? {}).length > 0) {
    throw new StageDocumentError(
      `Calque « ${layer.id} » : les pistes de propriétés exigent le rendu HTML exact de createHtmlStage ; leur conversion en images Web Animations historiques est refusée.`
    );
  }
}

/** Offset of the start of `frame` in the animation, in [0, 1). */
export function frameToOffset(frame: number, totalFrames: number): number {
  return (frame - 1) / totalFrames;
}

/** A point of the animation before conversion to a Web Animations keyframe. */
interface ITimelinePoint {
  readonly offset: number;
  readonly state: ILayerFrameState;
  /** Easing of the segment starting at this point. */
  readonly easing: string;
}

function isLinear(easing: string): boolean {
  const curve = parseEasing(easing);
  return curve !== null && curve.x1 === curve.y1 && curve.x2 === curve.y2;
}

/** Names of the CSS properties (`transform`, `style`) used by the tracks of `layer`. */
function collectCssProperties(layer: ILayer, registry: PropertyRegistry): Set<string> {
  return new Set(collectLayerProperties(layer).filter((name) => isCssProperty(registry.require(name))));
}

/** Frames strictly inside the span where a CSS track has a keyframe (or starts late). */
function innerKeyframeFrames(span: ISpan, cssNames: ReadonlySet<string>): number[] {
  const frames = new Set<number>();
  for (const [name, track] of Object.entries(resolveTracks(span))) {
    if (!cssNames.has(name)) {
      continue;
    }
    track.forEach(({ frame }) => {
      if (frame > span.start && frame < span.end) {
        frames.add(frame);
      }
    });
  }
  return Array.from(frames).sort((a, b) => a - b);
}

function isOutOfBounds(descriptor: PropertyDescriptor, value: number): boolean {
  return (descriptor.min !== undefined && value < descriptor.min) || (descriptor.max !== undefined && value > descriptor.max);
}

/**
 * True when the browser's own interpolation would differ from `evaluateLayer`
 * on a CSS property: a custom interpolator, or a keyframe value outside the
 * property bounds. `value` properties never force sampling.
 */
function needsFrameSampling(layer: ILayer, cssNames: ReadonlySet<string>, registry: PropertyRegistry): boolean {
  const descriptors = Array.from(cssNames, (name) => registry.require(name));
  if (descriptors.some((d) => d.interpolate !== undefined && d.interpolate !== lerp)) {
    return true;
  }
  return layer.spans.some((span) =>
    Object.entries(resolveTracks(span)).some(([name, track]) =>
      cssNames.has(name) && track.some(({ value }) => isOutOfBounds(registry.require(name), value))
    )
  );
}

/** Frames of a span where a keyframe is needed, with the easing of the segment that starts there. */
function spanFrames(
  span: ISpan,
  end: number,
  sampleAll: boolean,
  cssNames: ReadonlySet<string>
): Array<{ frame: number; easing: string }> {
  if (span.kind !== 'tween' || end <= span.start) {
    return [{ frame: span.start, easing: 'linear' }];
  }
  const easing = resolveEasing(span);
  const inner = innerKeyframeFrames(span, cssNames).filter((frame) => frame < end);
  if (sampleAll) {
    return Array.from({ length: end - span.start + 1 }, (_, i) => ({ frame: span.start + i, easing: 'linear' }));
  }
  if (isLinear(easing)) {
    return [span.start, ...inner, end].map((frame) => ({ frame, easing: 'linear' }));
  }
  if (inner.length === 0) {
    return [{ frame: span.start, easing }, { frame: end, easing: 'linear' }];
  }
  return Array.from({ length: end - span.start + 1 }, (_, i) => ({ frame: span.start + i, easing: 'linear' }));
}

function collectPoints(
  layer: ILayer,
  totalFrames: number,
  registry: PropertyRegistry,
  cssNames: ReadonlySet<string>
): ITimelinePoint[] {
  const evaluate = (frame: number): ILayerFrameState => evaluateLayer(layer, frame, { registry });
  const points: ITimelinePoint[] = [];
  const add = (frame: number, stateFrame: number, easing = 'linear'): void => {
    points.push({ offset: frameToOffset(frame, totalFrames), state: evaluate(stateFrame), easing });
  };
  const sampleAll = needsFrameSampling(layer, cssNames, registry);
  let covered = 0;
  for (const span of layer.spans) {
    if (span.start > totalFrames) {
      break;
    }
    if (span.start > 1) {
      add(span.start, span.start - 1);
    }
    const end = Math.min(span.end, totalFrames);
    spanFrames(span, end, sampleAll, cssNames).forEach(({ frame, easing }) => add(frame, frame, easing));
    covered = end;
  }
  if (covered < totalFrames) {
    if (covered > 0) {
      add(covered + 1, covered);
    }
    add(covered + 1, covered + 1);
  }
  points.push({ offset: 1, state: evaluate(totalFrames), easing: 'linear' });
  return points;
}

/** True when the target is hidden at some frame (blank span, or frames without span). */
export function needsVisibility(layer: ILayer, totalFrames: number): boolean {
  let covered = 0;
  for (const span of layer.spans) {
    if (span.start > totalFrames) {
      break;
    }
    if (span.kind === 'blank') {
      return true;
    }
    covered = Math.min(span.end, totalFrames);
  }
  return covered < totalFrames;
}

function toKeyframe(point: ITimelinePoint, registry: PropertyRegistry, withVisibility: boolean): Keyframe {
  const keyframe: Keyframe = { offset: point.offset, easing: point.easing };
  for (const [cssName, value] of Object.entries(computeCssDeclarations(point.state.values, registry))) {
    keyframe[cssNameToCamelCase(cssName)] = value;
  }
  if (withVisibility) {
    keyframe.visibility = point.state.visible ? 'visible' : 'hidden';
  }
  return keyframe;
}

/**
 * Web Animations keyframes of a layer over the whole timeline, or `null` when
 * the layer never changes anything in CSS (no CSS track, always visible).
 * Only animated CSS properties are written, so other styles of the target stay.
 */
export function buildLayerKeyframes(
  layer: ILayer,
  settings: ITimelineSettings,
  registry: PropertyRegistry
): Keyframe[] | null {
  assertHtmlLayerSupported(layer);
  const withVisibility = needsVisibility(layer, settings.totalFrames);
  const cssNames = collectCssProperties(layer, registry);
  if (!withVisibility && cssNames.size === 0) {
    return null;
  }
  return collectPoints(layer, settings.totalFrames, registry, cssNames).map((point) => toKeyframe(point, registry, withVisibility));
}
