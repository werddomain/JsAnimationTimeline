// packages/editor/src/plugins/properties/panel/panelState.ts
import { findNodeById, flattenLayers, isLayer, resolveLocked } from '@kazo-ca/timeline-runtime';
import type { ITargetPropertyInfo, ITimelineDocument, PropertyDescriptor } from '@kazo-ca/timeline-runtime';
import type { IEditorContext } from '../../../core/context/IEditorContext';
import { createStagePropertyEditContext } from '../../../core/stage/propertyEditContext';
import { getTargetProperties, getTargetPropertyNames } from '../../../model/properties/targetProperties';
import { modernDescriptors } from '../../tweens/propertyKeyframes/modernDescriptors';
import type {} from '../../layers/selection/types';
import type {} from '../../tweens/propertyKeyframes/types';

export interface IPanelField {
  readonly descriptor: PropertyDescriptor;
  readonly value: number;
  readonly defaultOrigin: boolean;
  readonly stored?: number;
  readonly disabledReason?: string;
  readonly capabilityReason?: string;
  /** No common resolved value is available; an explicit draft may still be edited. */
  readonly unresolvedValue?: boolean;
}
export interface IPanelState {
  readonly document: ITimelineDocument;
  readonly selection: string;
  readonly layerId?: string;
  readonly frame: number;
  readonly revision: number;
  readonly playing: boolean;
  readonly title: string;
  readonly reason: string;
  readonly fields: readonly IPanelField[];
}

const LABELS: Readonly<Record<string, string>> = Object.freeze({
  x: 'Position X', y: 'Position Y', rotation: 'Rotation', scaleX: 'Échelle X',
  scaleY: 'Échelle Y', skewX: 'Inclinaison X', skewY: 'Inclinaison Y', opacity: 'Opacité'
});

const unavailableDescriptors = new WeakMap<ITimelineDocument, Map<string, PropertyDescriptor>>();

/** Preserve stable descriptors for disabled numeric fields without adding document tracks. */
function unavailableDescriptor(doc: ITimelineDocument, info: ITargetPropertyInfo, layerId: string): PropertyDescriptor | undefined {
  if (info.initialValue?.kind !== 'number') return undefined;
  const key = JSON.stringify([layerId, info.name, info.label, info.unit, info.initialValue.value]);
  const known = unavailableDescriptors.get(doc) ?? new Map<string, PropertyDescriptor>();
  unavailableDescriptors.set(doc, known);
  let descriptor = known.get(key);
  if (descriptor === undefined) {
    descriptor = Object.freeze({ name: info.name, label: info.label, kind: 'value', unit: info.unit ?? '', defaultValue: info.initialValue.value });
    known.set(key, descriptor);
  }
  return descriptor;
}

function withCapability(field: IPanelField, capability: ITargetPropertyInfo | undefined, layerId: string, frame: number): IPanelField {
  if (capability === undefined) return field;
  const reason = capability.reason ?? 'Cette propriété n’est pas modifiable pour cette cible.';
  const info = capability.reason === undefined ? {} : { capabilityReason: capability.reason };
  if (capability.editable === false) return { ...field, ...info, disabledReason: reason };
  if (capability.sample === undefined) return { ...field, ...info };
  try {
    const value = capability.sample(layerId, frame);
    if (value.kind !== 'number' || !Number.isFinite(value.value)) throw new Error('La valeur évaluée doit être numérique et finie.');
    return { ...field, ...info, value: value.value, defaultOrigin: false };
  } catch (error) {
    const message = error instanceof Error && error.message.trim() !== '' ? error.message : 'La valeur évaluée est indisponible.';
    return { ...field, unresolvedValue: true, capabilityReason: message };
  }
}

export function propertyLabel(descriptor: PropertyDescriptor): string {
  if (descriptor.label !== undefined && descriptor.label.trim() !== '') return descriptor.label;
  return Object.prototype.hasOwnProperty.call(LABELS, descriptor.name) ? LABELS[descriptor.name] : descriptor.name;
}

