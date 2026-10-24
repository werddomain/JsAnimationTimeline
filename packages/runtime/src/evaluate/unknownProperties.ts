// packages/runtime/src/evaluate/unknownProperties.ts
/**
 * Pistes dont le nom est inconnu du registre : par défaut l'évaluation lève
 * une erreur ; avec `unknownProperties: 'skip'`, seule la piste inconnue est
 * retirée (copie du calque, l'original n'est pas modifié) et signalée par
 * `onIssue`, et le calque continue de s'animer.
 */

import { resolveTracks } from '../model/defaults';
import type { ILayer } from '../model/layer';
import type { ISpan, PropertyTracks } from '../model/span';
import type { PropertyRegistry } from '../properties/PropertyRegistry';

/** `throw` (default): an unknown track name throws; `skip`: the track is dropped and reported. */
export type UnknownPropertyPolicy = 'throw' | 'skip';

/** Codes of the issues reported by the evaluation. */
export const EvaluateIssueCodes = {
  /** A track names a property unknown to the registry (only with `unknownProperties: 'skip'`). */
  UNKNOWN_PROPERTY: 'unknown-property'
} as const;

export type EvaluateIssueCode = (typeof EvaluateIssueCodes)[keyof typeof EvaluateIssueCodes];

/** A problem met while evaluating that did not stop the evaluation. */
export interface IEvaluateIssue {
  readonly code: EvaluateIssueCode;
  readonly layerId: string;
  /** Name of the dropped track. */
  readonly property: string;
  readonly message: string;
}

/** Receives each issue; called again on every evaluation (callers dedupe if needed). */
export type EvaluateIssueListener = (issue: IEvaluateIssue) => void;

/** Track names of `layer` unknown to `registry`, in order of first appearance. */
export function findUnknownProperties(layer: ILayer, registry: PropertyRegistry): string[] {
  const names = new Set<string>();
  for (const span of layer.spans) {
    Object.keys(resolveTracks(span))
      .filter((name) => !registry.has(name))
      .forEach((name) => names.add(name));
  }
  return Array.from(names);
}

function withoutTracks(tracks: PropertyTracks, dropped: ReadonlySet<string>): PropertyTracks {
  return Object.fromEntries(Object.entries(tracks).filter(([name]) => !dropped.has(name)));
}

function stripSpan(span: ISpan, dropped: ReadonlySet<string>): ISpan {
  return span.tracks === undefined ? span : { ...span, tracks: withoutTracks(span.tracks, dropped) };
}

/**
 * `layer` ready to evaluate under `policy`: unchanged when every track is
 * known or with `throw` (the evaluation then throws on the unknown name);
 * with `skip`, a copy without the unknown tracks, each one reported once.
 */
export function applyUnknownPropertyPolicy(
  layer: ILayer,
  registry: PropertyRegistry,
  policy: UnknownPropertyPolicy,
  onIssue: EvaluateIssueListener | undefined
): ILayer {
  if (policy !== 'skip') {
    return layer;
  }
  const unknown = findUnknownProperties(layer, registry);
  if (unknown.length === 0) {
    return layer;
  }
  unknown.forEach((property) => onIssue?.({
    code: EvaluateIssueCodes.UNKNOWN_PROPERTY,
    layerId: layer.id,
    property,
    message: `Layer "${layer.id}": unknown property "${property}" skipped.`
  }));
  const dropped = new Set(unknown);
  return { ...layer, spans: layer.spans.map((span) => stripSpan(span, dropped)) };
}

/** Throws for a policy other than `throw` or `skip` (e.g. a typo from JavaScript). */
export function assertUnknownPropertyPolicy(policy: unknown): asserts policy is UnknownPropertyPolicy | undefined {
  if (policy !== undefined && policy !== 'throw' && policy !== 'skip') {
    throw new Error(`unknownProperties must be "throw" or "skip" (got ${String(policy)}).`);
  }
}
