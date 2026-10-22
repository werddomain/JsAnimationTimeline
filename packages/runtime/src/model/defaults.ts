// packages/runtime/src/model/defaults.ts
/**
 * Valeurs par défaut des champs optionnels du modèle et fonctions qui les
 * appliquent (le document lui-même n'est jamais complété).
 */

import { DEFAULT_EASING, type Easing } from './easing';
import type { IFolder, LayerNode } from './layer';
import type { ISpan, PropertyTracks } from './span';

export const DEFAULT_VISIBLE = true;
export const DEFAULT_LOCKED = false;
export const DEFAULT_COLLAPSED = false;

const EMPTY_TRACKS: PropertyTracks = Object.freeze({});

export function resolveVisible(node: LayerNode): boolean {
  return node.visible ?? DEFAULT_VISIBLE;
}

export function resolveLocked(node: LayerNode): boolean {
  return node.locked ?? DEFAULT_LOCKED;
}

export function resolveCollapsed(folder: IFolder): boolean {
  return folder.collapsed ?? DEFAULT_COLLAPSED;
}

/** Easing of a span; `DEFAULT_EASING` when absent (meaningful for tweens only). */
export function resolveEasing(span: ISpan): Easing {
  return span.easing ?? DEFAULT_EASING;
}

/** Tracks of a span; a shared frozen empty object when absent. */
export function resolveTracks(span: ISpan): PropertyTracks {
  return span.tracks ?? EMPTY_TRACKS;
}
