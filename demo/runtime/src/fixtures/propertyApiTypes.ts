// demo/runtime/src/fixtures/propertyApiTypes.ts
import type { IEditor } from '@werddomain/timeline-editor';
import type { ITargetInfo, ITimelineDocument } from '@werddomain/timeline-runtime';

/** Public API handles for the permanent property contract browser fixture. */
export interface IPropertyApiFixture {
  readonly ready: true;
  readonly editor: IEditor;
  readonly stageFree: IEditor;
  readonly objectEditor: IEditor;
  readonly object: { volume: number };
  readonly refusals: readonly string[];
  readonly changes: readonly string[];
  seek(frame: number): Promise<void>;
  loadObjectOnMetadata(document: ITimelineDocument): void;
  setObjectProperties(properties: ITargetInfo['properties']): void;
}

declare global {
  interface Window { propertyApi?: IPropertyApiFixture; }
}
