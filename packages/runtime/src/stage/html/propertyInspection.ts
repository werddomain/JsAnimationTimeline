// packages/runtime/src/stage/html/propertyInspection.ts
import type { IPropertyTimeline, TimelinePropertyValue } from '../../model/propertyTimeline';
import type { LayerTarget } from '../../model/target';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import type { ITargetPropertyInfo } from '../types';
import type { IHtmlAnimationContext, IHtmlResolvedLayer } from './animationTypes';
import { readHtmlPropertyBase, captureHtmlTransformBase } from './cssBaseline';
import { htmlGradientValueKind, resolveHtmlBinding } from './cssBindings';
import { composeHtmlDeclarations } from './cssCompose';
import type { HtmlReadResult, HtmlTransformValues, IHtmlResolvedBinding } from './cssTypes';
import { validateHtmlGradientTimeline } from './gradientTimelineValidation';

export interface IHtmlPropertyInspection extends ITargetPropertyInfo {
  readonly editable: boolean;
  readonly interpolable: boolean;
  readonly memberCount: number;
  readonly initialValue?: TimelinePropertyValue;
}

function equal(a: TimelinePropertyValue, b: TimelinePropertyValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const INTEGER_CSS_PROPERTIES = new Set(['z-index', 'order', 'column-count', 'orphans', 'widows',
  'grid-row', 'grid-row-start', 'grid-row-end', 'grid-column', 'grid-column-start', 'grid-column-end',
  'line-clamp', '-webkit-line-clamp']);

/** Bases are read only outside preview writes and retained until an explicit refresh. */
export class HtmlPropertyInspection {
  private bases = new WeakMap<Element, Map<string, HtmlReadResult<TimelinePropertyValue>>>();
  private transforms = new WeakMap<Element, HtmlReadResult<HtmlTransformValues>>();
  private backgrounds = new WeakMap<Element, string>();

  reset(): void {
    this.bases = new WeakMap(); this.transforms = new WeakMap(); this.backgrounds = new WeakMap();
  }

  transform(element: Element): HtmlReadResult<HtmlTransformValues> {
    let result = this.transforms.get(element);
    if (result === undefined) { result = captureHtmlTransformBase(element); this.transforms.set(element, result); }
    return result;
  }

  inspect(elements: readonly Element[], property: string, layerId: string | undefined,
    kind: TimelinePropertyValue['kind'], context: IHtmlAnimationContext, registry: PropertyRegistry): IHtmlPropertyInspection {
    const resolved = resolveHtmlBinding(property, kind, registry, layerId === undefined ? undefined : context.bindings?.[layerId]?.[property]);
    const blocked = (reason: string): IHtmlPropertyInspection => ({ name: property, memberCount: elements.length,
      editable: false, interpolable: false, reason });
    if (elements.length === 0) return blocked('La cible ne correspond à aucun élément.');
    if (resolved.status !== 'value') return blocked(resolved.reason);
    const gradients = layerId === undefined ? [] : context.gradients?.[layerId] ?? [];
    const key = JSON.stringify([resolved.value, gradients]);
    const values: TimelinePropertyValue[] = [];
    for (const element of elements) {
      let entries = this.bases.get(element);
      if (entries === undefined) { entries = new Map(); this.bases.set(element, entries); }
      let base = entries.get(key);
      if (base === undefined) {
        base = readHtmlPropertyBase(element, resolved.value, gradients);
        entries.set(key, base);
      }
      if (base.status !== 'value') return blocked(base.reason);
      values.push(base.value);
      if (!this.backgrounds.has(element)) this.backgrounds.set(element,
        element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue('background-image') ?? '');
      if (resolved.value.binding.kind === 'transform') {
        const transform = this.transform(element);
        if (transform.status !== 'value') return blocked(transform.reason);
      }
    }
    const differentBackground = resolved.value.binding.kind === 'gradient' &&
      elements.some((element) => this.backgrounds.get(element) !== this.backgrounds.get(elements[0]));
    if (differentBackground || values.some((value) => !equal(value, values[0]))) {
      return blocked('Les éléments possèdent des valeurs initiales différentes pour cette propriété. Attribuez un ID à chaque élément pour l’animer séparément.');
    }
    const integer = resolved.value.binding.kind === 'style' && INTEGER_CSS_PROPERTIES.has(resolved.value.binding.cssName);
    return { name: property, memberCount: elements.length, editable: true,
      interpolable: !integer && (kind === 'number' || kind === 'color'), initialValue: { ...values[0] },
      ...(integer ? { reason: 'Cette propriété CSS exige un entier. Utilisez des clés de maintien ; l’interpolation continue est indisponible.' } : {}) };
  }

  validate(layer: IHtmlResolvedLayer, property: string, track: IPropertyTimeline | undefined,
    context: IHtmlAnimationContext, registry: PropertyRegistry): string | undefined {
    const explicit = context.bindings?.[layer.layerId]?.[property];
    const kind = track?.initialValue.kind ?? (explicit?.kind === 'gradient' ? htmlGradientValueKind(explicit.component) : undefined);
    if (kind === undefined) return undefined;
    const binding = resolveHtmlBinding(property, kind, registry, explicit);
    if (binding.status !== 'value') return binding.reason;
    if (binding.value.binding.kind === 'gradient') {
      return validateHtmlGradientTimeline(layer, property, track, binding.value, context, registry);
    }
    if (track === undefined) return undefined;
    const values = [track.initialValue, ...track.keys.map((key) => key.value),
      ...(track.transitions ?? []).flatMap((transition) => transition.source?.keys.map((key) => key.value) ?? [])];
    for (const element of layer.elements) {
      const base = this.transform(element);
      for (const value of values) {
        const result = composeHtmlDeclarations(element, { [property]: value }, { [property]: binding.value },
          context.gradients?.[layer.layerId] ?? [], base.status === 'value' ? base.value : undefined);
        if (result.diagnostics.length > 0) return result.diagnostics[0].reason;
      }
    }
    return undefined;
  }
}

/** Metadata of an unrecorded property can be requested explicitly by an inspector. */
export interface IHtmlInspectPropertyOptions {
  readonly layerId?: string;
  readonly valueKind?: TimelinePropertyValue['kind'];
}

export interface IHtmlInspectionRequest {
  readonly target: LayerTarget;
  readonly property: string;
  readonly options?: IHtmlInspectPropertyOptions;
}

export type HtmlResolvedBindings = Readonly<Record<string, IHtmlResolvedBinding>>;
