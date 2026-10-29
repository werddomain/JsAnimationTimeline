// packages/editor/src/model/properties/propertyValue.ts
import type { IPropertyKeyframe, ISpan, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { assertFrame, replaceLayer, requireEditableLayer } from '../spans/layerAccess';
import { spanIndexAt } from '../spans/tracks';
import { getTargetPropertyNames } from './targetProperties';
import type { IPropertyEditContext } from './targetProperties';

/** A business refusal from a pure property operation. Messages are UI-ready. */
export class PropertyOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyOperationError';
    Object.setPrototypeOf(this, PropertyOperationError.prototype);
  }
}

function writeKey(span: ISpan, name: string, value: number, frame: number): ISpan {
  const tracks = span.tracks;
  // A registered name such as toString must not read Object.prototype as a track.
  const track = tracks !== undefined && Object.prototype.hasOwnProperty.call(tracks, name) ? tracks[name] : [];
  const existing = track.find((key) => key.frame === frame);
  if (existing?.value === value) return span;
  const key: IPropertyKeyframe = existing === undefined ? { frame, value } : { ...existing, value };
  const nextTrack = [...track.filter((entry) => entry.frame !== frame), key].sort((a, b) => a.frame - b.frame);
  return { ...span, tracks: { ...tracks, [name]: nextTrack } };
}

/**
 * Immutable property edit. Tween frames are absolute; static edits use start.
 * Values are stored verbatim: runtime evaluation retains its existing bounds
 * and easing semantics. No span splitting, track sampling or duration growth.
 */
export function applyPropertyValue(
  doc: ITimelineDocument,
  layerId: string,
  name: string,
  value: number,
  frame: number,
  context: IPropertyEditContext
): ITimelineDocument {
  assertFrame(doc, frame);
  const layer = requireEditableLayer(doc, layerId);
  if (!context.registry.has(name)) throw new PropertyOperationError(`La propriété « ${name} » est inconnue.`);
  if (!Number.isFinite(value)) throw new PropertyOperationError('La valeur de propriété doit être un nombre fini.');
  const index = spanIndexAt(layer, frame);
  const span = layer.spans[index];
  if (span === undefined || span.kind === 'blank') {
    throw new PropertyOperationError(`Le calque « ${layer.name} » ne contient aucun contenu à l'image ${frame}.`);
  }
  if (!getTargetPropertyNames(layer.target, context).includes(name)) {
    throw new PropertyOperationError(`La propriété « ${name} » n'est pas autorisée pour cette cible.`);
  }
  const next = writeKey(span, name, value, span.kind === 'static' ? span.start : frame);
  if (next === span) return doc;
  const spans = layer.spans.map((entry, position) => position === index ? next : entry);
  return replaceLayer(doc, { ...layer, spans });
}
