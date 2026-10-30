// demo/editor/src/propertyTimelinesTypes.ts
import type { IEditor, PropertyChangedEvent } from '@kazo-ca/timeline-editor';
import type { TimelinePropertyValues } from '@kazo-ca/timeline-runtime';

/** Read-only observation bridge; all editing tests use the visible controls. */
export interface IPropertyEditingFixture {
  readonly ready: true;
  readonly editor: IEditor;
  objectValues(): TimelinePropertyValues;
  events(): readonly PropertyChangedEvent[];
  transactionActive(): boolean;
}
declare global { interface Window { propertyEditingFixture?: IPropertyEditingFixture; } }
