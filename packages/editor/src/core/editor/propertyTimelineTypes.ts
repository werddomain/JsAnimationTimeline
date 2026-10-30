// packages/editor/src/core/editor/propertyTimelineTypes.ts
import type { IPropertyTimeline, PropertyEasing, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import type { DocumentChangeCause } from '../commands/documentChange';

/** A refused request does not change the document or its history. */
export type PropertyTimelineMutationResult =
  | { readonly status: 'changed' }
  | { readonly status: 'noop' }
  | { readonly status: 'refused'; readonly reason: string };

export interface PropertyTimelineEditOptions {
  /** Defaults to the current integer frame, captured when the method is called. */
  readonly frame?: number;
  /** Required on first creation; supplied by the host, never inferred from animated output. */
  readonly initialValue?: TimelinePropertyValue;
}

/** Shared undo transaction. Loading or destroying the editor invalidates this handle. */
export interface IPropertyTimelineTransaction {
  readonly active: boolean;
  commit(): boolean;
  cancel(): void;
}

/** Independent property tracks, usable without editor plugins or a DOM stage. */
export interface IEditorPropertyTimelines {
  set(layerId: string, property: string, value: TimelinePropertyValue, options?: PropertyTimelineEditOptions): PropertyTimelineMutationResult;
  capture(layerId: string, property: string, options?: PropertyTimelineEditOptions): PropertyTimelineMutationResult;
  deleteKey(layerId: string, property: string, frame?: number): PropertyTimelineMutationResult;
  moveKey(layerId: string, property: string, frame: number, toFrame: number): PropertyTimelineMutationResult;
  createTransition(layerId: string, property: string, frames: readonly number[], easing?: PropertyEasing): PropertyTimelineMutationResult;
  removeTransition(layerId: string, property: string, transitionId: string): PropertyTimelineMutationResult;
  /** Omit easing to restore a linear transition. Editing detaches any retained split curve. */
  setEasing(layerId: string, property: string, transitionId: string, easing?: PropertyEasing): PropertyTimelineMutationResult;
  /** Explicit migration; refuses legacy shapes whose exact behavior cannot be retained. */
  migrate(layerId: string, property: string): PropertyTimelineMutationResult;
  beginTransaction(label: string): IPropertyTimelineTransaction;
}

/** A committed track diff. Seeking and loading documents do not emit this event. */
export interface PropertyChangedEvent {
  readonly layerId: string;
  readonly property: string;
  readonly before?: IPropertyTimeline;
  readonly after?: IPropertyTimeline;
  readonly cause: DocumentChangeCause;
  readonly label: string;
  /** Present during an active gesture, including its cancellation. */
  readonly transactionId?: string;
  readonly kind: 'key' | 'transition' | 'track';
  /** Point summaries are present only for one changed key, never for structural edits. */
  readonly frame?: number;
  readonly oldValue?: TimelinePropertyValue;
  readonly newValue?: TimelinePropertyValue;
}

declare module '../events/TimelineEventMap' {
  interface TimelineEventMap {
    'property:changed': PropertyChangedEvent;
  }
}
