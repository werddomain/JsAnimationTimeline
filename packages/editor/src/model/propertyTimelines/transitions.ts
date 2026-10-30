// packages/editor/src/model/propertyTimelines/transitions.ts
import { isLayer, isPropertyEasing, parseEasing, walkLayers } from '@kazo-ca/timeline-runtime';
import type { IPropertyCurveSource, IPropertyTimeline, IPropertyTransition, ITimelineDocument, PropertyEasing } from '@kazo-ca/timeline-runtime';
import { PropertyOperationError } from '../properties/propertyValue';
import { assertEasing, sameEasing } from './values';

/** Transition ids share the document-wide namespace with nodes and legacy spans. */
export function createTransitionIdFactory(doc: ITimelineDocument, layerId: string): () => string {
  const used = new Set<string>();
  walkLayers(doc.layers, ({ node }) => {
    used.add(node.id);
    if (!isLayer(node)) return;
    node.spans.forEach((span) => used.add(span.id));
    Object.values(node.propertyTimelines ?? {}).forEach((track) => track.transitions?.forEach((transition) => used.add(transition.id)));
  });
  let counter = 0;
  return () => {
    let id: string;
    do { id = `${layerId}-p${++counter}`; } while (used.has(id));
    used.add(id);
    return id;
  };
}

function sourceEasing(transition: IPropertyTransition): PropertyEasing | undefined {
  const source = transition.source;
  if (source === undefined) return transition.easing;
  if (source?.easing !== undefined) return source.easing;
  if (source.legacyEasing === undefined) return undefined;
  const curve = parseEasing(source.legacyEasing);
  const easing = curve === null ? undefined : { kind: 'bezier' as const, ...curve };
  if (!isPropertyEasing(easing)) {
    throw new PropertyOperationError("La courbe historique ne peut pas être représentée par un effet éditable. Choisissez d'abord un nouvel effet pour cette interpolation.");
  }
  return easing;
}

/** A retained source must stop overriding endpoints once the user edits them. */
export function detachSource(transition: IPropertyTransition): IPropertyTransition {
  if (transition.source === undefined) return transition;
  const easing = sourceEasing(transition);
  return { id: transition.id, fromFrame: transition.fromFrame, toFrame: transition.toFrame,
    ...(easing === undefined ? {} : { easing }) };
}

export function detachIncidentSources(track: IPropertyTimeline, frame: number): IPropertyTimeline {
  if (track.transitions === undefined) return track;
  const transitions = track.transitions.map((transition) => transition.fromFrame === frame || transition.toFrame === frame
    ? detachSource(transition) : transition);
  return { ...track, transitions };
}

/** Repeated insertion retains a single original curve, never nested segments. */
export function splitTransition(track: IPropertyTimeline, frame: number, nextId: () => string): IPropertyTimeline {
  const found = track.transitions?.find((transition) => transition.fromFrame < frame && transition.toFrame > frame);
  if (found === undefined) return track;
  const source: IPropertyCurveSource = found.source ?? {
    start: found.fromFrame, end: found.toFrame,
    keys: track.keys.filter((key) => key.frame >= found.fromFrame && key.frame <= found.toFrame),
    ...(found.easing === undefined ? {} : { easing: found.easing })
  };
  const first = { ...found, toFrame: frame, source };
  const second = { ...found, id: nextId(), fromFrame: frame, source };
  return { ...track, transitions: track.transitions?.flatMap((transition) => transition === found ? [first, second] : [transition]) };
}

export function createTransition(
  track: IPropertyTimeline, frames: readonly number[], easing: PropertyEasing | undefined, nextId: () => string
): IPropertyTimeline {
  assertEasing(easing);
  if (!Array.isArray(frames) || frames.length !== 2 || !frames.every(Number.isInteger) || frames[0] === frames[1]) {
    throw new PropertyOperationError('Sélectionnez exactement deux clés de la même propriété.');
  }
  const [fromFrame, toFrame] = [...frames].sort((a, b) => a - b);
  const index = track.keys.findIndex((key) => key.frame === fromFrame);
  if (index < 0 || track.keys[index + 1]?.frame !== toFrame) {
    throw new PropertyOperationError('Une interpolation exige deux clés consécutives de la même propriété.');
  }
  if (track.initialValue.kind !== 'number' && track.initialValue.kind !== 'color') {
    throw new PropertyOperationError('Cette propriété ne permet pas une interpolation ; ses clés conservent leur valeur.');
  }
  if (track.transitions?.some((transition) => transition.fromFrame === fromFrame && transition.toFrame === toFrame)) {
    throw new PropertyOperationError("Une interpolation existe déjà entre ces deux clés. Modifiez son effet d'accélération.");
  }
  const transition: IPropertyTransition = { id: nextId(), fromFrame, toFrame, ...(easing === undefined ? {} : { easing }) };
  return { ...track, transitions: [...(track.transitions ?? []), transition].sort((a, b) => a.fromFrame - b.fromFrame) };
}

export function changeTransition(
  track: IPropertyTimeline, transitionId: string, remove: boolean, easing?: PropertyEasing
): IPropertyTimeline {
  assertEasing(easing);
  const found = track.transitions?.find((transition) => transition.id === transitionId);
  if (found === undefined) throw new PropertyOperationError(`L'interpolation « ${transitionId} » est introuvable.`);
  if (remove) return { ...track, transitions: track.transitions?.filter((transition) => transition !== found) };
  if (found.source === undefined && sameEasing(found.easing, easing)) return track;
  const changed: IPropertyTransition = { id: found.id, fromFrame: found.fromFrame, toFrame: found.toFrame,
    ...(easing === undefined ? {} : { easing }) };
  return { ...track, transitions: track.transitions?.map((transition) => transition === found ? changed : transition) };
}
