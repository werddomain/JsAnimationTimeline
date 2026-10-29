// demo/runtime/src/validation/phase3Types.ts
/** Public inspection handle shared by the preserved demo and its Playwright checks. */
import type { IEditor } from '@kazo-ca/timeline-editor';

export type Phase3ReviewState =
  | { readonly ready: true; readonly editor: IEditor }
  | { readonly ready: false; readonly error: string };

declare global {
  interface Window {
    phase3Review?: Phase3ReviewState;
  }
}
