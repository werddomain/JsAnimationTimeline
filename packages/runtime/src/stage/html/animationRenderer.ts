// packages/runtime/src/stage/html/animationRenderer.ts
import type { ITimelineDocument } from '../../model/document';
import type { IPropertyTimeline } from '../../model/propertyTimeline';
import type { LayerTarget } from '../../model/target';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import { sameTarget } from '../routing';
import type { IStageLayer, IStageLayerState, ITargetPropertyInfo } from '../types';
import type { IHtmlAnimationContext, IHtmlResolvedLayer, IHtmlResolutionDiagnostic, IHtmlResolutionPlan } from './animationTypes';
import { cloneHtmlAnimationContext } from './animationContext';
import { composeHtmlDeclarations } from './cssCompose';
import { htmlGradientValueKind } from './cssBindings';
import type { IHtmlGradientDefinition, IHtmlResolvedBinding } from './cssTypes';
import type { HtmlElements } from './elements';
import { InlineStyleKeeper } from './inlineStyles';
import { needsVisibility } from './keyframes';
import { HtmlPropertyInspection } from './propertyInspection';
import type { IHtmlInspectPropertyOptions, IHtmlPropertyInspection } from './propertyInspection';
import { prepareHtmlResolution } from './resolution';

function capabilityDiagnostic(layer: IHtmlResolvedLayer, property: string, message: string, totalFrames: number): IHtmlResolutionDiagnostic {
  return { code: 'unsupported-binding', id: JSON.stringify(['capability', layer.layerId, property]),
    signature: JSON.stringify(layer.layer.propertyTimelines?.[property]), property, layerIds: [layer.layerId],
    targets: ['selector' in layer.target ? layer.target.selector : layer.layerId], fromFrame: 1, toFrame: totalFrames,
    choices: [], blocking: true, message };
}

/** Exact HTML rendering shared by seeking and playback, independent of editor selection. */
export class HtmlAnimationRenderer {
  private readonly keeper = new InlineStyleKeeper();
  private readonly inspection = new HtmlPropertyInspection();
  private context: IHtmlAnimationContext;
  private doc: ITimelineDocument | undefined;
  private layers: readonly IHtmlResolvedLayer[] = [];
  private plan: IHtmlResolutionPlan | undefined;
  private held = new Set<Element>();
  private written = new Map<Element, ReadonlySet<string>>();
  private frame = 1;
  private visible = new Map<string, boolean>();
  private active = new Map<string, boolean>();
  private issues: readonly IHtmlResolutionDiagnostic[] = [];
  private renderIssues: readonly IHtmlResolutionDiagnostic[] = [];
  private metadata = new Map<string, ReadonlyMap<string, IHtmlPropertyInspection>>();
  private sourceDepth = 0;

  constructor(private readonly elements: HtmlElements, private readonly registry: () => PropertyRegistry,
    context: IHtmlAnimationContext = { version: 1 }) {
    this.context = cloneHtmlAnimationContext(context);
  }

  get animationContext(): IHtmlAnimationContext { return cloneHtmlAnimationContext(this.context); }
  get diagnostics(): readonly IHtmlResolutionDiagnostic[] { return [...this.issues, ...this.renderIssues].map((issue) => ({ ...issue,
    ...(issue.policies === undefined ? {} : { policies: [...issue.policies] }),
    layerIds: [...issue.layerIds], targets: [...issue.targets], choices: [...issue.choices] })); }

  setContext(context: IHtmlAnimationContext): void {
    const next = cloneHtmlAnimationContext(context);
    const previous = this.context;
    this.context = next;
    try { if (this.doc !== undefined) this.withOriginals(() => this.prepare(this.doc!, this.layers)); }
    catch (error) { this.context = previous; throw error; }
    this.draw();
  }

  update(doc: ITimelineDocument, layers: readonly IStageLayer<Element>[]): void {
    const resolved: IHtmlResolvedLayer[] = layers.map(({ layerId, layer, target }) => ({
      layerId, layer, target, elements: this.elements.resolveElements(target)
    }));
    this.withOriginals(() => this.prepare(doc, resolved));
    const next = new Set(resolved.flatMap((layer) => [...layer.elements]));
    for (const element of next) if (!this.held.has(element)) this.keeper.acquire(element);
    for (const element of this.held) if (!next.has(element)) { this.keeper.release(element); this.written.delete(element); }
    this.held = next;
  }

