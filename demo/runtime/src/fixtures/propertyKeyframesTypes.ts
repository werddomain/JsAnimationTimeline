// demo/runtime/src/fixtures/propertyKeyframesTypes.ts
import type { IEditor, IPropertyKeyframesService } from '@kazo-ca/timeline-editor';
import type { ITargetInfo } from '@kazo-ca/timeline-runtime';

export interface IPropertyKeyframesMetrics {
  htmlRenders: number;
  objectRenders: number;
}

/** Permanent fixture handles point to the real editor, service and stage object. */
export interface IPropertyKeyframesFixture {
  readonly ready: true;
  readonly editor: IEditor;
  readonly service: IPropertyKeyframesService;
  readonly object: { volume: number };
  readonly metrics: IPropertyKeyframesMetrics;
  readonly refusals: readonly string[];
  readonly changes: readonly string[];
  seek(frame: number): Promise<void>;
  setObjectProperties(properties: ITargetInfo['properties']): void;
}

declare global {
  interface Window { propertyKeyframes?: IPropertyKeyframesFixture; }
}
