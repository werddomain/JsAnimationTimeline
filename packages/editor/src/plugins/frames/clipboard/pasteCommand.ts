// packages/editor/src/plugins/frames/clipboard/pasteCommand.ts
/**
 * Commande de collage : une sous-commande par ligne (sur le modèle de
 * `model/spans/spanCommands.ts`), regroupées dans une `CompositeCommand`, donc
 * UNE entrée d'historique « Coller des images ».
 *
 * Chaque sous-commande mémorise le calque d'avant (et `totalFrames` si le
 * collage l'a changé) pour que `undo` le restaure tel quel. Si une ligne est
 * refusée (calque verrouillé...), la `CommandRefusedError` remonte : tout le
 * collage est refusé et le document reste inchangé (il est immuable).
 *
 * Suite possible (K1) : exporter `createSpanCommand` de `spanCommands.ts` pour
 * ne plus recopier `run`, `snapshotOf` et `restore`.
 */

import type { ILayer, ITimelineDocument, PropertyRegistry } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import { CompositeCommand } from '../../../core/commands/CompositeCommand';
import type { ICommand } from '../../../core/commands/ICommand';
import { findLayer, replaceLayer } from '../../../model/spans/layerAccess';
import { SpanOperationError } from '../../../model/spans/SpanOperationError';
import { pasteSpans } from './clipboardOps';
import type { PastedRun } from './clipboardOps';

/** Libellé du collage (historique annuler / rétablir). */
export const PASTE_COMMAND_LABEL = 'Coller des images';

/** Une suite à coller, première image à `at`. */
export interface IPasteRun {
  readonly at: number;
  readonly run: PastedRun;
}

/** Les suites à coller sur un calque. */
export interface IPastePlacement {
  readonly layerId: string;
  readonly runs: readonly IPasteRun[];
}

/** État restauré par `undo`. */
interface IUndoSnapshot {
  readonly layer: ILayer;
  /** `undefined` quand le collage n'a pas changé la durée du document. */
  readonly totalFrames: number | undefined;
}

function snapshotOf(doc: ITimelineDocument, next: ITimelineDocument, layerId: string): IUndoSnapshot | undefined {
  const layer = findLayer(doc, layerId);
  if (layer === undefined) return undefined;
  const { totalFrames } = doc.settings;
  return { layer, totalFrames: next.settings.totalFrames === totalFrames ? undefined : totalFrames };
}

function restore(doc: ITimelineDocument, snapshot: IUndoSnapshot | undefined): ITimelineDocument {
  if (snapshot === undefined) return doc;
  const restored = replaceLayer(doc, snapshot.layer);
  const { totalFrames } = snapshot;
  if (totalFrames === undefined) return restored;
  return { ...restored, settings: { ...restored.settings, totalFrames } };
}

function applyRuns(
  doc: ITimelineDocument,
  placement: IPastePlacement,
  registry: PropertyRegistry
): ITimelineDocument {
  try {
    return placement.runs.reduce((current, { at, run }) => pasteSpans(current, placement.layerId, at, run, registry), doc);
  } catch (error) {
    if (error instanceof SpanOperationError) throw new CommandRefusedError(PASTE_COMMAND_LABEL, error.message);
    throw error;
  }
}

function createRowCommand(placement: IPastePlacement, registry: PropertyRegistry): ICommand {
  // Remplacé à chaque `do` : `undo` restaure l'état d'avant le dernier `do`.
  let snapshot: IUndoSnapshot | undefined;
  return Object.freeze({
    label: PASTE_COMMAND_LABEL,
    do: (doc: ITimelineDocument): ITimelineDocument => {
      snapshot = undefined;
      const next = applyRuns(doc, placement, registry);
      if (next !== doc) snapshot = snapshotOf(doc, next, placement.layerId);
      return next;
    },
    undo: (doc: ITimelineDocument): ITimelineDocument => restore(doc, snapshot)
  });
}

/** Commande qui colle `placements` (une sous-commande par ligne) comme une seule entrée d'historique. */
export function createPasteCommand(placements: readonly IPastePlacement[], registry: PropertyRegistry): ICommand {
  return new CompositeCommand(
    PASTE_COMMAND_LABEL,
    placements.map((placement) => createRowCommand(placement, registry))
  );
}
