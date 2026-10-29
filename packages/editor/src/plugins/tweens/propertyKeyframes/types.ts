// packages/editor/src/plugins/tweens/propertyKeyframes/types.ts
import type { PropertyDescriptor } from '@kazo-ca/timeline-runtime';
import type { SetPropertyOptions } from '../../../core/editor/types';

/** Headless property controls, shared with the public editor's undo history. */
export interface IPropertyKeyframesService {
  /** Fresh registered capabilities of a layer's routed target; locks do not hide them. */
  propertiesFor(layerId: string): readonly PropertyDescriptor[];
  /** The same command and stored-key contract as IEditor.setProperty. */
  setProperty(layerId: string, name: string, value: number, options?: SetPropertyOptions): boolean;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'tweens.propertyKeyframes': IPropertyKeyframesService;
  }
}