  refresh(): void {
    this.withOriginals(() => {
      this.inspection.reset();
      if (this.doc !== undefined) this.prepare(this.doc, this.layers);
    });
    this.draw();
  }

  withSourceStyles<T>(action: () => T): T {
    return this.withOriginals(() => {
      try { return action(); }
      finally {
        this.inspection.reset();
        if (this.doc !== undefined) this.prepare(this.doc, this.layers);
      }
    });
  }

  inspect(target: LayerTarget, property: string, options: IHtmlInspectPropertyOptions = {}): IHtmlPropertyInspection {
    return this.withOriginals(() => {
      const layer = options.layerId === undefined ? this.layers.find((entry) => sameTarget(entry.target, target))
        : this.layers.find((entry) => entry.layerId === options.layerId && sameTarget(entry.target, target));
      const layerId = options.layerId ?? layer?.layerId;
      const binding = layerId === undefined ? undefined : this.context.bindings?.[layerId]?.[property];
      const knownKind = options.valueKind ?? layer?.layer.propertyTimelines?.[property]?.initialValue.kind;
      const kind = knownKind ?? (binding?.kind === 'gradient' ? htmlGradientValueKind(binding.component)
        : /color$/i.test(binding?.kind === 'style' ? binding.cssName : property) ? 'color' : 'number');
      const elements = this.elements.resolveElements(target);
      const info = this.inspection.inspect(elements, property, layerId, kind, this.context, this.registry());
      if (!info.editable && knownKind === undefined && kind === 'number' && binding?.kind === 'style' && binding.unit === undefined) {
        return this.inspection.inspect(elements, property, layerId, 'text', this.context, this.registry());
      }
      return info;
    });
  }

  properties(target: LayerTarget): readonly ITargetPropertyInfo[] {
    const layers = this.layers.filter((entry) => sameTarget(entry.target, target));
    const names = new Set(this.registry().list().filter((descriptor) => descriptor.kind !== 'value').map((descriptor) => descriptor.name));
    for (const layer of layers) {
      Object.keys(layer.layer.propertyTimelines ?? {}).forEach((name) => names.add(name));
      Object.keys(this.context.bindings?.[layer.layerId] ?? {}).forEach((name) => names.add(name));
    }
    return [...names].map((name) => {
      const recorded = layers.find((entry) => entry.layer.propertyTimelines?.[name] !== undefined) ?? layers[0];
      const info = recorded === undefined ? this.inspect(target, name)
        : this.metadata.get(recorded.layerId)?.get(name) ?? this.inspect(target, name, { layerId: recorded.layerId });
      return { ...info,
        sample: (layerId, frame) => {
          const result = this.plan?.sample(layerId, name, frame, info.initialValue);
          if (result?.status === 'value') return result.value;
          if (result?.status === 'refused' && result.code === 'unrecorded' && info.initialValue !== undefined) return { ...info.initialValue };
          throw new Error(result?.reason ?? 'La propriété ne peut pas être évaluée pour cette cible.');
        },
        validate: (layerId, timeline) => {
          const layer = this.layers.find((entry) => entry.layerId === layerId);
          if (layer === undefined) return [{ severity: 'error' as const, message: 'La cible de la propriété est indisponible.' }];
          const reason = this.inspection.validate(layer, name, timeline, this.context, this.registry());
          return reason === undefined ? [] : [{ severity: 'error' as const, property: name, message: reason }];
        }
      };
    });
  }

  render(frame: number, states: readonly IStageLayerState<Element>[]): void {
    this.frame = frame;
    this.visible = new Map(states.map((state) => [state.layerId, state.editorVisible]));
    this.active = new Map(states.map((state) => [state.layerId, state.active]));
    this.draw();
  }

  release(layerId: string): void {
    const released = this.layers.find((layer) => layer.layerId === layerId);
    this.layers = this.layers.filter((layer) => layer.layerId !== layerId);
    for (const element of released?.elements ?? []) if (!this.layers.some((layer) => layer.elements.includes(element))) {
      this.keeper.release(element); this.held.delete(element); this.written.delete(element);
    }
  }

  detach(): void {
    this.keeper.restoreAll(); this.held.clear(); this.written.clear(); this.layers = []; this.doc = undefined;
    this.plan = undefined; this.metadata.clear(); this.issues = []; this.renderIssues = []; this.inspection.reset();
  }

