// packages/runtime/src/model/propertyTimelineValidation.ts
import { escapePointerToken, ValidationCodes } from './issues';
import type { IValidationIssue, ValidationCode } from './issues';
import type { ILayer } from './layer';
import type { IPropertyTimeline, IPropertyTimelineKeyframe, IPropertyTransition, TimelinePropertyValue } from './propertyTimeline';

type Reporter = (path: string, code: ValidationCode, message: string) => void;
type UniqueIdCheck = (id: string, path: string) => void;

function validateKeys(keys: readonly IPropertyTimelineKeyframe[], kind: TimelinePropertyValue['kind'], totalFrames: number, path: string, report: Reporter): void {
  keys.forEach((key, index) => {
    const keyPath = `${path}/${index}`;
    if (key.frame > totalFrames) report(`${keyPath}/frame`, ValidationCodes.PROPERTY_KEY_OUT_OF_RANGE, `Key exceeds the last frame (${totalFrames}).`);
    if (index > 0 && key.frame <= keys[index - 1].frame) {
      report(`${keyPath}/frame`, ValidationCodes.KEYFRAMES_NOT_INCREASING, 'Property keys must be strictly increasing.');
    }
    if (key.value.kind !== kind) report(`${keyPath}/value`, ValidationCodes.PROPERTY_KIND_MISMATCH, `Expected a ${kind} property value.`);
  });
}

function validateSource(transition: IPropertyTransition, kind: TimelinePropertyValue['kind'], totalFrames: number, path: string, report: Reporter): void {
  const source = transition.source;
  if (source === undefined) return;
  const sourcePath = `${path}/source`;
  validateKeys(source.keys, kind, totalFrames, `${sourcePath}/keys`, report);
  if (source.start >= source.end || source.start > transition.fromFrame || source.end < transition.toFrame || source.end > totalFrames) {
    report(sourcePath, ValidationCodes.INVALID_CURVE_SOURCE, 'Source bounds must cover the transition inside the document.');
  }
  if (source.keys.length < 2 || source.keys[0]?.frame !== source.start || source.keys[source.keys.length - 1]?.frame !== source.end
      || source.keys.some((key) => key.frame < source.start || key.frame > source.end)) {
    report(`${sourcePath}/keys`, ValidationCodes.INVALID_CURVE_SOURCE, 'Source keys must include both source boundaries and remain inside them.');
  }
}

function validateTransitions(track: IPropertyTimeline, totalFrames: number, path: string, report: Reporter, uniqueId: UniqueIdCheck): void {
  const transitions = track.transitions ?? [];
  transitions.forEach((transition, index) => {
    const transitionPath = `${path}/transitions/${index}`;
    uniqueId(transition.id, `${transitionPath}/id`);
    const fromIndex = track.keys.findIndex((key) => key.frame === transition.fromFrame);
    const toKey = track.keys[fromIndex + 1];
    if (transition.fromFrame >= transition.toFrame || fromIndex < 0 || toKey?.frame !== transition.toFrame) {
      report(transitionPath, ValidationCodes.INVALID_PROPERTY_TRANSITION, 'A transition must connect two existing consecutive keys in increasing order.');
    }
    if (track.initialValue.kind !== 'number' && track.initialValue.kind !== 'color') {
      report(transitionPath, ValidationCodes.PROPERTY_NOT_INTERPOLABLE, 'Only number and color properties support transitions.');
    }
    if (transitions.slice(0, index).some((previous) => Math.max(previous.fromFrame, transition.fromFrame) < Math.min(previous.toFrame, transition.toFrame))) {
      report(transitionPath, ValidationCodes.PROPERTY_TRANSITIONS_OVERLAP, 'Property transitions cannot overlap.');
    }
    validateSource(transition, track.initialValue.kind, totalFrames, transitionPath, report);
  });
}

/** Semantic rules applied after the complete document shape has been checked. */
export function validatePropertyTimelines(layer: ILayer, totalFrames: number, path: string, uniqueId: UniqueIdCheck): IValidationIssue[] {
  const issues: IValidationIssue[] = [];
  const report: Reporter = (issuePath, code, message) => issues.push({ path: issuePath, code, message });
  for (const [name, track] of Object.entries(layer.propertyTimelines ?? {})) {
    const trackPath = `${path}/propertyTimelines/${escapePointerToken(name)}`;
    if (layer.spans.some((span) => span.tracks !== undefined && Object.prototype.hasOwnProperty.call(span.tracks, name))) {
      report(trackPath, ValidationCodes.PROPERTY_TRACK_CONFLICT, `Property "${name}" also has legacy span tracks.`);
    }
    validateKeys(track.keys, track.initialValue.kind, totalFrames, `${trackPath}/keys`, report);
    validateTransitions(track, totalFrames, trackPath, report, uniqueId);
  }
  return issues;
}
