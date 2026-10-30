// packages/editor/src/model/propertyTimelines/types.ts
import type { PropertyEasing, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';

interface IPropertyOperationTarget {
  readonly layerId: string;
  readonly property: string;
}

interface IPropertyKeyTarget extends IPropertyOperationTarget {
  readonly frame: number;
}

export type PropertyTimelineOperation =
  | (IPropertyKeyTarget & { readonly kind: 'set'; readonly value: TimelinePropertyValue; readonly initialValue?: TimelinePropertyValue })
  | (IPropertyKeyTarget & { readonly kind: 'capture'; readonly initialValue?: TimelinePropertyValue })
  | (IPropertyKeyTarget & { readonly kind: 'delete-key' })
  | (IPropertyKeyTarget & { readonly kind: 'move-key'; readonly toFrame: number })
  | (IPropertyOperationTarget & { readonly kind: 'create-transition'; readonly frames: readonly number[]; readonly easing?: PropertyEasing })
  | (IPropertyOperationTarget & { readonly kind: 'remove-transition'; readonly transitionId: string })
  | (IPropertyOperationTarget & { readonly kind: 'set-easing'; readonly transitionId: string; readonly easing?: PropertyEasing })
  | (IPropertyOperationTarget & { readonly kind: 'migrate' });
