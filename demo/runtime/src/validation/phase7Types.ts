// demo/runtime/src/validation/phase7Types.ts
/** Typed inspection handle shared by the validation page and its browser tests. */
import type { IExportCssWarning } from '@kazo-ca/timeline-export-css';

export type Phase7Selector = '#logo' | '#logo-mark' | '#ball';

export interface IPhase7RenderedState {
  readonly tx: number;
  readonly ty: number;
  readonly linear: readonly [number, number, number, number];
  readonly opacity: number;
  readonly visibility: string;
}

export interface IPhase7Snapshot {
  readonly frame: number;
  readonly runtime: Readonly<Record<Phase7Selector, IPhase7RenderedState>>;
  readonly css: Readonly<Record<Phase7Selector, IPhase7RenderedState>>;
}

export interface IPhase7Ready {
  readonly ready: true;
  seek(frame: number): Promise<void>;
  snapshot(): IPhase7Snapshot;
  readonly warnings: readonly IExportCssWarning[];
  readonly warningExamples: readonly IExportCssWarning[];
  readonly animationCount: number;
}

export type Phase7Review = IPhase7Ready | { readonly ready: false; readonly error: string };

declare global {
  interface Window {
    phase7Review?: Phase7Review;
  }
}
