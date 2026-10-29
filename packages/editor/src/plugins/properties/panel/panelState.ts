// packages/editor/src/plugins/properties/panel/panelState.ts
import { findNodeById, flattenLayers, isLayer, resolveLocked } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument, PropertyDescriptor } from '@kazo-ca/timeline-runtime';
import type { IEditorContext } from '../../../core/context/IEditorContext';
import type {} from '../../layers/selection/types';
import type {} from '../../tweens/propertyKeyframes/types';

export interface IPanelField {
  readonly descriptor: PropertyDescriptor;
  readonly value: number;
  readonly defaultOrigin: boolean;
  readonly stored?: number;
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
    const descriptors = ctx.services.require('tweens.propertyKeyframes').propertiesFor(node.id);
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
    else if (span === undefined || span.kind === 'blank') reason = 'Aucun contenu à cette image : consultation uniquement.';
    else if (descriptors.length === 0) reason = 'Aucune propriété autorisée pour cette cible.';
    const fields = descriptors.map((descriptor): IPanelField => {
      const name = descriptor.name;
      const values = sample?.values;
      const own = values !== undefined && Object.prototype.hasOwnProperty.call(values, name);
      const track = span?.tracks !== undefined && Object.prototype.hasOwnProperty.call(span.tracks, name) ? span.tracks[name] : [];
      const stored = track.find((key) => key.frame === (span?.kind === 'static' ? span.start : frame))?.value;
      return { descriptor, value: own ? values[name] : descriptor.defaultValue, defaultOrigin: !own,
        ...(stored === undefined ? {} : { stored }) };
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
    a.fields.length === b.fields.length && a.fields.every((field, i) => field.descriptor === b.fields[i].descriptor);
}

