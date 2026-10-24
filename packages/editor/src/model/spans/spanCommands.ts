// packages/editor/src/model/spans/spanCommands.ts
/**
 * Opérations de plage sous forme de commandes annulables, liées à un
 * registre de propriétés : `createSpanCommands(registry)` (C6 passera
 * `ctx.registry`). Chaque commande :
 * - applique l'opération pure au document courant (`do`) ;
 * - refuse (`CommandRefusedError`, donc `command:refused`) un calque
 *   verrouillé, introuvable ou une image hors limites, avec le message
 *   français de la `SpanOperationError` ;
 * - mémorise le calque d'avant (et `totalFrames` si l'opération l'a changé)
 *   pour que `undo` le restaure tel quel ; `do` à nouveau (rétablir)
 *   recalcule et remémorise.
 *
 * `undo` ne vérifie pas le verrou : annuler restaure l'état d'avant la
 * commande, même si le calque a été verrouillé entre-temps. Un nouveau `do`
 * (rétablir) sur un calque verrouillé est refusé.
 */

import type { ILayer, ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../core/commands/CommandRefusedError';
import type { ICommand } from '../../core/commands/ICommand';
import { deleteKeyframe } from './deleteKeyframe';
import { insertFrame, removeFrame } from './frames';
import { insertBlankKeyframe, insertKeyframe } from './insertKeyframe';
import { findLayer, replaceLayer } from './layerAccess';
import { moveKeyframe } from './moveKeyframe';
import { SpanOperationError } from './SpanOperationError';

/** Libellés des commandes (historique annuler / rétablir). */
export const SpanCommandLabels = {
  INSERT_KEYFRAME: 'Insérer une image clé',
  INSERT_BLANK_KEYFRAME: 'Insérer une image clé vide',
  DELETE_KEYFRAME: "Effacer l'image clé",
  INSERT_FRAME: 'Insérer une image',
  REMOVE_FRAME: 'Supprimer une image',
  MOVE_KEYFRAME: "Déplacer l'image clé"
} as const;

/** Fabrique des commandes de plage, liées à un registre de propriétés. */
export interface ISpanCommands {
  /** F6 : image clé à `frame` (valeurs interpolées dans une interpolation). */
  insertKeyframe(layerId: string, frame: number): ICommand;
  /** F7 : image clé vide à `frame`. */
  insertBlankKeyframe(layerId: string, frame: number): ICommand;
  /** Maj+F6 : efface l'image clé à `frame` (fusion avec la plage précédente). */
  deleteKeyframe(layerId: string, frame: number): ICommand;
  /** F5 : insère une image à `frame`. */
  insertFrame(layerId: string, frame: number): ICommand;
  /** Maj+F5 : supprime l'image `frame`. */
  removeFrame(layerId: string, frame: number): ICommand;
  /** Glisser : déplace l'image clé de `from` à `to`. */
  moveKeyframe(layerId: string, from: number, to: number): ICommand;
}

/** État restauré par `undo`. */
interface IUndoSnapshot {
  readonly layer: ILayer;
  /** `undefined` quand l'opération n'a pas changé la durée du document. */
  readonly totalFrames: number | undefined;
}

type Operation = (doc: ITimelineDocument) => ITimelineDocument;

function run(label: string, operation: Operation, doc: ITimelineDocument): ITimelineDocument {
  try {
    return operation(doc);
  } catch (error) {
    if (error instanceof SpanOperationError) throw new CommandRefusedError(label, error.message);
    throw error;
  }
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

/** Commande d'une opération de plage sur le calque `layerId`. */
function createSpanCommand(label: string, layerId: string, operation: Operation): ICommand {
  // Remplacé à chaque `do` effectif : `undo` restaure l'état d'avant le dernier `do`.
  let snapshot: IUndoSnapshot | undefined;
  return Object.freeze({
    label,
    do: (doc: ITimelineDocument): ITimelineDocument => {
      const next = run(label, operation, doc);
      if (next !== doc) snapshot = snapshotOf(doc, next, layerId);
      return next;
    },
    undo: (doc: ITimelineDocument): ITimelineDocument => restore(doc, snapshot)
  });
}

/**
 * Commandes de plage qui évaluent les valeurs avec `registry` (le registre
 * de l'éditeur, jamais `defaultPropertyRegistry` implicitement).
 */
export function createSpanCommands(registry: PropertyRegistry): ISpanCommands {
  const labels = SpanCommandLabels;
  return Object.freeze({
    insertKeyframe: (layerId: string, frame: number) =>
      createSpanCommand(labels.INSERT_KEYFRAME, layerId, (doc) => insertKeyframe(doc, layerId, frame, registry)),
    insertBlankKeyframe: (layerId: string, frame: number) =>
      createSpanCommand(labels.INSERT_BLANK_KEYFRAME, layerId, (doc) => insertBlankKeyframe(doc, layerId, frame, registry)),
    deleteKeyframe: (layerId: string, frame: number) =>
      createSpanCommand(labels.DELETE_KEYFRAME, layerId, (doc) => deleteKeyframe(doc, layerId, frame)),
    insertFrame: (layerId: string, frame: number) =>
      createSpanCommand(labels.INSERT_FRAME, layerId, (doc) => insertFrame(doc, layerId, frame)),
    removeFrame: (layerId: string, frame: number) =>
      createSpanCommand(labels.REMOVE_FRAME, layerId, (doc) => removeFrame(doc, layerId, frame)),
    moveKeyframe: (layerId: string, from: number, to: number) =>
      createSpanCommand(labels.MOVE_KEYFRAME, layerId, (doc) => moveKeyframe(doc, layerId, from, to))
  });
}
