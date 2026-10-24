// packages/editor/src/plugins/tweens/motion/motionTweenCommands.ts
/**
 * Commandes annulables sur les interpolations de mouvement, liées à un
 * registre de propriétés : `createMotionTweenCommands(ctx.registry)`. Chaque
 * commande :
 * - applique l'opération pure au document courant (`do`) ;
 * - refuse (`CommandRefusedError`, donc `command:refused`) un calque
 *   verrouillé (lui ou un dossier parent), une cible invalide, etc., avec le
 *   message français de l'erreur ;
 * - mémorise les calques d'avant pour que `undo` les restaure tels quels ;
 *   `do` à nouveau (rétablir) recalcule et remémorise.
 *
 * `undo` ne vérifie pas le verrou : annuler restaure l'état d'avant la
 * commande, même si un calque a été verrouillé entre-temps. Un nouveau `do`
 * (rétablir) sur un calque verrouillé est refusé. La suppression sur
 * plusieurs calques est une seule commande, donc une seule entrée
 * d'historique, refusée en bloc si un des calques est verrouillé.
 */

import type { ILayer, ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import type { ICommand } from '../../../core/commands/ICommand';
import { findLayer, replaceLayer } from '../../../model/spans/layerAccess';
import { createMotionTweenBetween, createMotionTweenFromSpan } from './createMotionTween';
import { refusalReason } from './MotionTweenError';
import { removeMotionTweens } from './removeMotionTween';
import type { IRemoveTarget } from './removeMotionTween';

/** Libellés des commandes (historique annuler / rétablir). */
export const MotionTweenCommandLabels = {
  CREATE: 'Créer une interpolation de mouvement',
  REMOVE: "Supprimer l'interpolation"
} as const;

/** Genre de commande, pour `refused`. */
export type MotionTweenCommandKind = 'create' | 'remove';

/** Fabrique des commandes d'interpolation, liées à un registre de propriétés. */
export interface IMotionTweenCommands {
  /** Transforme en interpolation la plage qui contient `frame`. */
  createFromSpan(layerId: string, frame: number): ICommand;
  /** Fusionne les plages de [from, to - 1] en une interpolation (images clés `from` et `to`). */
  createBetween(layerId: string, from: number, to: number): ICommand;
  /** Supprime les interpolations désignées (un ou plusieurs calques, une seule entrée d'historique). */
  remove(targets: readonly IRemoveTarget[]): ICommand;
  /** Commande qui refuse toujours avec `reason` (sélection invalide : le refus passe par `command:refused`). */
  refused(kind: MotionTweenCommandKind, reason: string): ICommand;
}

type Operation = (doc: ITimelineDocument) => ITimelineDocument;

function run(label: string, operation: Operation, doc: ITimelineDocument): ITimelineDocument {
  try {
    return operation(doc);
  } catch (error) {
    const reason = refusalReason(error);
    if (reason !== undefined) throw new CommandRefusedError(label, reason);
    throw error;
  }
}

/** Commande d'une opération sur les calques `layerIds`. */
function createLayersCommand(label: string, layerIds: readonly string[], operation: Operation): ICommand {
  // Remplacé à chaque `do` effectif : `undo` restaure l'état d'avant le dernier `do`.
  let snapshot: readonly ILayer[] = [];
  return Object.freeze({
    label,
    do: (doc: ITimelineDocument): ITimelineDocument => {
      snapshot = [];
      const next = run(label, operation, doc);
      if (next !== doc) snapshot = layerIds.flatMap((id) => findLayer(doc, id) ?? []);
      return next;
    },
    undo: (doc: ITimelineDocument): ITimelineDocument => snapshot.reduce(replaceLayer, doc)
  });
}

function removeAll(targets: readonly IRemoveTarget[], registry: PropertyRegistry): Operation {
  return (doc) => targets.reduce((current, target) => removeMotionTweens(current, target.layerId, target.frames, registry), doc);
}

/**
 * Commandes d'interpolation qui évaluent les valeurs avec `registry` (le
 * registre de l'éditeur, jamais `defaultPropertyRegistry` implicitement).
 */
export function createMotionTweenCommands(registry: PropertyRegistry): IMotionTweenCommands {
  const labels = MotionTweenCommandLabels;
  return Object.freeze({
    createFromSpan: (layerId: string, frame: number) =>
      createLayersCommand(labels.CREATE, [layerId], (doc) => createMotionTweenFromSpan(doc, layerId, frame)),
    createBetween: (layerId: string, from: number, to: number) =>
      createLayersCommand(labels.CREATE, [layerId], (doc) => createMotionTweenBetween(doc, layerId, from, to, registry)),
    remove: (targets: readonly IRemoveTarget[]) =>
      createLayersCommand(
        labels.REMOVE,
        targets.map((target) => target.layerId),
        removeAll(targets, registry)
      ),
    refused: (kind: MotionTweenCommandKind, reason: string) => {
      const label = kind === 'create' ? labels.CREATE : labels.REMOVE;
      return createLayersCommand(label, [], () => {
        throw new CommandRefusedError(label, reason);
      });
    }
  });
}
