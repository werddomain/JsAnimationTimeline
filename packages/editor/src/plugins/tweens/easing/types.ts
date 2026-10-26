// packages/editor/src/plugins/tweens/easing/types.ts
import type { Easing } from '@werddomain/timeline-runtime';

/** Availability with a French refusal reason when the target cannot be edited. */
export interface IEasingAvailability { readonly enabled: boolean; readonly reason?: string; }

/** Span-wide easing and preset dialog API. Unchanged choices return false. */
export interface IEasingService {
  canSetAt(layerId: string, frame: number): IEasingAvailability;
  setAt(layerId: string, frame: number, easing: Easing): boolean;
  openAt(layerId: string, frame: number): boolean;
  close(): void;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap { 'tweens.easing': IEasingService; }
}
