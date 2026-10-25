// demo/runtime/src/validation/phase5Types.ts
/** Inspection handle for the phase-5 review; metrics count actual stage draws. */
import type { IEditor } from '@werddomain/timeline-editor';

export interface Phase5DrawMetrics {
  drawCount: number;
  drawnFrame: number | null;
}

export type Phase5ReviewState =
  | { readonly ready: true; readonly editor: IEditor; readonly metrics: Phase5DrawMetrics }
  | { readonly ready: false; readonly error: string };

declare global {
  interface Window { phase5Review?: Phase5ReviewState; }
}
