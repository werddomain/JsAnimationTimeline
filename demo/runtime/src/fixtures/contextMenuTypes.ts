// demo/runtime/src/fixtures/contextMenuTypes.ts
/** Public read-only browser inspection contract for the I1 validation fixture. */
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { IFrameCell, ISelectedKeyframe } from '@kazo-ca/timeline-editor';

export type ContextMenuEditorId = 'primary' | 'secondary';

export interface IContextMenuSnapshot {
  readonly document: ITimelineDocument;
  readonly cells: readonly IFrameCell[];
  readonly keyframes: readonly ISelectedKeyframe[];
  readonly layers: readonly string[];
  readonly clipboard: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly destroyed: boolean;
  readonly frame: number;
  readonly sample: { readonly active: boolean; readonly x: unknown } | undefined;
}

export interface IContextMenuFixture {
  readonly ready: true;
  readonly inspect: (id: ContextMenuEditorId) => IContextMenuSnapshot;
  readonly cellPoint: (id: ContextMenuEditorId, rowId: string, frame: number) => { readonly x: number; readonly y: number };
}

declare global {
  interface Window {
    contextMenuReview?: IContextMenuFixture | { readonly ready: false; readonly error: string };
  }
}
