// packages/runtime/src/model/issues.ts
/**
 * Codes et forme des problèmes relevés par `validateDocument` : contrôle de
 * forme (ce que décrit le schéma JSON) puis invariants sémantiques.
 */

/** Issue codes, one per rule. */
export const ValidationCodes = {
  // Shape (what `schema/timeline.schema.json` describes).
  /** A value has the wrong JSON type (object, array, string, integer, number, boolean). */
  INVALID_TYPE: 'invalid-type',
  /** A required field is absent. */
  MISSING_FIELD: 'missing-field',
  /** A field is not allowed on this object. */
  UNKNOWN_FIELD: 'unknown-field',
  /** `version` is not a 2.x.y semver string. */
  INVALID_VERSION: 'invalid-version',
  /** A number is outside its range (fps 1..240, totalFrames and frames >= 1). */
  OUT_OF_RANGE: 'out-of-range',
  /** A string breaks its rule (empty id, color, span kind, node type...). */
  INVALID_VALUE: 'invalid-value',
  /** A target does not have exactly one key among `selector`, `ref`, `element`, or the key is malformed. */
  INVALID_TARGET: 'invalid-target',
  /** A runtime-only `{ element }` target, refused with `allowLiveTargets: false`. */
  LIVE_TARGET: 'live-target',
  /** A track name breaks the property name rule (see `isValidPropertyName`). */
  INVALID_PROPERTY_NAME: 'invalid-property-name',
  /** A property value is NaN or infinite. */
  NON_FINITE_VALUE: 'non-finite-value',
  // Semantic invariants (beyond JSON Schema).
  /** An id is used by more than one layer, folder or span. */
  DUPLICATE_ID: 'duplicate-id',
  /** `span.end < span.start`. */
  SPAN_INVALID_RANGE: 'span-invalid-range',
  /** A span starts before the previous one. */
  SPANS_UNSORTED: 'spans-unsorted',
  /** Gap or overlap between two consecutive spans (`next.start !== prev.end + 1`). */
  SPANS_NOT_CONTIGUOUS: 'spans-not-contiguous',
  /** The first span of a layer does not start at frame 1. */
  FIRST_SPAN_NOT_AT_FRAME_1: 'first-span-not-at-frame-1',
  /** A span ends after `settings.totalFrames`. */
  SPAN_EXCEEDS_TOTAL_FRAMES: 'span-exceeds-total-frames',
  /** A property keyframe lies outside its span [start, end]. */
  KEYFRAME_OUT_OF_SPAN: 'keyframe-out-of-span',
  /** Keyframe frames of a track are not strictly increasing (or duplicated). */
  KEYFRAMES_NOT_INCREASING: 'keyframes-not-increasing',
  /** A keyframe of a static span is not at `span.start`. */
  STATIC_KEYFRAME_NOT_AT_START: 'static-keyframe-not-at-start',
  /** A blank span has tracks. */
  TRACKS_NOT_ALLOWED: 'tracks-not-allowed',
  /** A non-tween span has an easing. */
  EASING_NOT_ALLOWED: 'easing-not-allowed',
  /** The easing string does not parse (see `parseEasing`). */
  INVALID_EASING: 'invalid-easing',
  /** A typed property key lies after the document duration. */
  PROPERTY_KEY_OUT_OF_RANGE: 'property-key-out-of-range',
  /** A property changes its serialized value kind. */
  PROPERTY_KIND_MISMATCH: 'property-kind-mismatch',
  /** A property is driven by both legacy spans and an independent timeline. */
  PROPERTY_TRACK_CONFLICT: 'property-track-conflict',
  /** A transition does not connect two consecutive property keys. */
  INVALID_PROPERTY_TRANSITION: 'invalid-property-transition',
  /** More than one transition covers the same interval. */
  PROPERTY_TRANSITIONS_OVERLAP: 'property-transitions-overlap',
  /** Text and boolean properties cannot interpolate. */
  PROPERTY_NOT_INTERPOLABLE: 'property-not-interpolable',
  /** A preserved source curve does not cover or describe its transition. */
  INVALID_CURVE_SOURCE: 'invalid-curve-source'
} as const;

export type ValidationCode = (typeof ValidationCodes)[keyof typeof ValidationCodes];

/** One broken rule. */
export interface IValidationIssue {
  /** JSON-pointer-like path of the faulty value, e.g. `/layers/0/spans/1/start`. */
  readonly path: string;
  readonly code: ValidationCode;
  readonly message: string;
}

/** Escapes `~` and `/` in one JSON pointer token. */
export function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}
