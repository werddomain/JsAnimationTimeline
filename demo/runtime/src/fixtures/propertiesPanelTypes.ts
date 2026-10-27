// demo/runtime/src/fixtures/propertiesPanelTypes.ts
import type { IEditor, IPropertiesPanelService } from '@werddomain/timeline-editor';
export interface IPropertiesPanelMetrics { htmlRenders: number; objectRenders: number; }
export interface IPropertiesPanelFixture {
  readonly ready: true;
  readonly editor: IEditor;
  readonly secondary: IEditor;
  readonly service: IPropertiesPanelService;
  readonly secondService: IPropertiesPanelService;
  readonly object: { volume: number };
  readonly metrics: IPropertiesPanelMetrics;
  readonly changes: readonly string[];
  readonly refusals: readonly string[];
  readonly secondReadCallbackRuns: number;
  armSecondPropertyRead(callback: () => void): void;
  seek(frame: number): Promise<void>;
  setCapabilities(properties: readonly string[]): void;
}
declare global {
  interface Window { propertiesPanel?: IPropertiesPanelFixture; }
}
