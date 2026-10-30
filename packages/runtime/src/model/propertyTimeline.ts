// packages/runtime/src/model/propertyTimeline.ts
import type { PropertyEasing } from './propertyEasing';
import type { Easing } from './easing';

/** A serializable value, independent of DOM or property-registry adapters. */
export type TimelinePropertyValue =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'color'; readonly r: number; readonly g: number; readonly b: number; readonly a: number };

export interface IPropertyTimelineKeyframe {
  readonly frame: number;
  readonly value: TimelinePropertyValue;
}

/** Original immutable curve retained when a transition is split. */
export interface IPropertyCurveSource {
  readonly start: number;
  readonly end: number;
  readonly keys: readonly IPropertyTimelineKeyframe[];
  readonly easing?: PropertyEasing;
  /** Migrated numeric span: retain historic absolute-frame arithmetic, exclusive with easing. */
  readonly legacyEasing?: Easing;
}

export interface IPropertyTransition {
  readonly id: string;
  readonly fromFrame: number;
  readonly toFrame: number;
  readonly easing?: PropertyEasing;
  readonly source?: IPropertyCurveSource;
}

/** Keys hold their value until the next key; only explicit transitions interpolate. */
export interface IPropertyTimeline {
  readonly initialValue: TimelinePropertyValue;
  readonly keys: readonly IPropertyTimelineKeyframe[];
  readonly transitions?: readonly IPropertyTransition[];
  readonly beforeFirst?: 'initial' | 'first-key';
  readonly label?: string;
  readonly group?: string;
}
