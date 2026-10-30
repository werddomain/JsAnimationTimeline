// packages/editor/src/plugins/tweens/easing/propertyEasingGraph.ts
import { createPropertyEasingFunction, evaluatePropertyTimeline } from '@kazo-ca/timeline-runtime';
import type { IPropertyTimeline, IPropertyTransition, PropertyDescriptor, PropertyEasing, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';

const SVG = 'http://www.w3.org/2000/svg';
const SAMPLE_COUNT = 201;
export interface IPropertyCurvePreview {
  readonly track: IPropertyTimeline;
  readonly transition: IPropertyTransition;
  readonly descriptor?: PropertyDescriptor;
}

function channels(value: TimelinePropertyValue): readonly number[] {
  if (value.kind === 'number') return [value.value];
  if (value.kind === 'color') return [value.r, value.g, value.b, value.a * 255];
  return [0];
}

/** Retained segments use actual runtime values, never division by equal endpoints. */
function samples(easing: PropertyEasing | undefined, retained?: IPropertyCurvePreview): readonly (readonly number[])[] {
  const curve = createPropertyEasingFunction(easing);
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const progress = index / (SAMPLE_COUNT - 1);
    if (retained === undefined) return [curve(progress)];
    const { track, transition, descriptor } = retained;
    return channels(evaluatePropertyTimeline(track, transition.fromFrame + progress * (transition.toFrame - transition.fromFrame), descriptor));
  });
}

/** The viewBox includes overshoot and the actual restricted source range. */
export function renderPropertyEasingGraph(svg: SVGSVGElement, easing?: PropertyEasing, retained?: IPropertyCurvePreview): void {
  const values = samples(easing, retained);
  const all = values.flat();
  let min = Math.min(...all, ...(retained === undefined ? [0] : []));
  let max = Math.max(...all, ...(retained === undefined ? [1] : []));
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('La courbe ne peut pas être calculée.');
  if (min === max) { min -= 0.5; max += 0.5; }
  const y = (value: number): number => 155 - ((value - min) / (max - min)) * 130;
  svg.replaceChildren(); svg.setAttribute('viewBox', '0 0 360 195');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', retained === undefined ? 'Aperçu de la courbe d’accélération' : 'Aperçu des valeurs de la courbe conservée');
  svg.dataset.min = String(min); svg.dataset.max = String(max);
  const axis = svg.ownerDocument.createElementNS(SVG, 'path');
  axis.setAttribute('d', 'M35 20V155H340'); axis.setAttribute('class', 'jt-property-easing__axis'); svg.append(axis);
  const label = (x: number, at: number, text: string): void => {
    const element = svg.ownerDocument.createElementNS(SVG, 'text'); element.setAttribute('x', String(x)); element.setAttribute('y', String(at));
    element.textContent = text; svg.append(element);
  };
  label(1, 20, max.toLocaleString('fr', { maximumFractionDigits: 2 }));
  label(1, 159, min.toLocaleString('fr', { maximumFractionDigits: 2 }));
  label(120, 185, retained === undefined ? 'Temps de l’interpolation' : `Images ${retained.transition.fromFrame} → ${retained.transition.toFrame}`);
  for (let channel = 0; channel < values[0].length; channel++) {
    const path = svg.ownerDocument.createElementNS(SVG, 'path');
    path.setAttribute('d', values.map((value, index) => `${index === 0 ? 'M' : 'L'}${35 + (index / (SAMPLE_COUNT - 1)) * 305} ${y(value[channel])}`).join(' '));
    path.setAttribute('class', `jt-property-easing__curve jt-property-easing__curve--${channel}`); svg.append(path);
  }
}