/** Read only W2 descriptors and the same evaluated sample as editor.sample(). */
export function readPanelState(ctx: IEditorContext, revision: number): IPanelState {
  const doc = ctx.document;
  const ids = ctx.services.require('layers.selection').selected();
  const frame = ctx.playback.frame;
  const base: IPanelState = { document: doc, selection: JSON.stringify(ids), frame, revision,
    playing: ctx.playback.playing, title: 'Propriétés', reason: '', fields: [] };
  if (ids.length === 0) return { ...base, reason: 'Sélectionnez un calque pour inspecter ses propriétés.' };
  if (ids.length !== 1) return { ...base, reason: 'Sélectionnez un seul calque.' };
  const node = findNodeById(doc.layers, ids[0]);
  if (node === undefined) return { ...base, reason: 'Le calque sélectionné est introuvable.' };
  if (!isLayer(node)) return { ...base, reason: 'Un dossier ne possède pas de propriétés animables.' };
  const target = { ...base, layerId: node.id, title: node.name + ' · image ' + frame };
  try {
    const metadata = getTargetProperties(node.target, createStagePropertyEditContext(ctx.registry, ctx.stage.stages));
    // Query host metadata once per panel snapshot. Command execution performs its own fresh query.
    const context = { registry: ctx.registry, describe: () => node.target === undefined ? undefined
      : { target: node.target, label: node.name, properties: metadata } };
    const modern = Object.keys(node.propertyTimelines ?? {}).length > 0;
    const names = new Set(getTargetPropertyNames(node.target, context));
    const descriptors = modern ? [...modernDescriptors(node, context)] : ctx.registry.list().filter(({ name }) => names.has(name));
    const capabilities = new Map(metadata?.filter((info): info is ITargetPropertyInfo => typeof info !== 'string').map((info) => [info.name, info]));
    capabilities.forEach((info) => {
      if (info.editable !== false || descriptors.some(({ name }) => name === info.name)) return;
      const descriptor = ctx.registry.get(info.name) ?? unavailableDescriptor(doc, info, node.id);
      if (descriptor !== undefined) descriptors.push(descriptor);
    });
    const sample = ctx.playback.sample(frame).layer(node.id);
    const span = node.spans.find((entry) => entry.start <= frame && frame <= entry.end);
    const visit = flattenLayers(doc.layers).find(({ node: entry }) => entry.id === node.id);
    const locked = resolveLocked(node) || visit?.parentIds.some((id) => {
      const parent = findNodeById(doc.layers, id);
      return parent !== undefined && resolveLocked(parent);
    });
    let reason = '';
    if (ctx.playback.playing) reason = 'Lecture en cours : modification indisponible.';
    else if (locked) reason = 'Ce calque est verrouillé (directement ou par son dossier).';
    else if (!Number.isInteger(frame) || frame < 1 || frame > doc.settings.totalFrames) reason = 'Cette image est indisponible.';
    else if ((!modern && span === undefined) || span?.kind === 'blank') reason = 'Aucun contenu à cette image : consultation uniquement.';
    else if (descriptors.length === 0) reason = 'Aucune propriété autorisée pour cette cible.';
    const fields = descriptors.map((descriptor): IPanelField => {
      const name = descriptor.name;
      const timeline = node.propertyTimelines !== undefined && Object.prototype.hasOwnProperty.call(node.propertyTimelines, name)
        ? node.propertyTimelines[name] : undefined;
      if (timeline !== undefined) {
        const evaluated = sample?.propertyValues?.[name];
        const stored = timeline.keys.find((key) => key.frame === frame)?.value;
        return withCapability({ descriptor, value: evaluated?.kind === 'number' ? evaluated.value : descriptor.defaultValue,
          defaultOrigin: false, ...(stored?.kind === 'number' ? { stored: stored.value } : {}) }, capabilities.get(name), node.id, frame);
      }
      const values = sample?.values;
      const own = values !== undefined && Object.prototype.hasOwnProperty.call(values, name);
      const track = span?.tracks !== undefined && Object.prototype.hasOwnProperty.call(span.tracks, name) ? span.tracks[name] : [];
      const stored = track.find((key) => key.frame === (span?.kind === 'static' ? span.start : frame))?.value;
      return withCapability({ descriptor, value: own ? values[name] : descriptor.defaultValue, defaultOrigin: !own,
        ...(stored === undefined ? {} : { stored }) }, capabilities.get(name), node.id, frame);
    });
    return { ...target, reason, fields };
  } catch {
    return { ...target, reason: 'Les propriétés de la cible sont indisponibles.' };
  }
}

/** Focus-only layer events and fractional playback ticks keep the same context. */
export function samePanelContext(a: IPanelState, b: IPanelState): boolean {
  return a.document === b.document && a.selection === b.selection && a.frame === b.frame &&
    a.revision === b.revision && a.playing === b.playing && a.reason === b.reason &&
    a.fields.length === b.fields.length && a.fields.every((field, i) => field.descriptor === b.fields[i].descriptor &&
      field.disabledReason === b.fields[i].disabledReason && field.capabilityReason === b.fields[i].capabilityReason &&
      field.unresolvedValue === b.fields[i].unresolvedValue);
}