  private withOriginals<T>(read: () => T): T {
    if (this.sourceDepth++ === 0) this.keeper.restoreOriginals();
    try { return read(); }
    finally {
      if (--this.sourceDepth === 0) { this.written.clear(); this.draw(); }
    }
  }

  private prepare(doc: ITimelineDocument, layers: readonly IHtmlResolvedLayer[]): void {
    const issues: IHtmlResolutionDiagnostic[] = [];
    const metadata = new Map<string, ReadonlyMap<string, IHtmlPropertyInspection>>();
    const accepted = layers.map((layer) => {
      const infos = new Map<string, IHtmlPropertyInspection>();
      const tracks: Record<string, IPropertyTimeline> = {};
      for (const [name, track] of Object.entries(layer.layer.propertyTimelines ?? {})) {
        let info = this.inspection.inspect(layer.elements, name, layer.layerId, track.initialValue.kind, this.context, this.registry());
        const reason = !info.editable || !info.interpolable && (track.transitions?.length ?? 0) > 0 ? info.reason
          : this.inspection.validate(layer, name, track, this.context, this.registry());
        if (reason !== undefined) {
          // Keep source capabilities: an invalid loaded track must still be repairable by a valid edit.
          info = { ...info, reason };
          issues.push(capabilityDiagnostic(layer, name, reason, doc.settings.totalFrames));
        } else tracks[name] = track;
        infos.set(name, info);
      }
      metadata.set(layer.layerId, infos);
      // Preserve legacy spans, whose numeric tracks are evaluated by the same resolution plan.
      return { ...layer, layer: { ...layer.layer, propertyTimelines: tracks } };
    });
    const plan = prepareHtmlResolution(doc, accepted, this.context, this.registry());
    this.doc = doc; this.layers = layers; this.metadata = metadata; this.plan = plan;
    this.issues = [...issues, ...plan.diagnostics];
  }

  private draw(): void {
    if (this.sourceDepth > 0 || this.plan === undefined || this.doc === undefined) return;
    const renderIssues: IHtmlResolutionDiagnostic[] = [];
    const evaluated = this.plan.evaluate(Math.max(1, Math.min(this.doc.settings.totalFrames, this.frame)));
    const states = [...evaluated, ...[...this.held].filter((element) => !evaluated.some((state) => state.element === element))
      .map((element) => ({ element, properties: [] }))];
    for (const state of states) {
      if (!this.held.has(state.element)) continue;
      const values: Record<string, import('../../model/propertyTimeline').TimelinePropertyValue> = {};
      const bindings: Record<string, IHtmlResolvedBinding> = {};
      const gradients = new Map<string, IHtmlGradientDefinition>();
      state.properties.forEach((property, index) => {
        const name = `value-${index}`;
        values[name] = property.value; bindings[name] = property.binding;
        for (const gradient of this.context.gradients?.[property.layerId] ?? []) gradients.set(gradient.id, gradient);
      });
      const transform = this.inspection.transform(state.element);
      const css = composeHtmlDeclarations(state.element, values, bindings, [...gradients.values()],
        transform.status === 'value' ? transform.value : undefined);
      for (const issue of css.diagnostics) {
        const property = state.properties[Number(issue.property.slice('value-'.length))];
        const layer = this.layers.find((entry) => entry.layerId === property?.layerId);
        if (layer !== undefined && property !== undefined) renderIssues.push(capabilityDiagnostic(layer, property.property, issue.reason, this.doc.settings.totalFrames));
      }
      const declarations: Record<string, string> = { ...css.declarations };
      const owners = this.layers.filter((layer) => layer.elements.includes(state.element));
      const managed = owners.filter((layer) => layer.layer.spans.length > 0 && needsVisibility(layer.layer, this.doc!.settings.totalFrames));
      if (owners.some((layer) => this.visible.get(layer.layerId) === false) || managed.some((layer) => this.active.get(layer.layerId) === false)) declarations.visibility = 'hidden';
      else if (managed.length > 0) declarations.visibility = 'visible';
      const previous = this.written.get(state.element) ?? new Set<string>();
      for (const name of previous) if (!(name in declarations)) this.keeper.restore(state.element, name);
      for (const [name, value] of Object.entries(declarations)) this.keeper.write(state.element, name, value, 'important');
      this.written.set(state.element, new Set(Object.keys(declarations)));
    }
    this.renderIssues = [...new Map(renderIssues.map((issue) => [issue.id, issue])).values()];
  }
}
