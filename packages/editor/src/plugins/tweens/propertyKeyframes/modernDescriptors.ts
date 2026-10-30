// packages/editor/src/plugins/tweens/propertyKeyframes/modernDescriptors.ts
import type { ILayer, IPropertyTimeline, PropertyDescriptor } from '@kazo-ca/timeline-runtime';
import type { IPropertyEditContext } from '../../../model/properties/targetProperties';
import { allowedPropertyNames } from '../../../model/propertyTimelines/operations';

const descriptors = new WeakMap<IPropertyTimeline, ReadonlyMap<string, PropertyDescriptor>>();

/** Stable numeric inspector descriptors; rich CSS editing belongs to the host inspector. */
export function modernDescriptors(layer: ILayer, context: IPropertyEditContext): readonly PropertyDescriptor[] {
  const allowed = allowedPropertyNames(layer, context);
  return Object.entries(layer.propertyTimelines ?? {}).flatMap(([name, track]) => {
    if (track.initialValue.kind !== 'number' || (allowed !== undefined && !allowed.includes(name))) return [];
    const registered = context.registry.get(name);
    if (registered !== undefined) return [registered];
    let descriptor = descriptors.get(track)?.get(name);
    if (descriptor === undefined) {
      descriptor = Object.freeze({ name, kind: 'value', unit: '', label: track.label ?? name, defaultValue: track.initialValue.value });
      const entries = new Map(descriptors.get(track));
      entries.set(name, descriptor);
      descriptors.set(track, entries);
    }
    return [descriptor];
  });
}
