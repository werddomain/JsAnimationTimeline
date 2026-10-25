// demo/runtime/src/validation/phase4Types.ts
/** Public inspection handle shared by the phase-4 demonstration and its browser checks. */
import type { IEditor } from '@werddomain/timeline-editor';

export type Phase4ReviewState =
  | { readonly ready: true; readonly editor: IEditor }
  | { readonly ready: false; readonly error: string };

declare global {
  interface Window {
    phase4Review?: Phase4ReviewState;
  }
}
