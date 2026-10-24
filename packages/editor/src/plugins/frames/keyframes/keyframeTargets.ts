// packages/editor/src/plugins/frames/keyframes/keyframeTargets.ts
/**
 * Images visées par F5 / F6 / F7 (fonctions pures) : les images
 * sélectionnées, sinon la tête de lecture sur chaque calque sélectionné.
 * Jamais un dossier ; les calques verrouillés (eux ou un dossier parent,
 * comme `requireEditableLayer`) sont écartés, sauf si tout l'est : la
 * première cible reste alors, pour que le refus français de K1 s'affiche.
 * Dans une ligne, les images vont de droite à gauche : une insertion ou une
 * suppression ne décale pas celles qui restent à faire.
 */

import { findNodeById, flattenLayers, isLayer, resolveLocked } from '@werddomain/timeline-runtime';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { lastFrame } from '../../../model/spans/tracks';
import type { IFrameCell } from '../selection/frameSelection';

/** Sources des cibles d'une action. */
export interface IKeyframeTargetSources {
  /** Images sélectionnées (`frames.selection`). */
  readonly cells: readonly IFrameCell[];
  /** Image de la tête de lecture. */
  readonly playheadFrame: number;
  /** Calques sélectionnés (`layers.selection`), `undefined` si ce service est absent. */
  readonly layerIds: readonly string[] | undefined;
}

/** Ids des calques verrouillés, directement ou par un dossier parent. */
export function lockedLayerIds(doc: ITimelineDocument): ReadonlySet<string> {
  const locked = new Set<string>();
  flattenLayers(doc.layers).forEach(({ node, parentIds }) => {
    if (!isLayer(node)) return;
    const lockedFolder = parentIds.some((id) => {
      const folder = findNodeById(doc.layers, id);
      return folder !== undefined && resolveLocked(folder);
    });
    if (resolveLocked(node) || lockedFolder) locked.add(node.id);
  });
  return locked;
}

function layerIdsOf(doc: ITimelineDocument): ReadonlySet<string> {
  return new Set(flattenLayers(doc.layers).filter(({ node }) => isLayer(node)).map(({ node }) => node.id));
}

/** Cellules candidates : la sélection, sinon la tête de lecture sur les calques sélectionnés. */
function candidates(sources: IKeyframeTargetSources): readonly IFrameCell[] {
  if (sources.cells.length > 0) return sources.cells;
  return (sources.layerIds ?? []).map((rowId) => ({ rowId, frame: sources.playheadFrame }));
}

/** Sans doublon, calques seulement, une ligne après l'autre (ordre d'apparition), images décroissantes. */
function orderedByRow(cells: readonly IFrameCell[], layers: ReadonlySet<string>): IFrameCell[] {
  const rows = new Map<string, Set<number>>();
  cells.forEach((cell) => {
    if (!layers.has(cell.rowId)) return;
    rows.set(cell.rowId, (rows.get(cell.rowId) ?? new Set<number>()).add(cell.frame));
  });
  return Array.from(rows.entries()).flatMap(([rowId, frames]) =>
    Array.from(frames)
      .sort((a, b) => b - a)
      .map((frame) => ({ rowId, frame }))
  );
}

/** Cibles de l'action, dans l'ordre où les commandes doivent s'exécuter. */
export function keyframeTargets(doc: ITimelineDocument, sources: IKeyframeTargetSources): IFrameCell[] {
  const ordered = orderedByRow(candidates(sources), layerIdsOf(doc));
  const locked = lockedLayerIds(doc);
  const editable = ordered.filter((cell) => !locked.has(cell.rowId));
  return editable.length > 0 ? editable : ordered.slice(0, 1);
}

/**
 * Cibles de F5 : sur chaque ligne, les images après la dernière plage sont
 * réunies en une seule, la plus à droite. Insérer une image après la fin ne
 * fait que prolonger la dernière plage jusqu'à elle ; les autres images
 * au-delà de la fin seraient ensuite dans la plage et l'allongeraient
 * chacune d'une image de trop.
 */
export function insertFrameTargets(doc: ITimelineDocument, targets: readonly IFrameCell[]): IFrameCell[] {
  const seenPastEnd = new Set<string>();
  return targets.filter((cell) => {
    const node = findNodeById(doc.layers, cell.rowId);
    if (node === undefined || !isLayer(node) || cell.frame <= lastFrame(node)) return true;
    // Les cibles d'une ligne sont en images décroissantes : la première au-delà de la fin est la plus haute.
    if (seenPastEnd.has(cell.rowId)) return false;
    seenPastEnd.add(cell.rowId);
    return true;
  });
}
