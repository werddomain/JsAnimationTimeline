// packages/editor/src/plugins/toolbar/timeSettings/timeSettingsCommands.ts
/**
 * Commandes annulables de la cadence (`settings.fps`) et de la durée
 * (`settings.totalFrames`) du document, et leurs contrôles :
 * - la cadence est un entier de `MIN_FPS` à `MAX_FPS` ;
 * - la durée est un entier de `MIN_TOTAL_FRAMES` à `maxTotalFrames(doc)`
 *   images (`MAX_TOTAL_FRAMES`, ou la durée du document si un document
 *   chargé la dépasse déjà), et jamais plus courte que la dernière image
 *   utilisée par une plage : raccourcir la timeline sous la fin d'une plage
 *   est refusé avec un message clair.
 *
 * Un refus lève une `CommandRefusedError` dans `do` (donc `command:refused`) :
 * l'API respecte les mêmes règles que les champs de la barre d'outils.
 * Chaque commande mémorise la valeur d'avant dans `do` pour que `undo` la
 * restaure ; `do` à nouveau (rétablir) revérifie et remémorise.
 */

import { isLayer, walkLayers } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, ITimelineSettings } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import type { ICommand } from '../../../core/commands/ICommand';

/** Cadence minimale, en images par seconde. */
export const MIN_FPS = 1;

/** Cadence maximale, en images par seconde. */
export const MAX_FPS = 240;

/** Durée minimale, en images. */
export const MIN_TOTAL_FRAMES = 1;

/**
 * Durée maximale, en images : 100 000 images, soit environ 7 minutes à
 * 240 images/s ou plus d'une heure à 24 images/s.
 */
export const MAX_TOTAL_FRAMES = 100_000;

/** Nombre entier écrit à la française (`100000` -> `100 000`, espace insécable). */
function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/** Libellés des commandes (historique annuler / rétablir). */
export const TimeSettingsLabels = {
  SET_FPS: 'Modifier la cadence',
  SET_TOTAL_FRAMES: 'Modifier la durée'
} as const;

/** Dernière image utilisée par une plage, et le calque qui l'utilise. */
export interface ILastUsedFrame {
  readonly frame: number;
  readonly layerName: string;
}

/**
 * Durée maximale acceptée pour `doc` : `MAX_TOTAL_FRAMES`, ou la durée
 * actuelle du document si elle est plus grande. Le schéma du document n'a
 * pas de maximum : un document chargé peut dépasser `MAX_TOTAL_FRAMES`, et
 * on peut alors le raccourcir sans être obligé de passer sous ce maximum
 * (ce qui serait impossible si une plage finit au-delà).
 */
export function maxTotalFrames(doc: ITimelineDocument): number {
  return Math.max(MAX_TOTAL_FRAMES, doc.settings.totalFrames);
}

/** Message d'une cadence invalide, ou `undefined` si `fps` est accepté. */
export function fpsError(fps: number): string | undefined {
  if (Number.isInteger(fps) && fps >= MIN_FPS && fps <= MAX_FPS) return undefined;
  return `La cadence doit être un nombre entier de ${MIN_FPS} à ${MAX_FPS} images par seconde.`;
}

/**
 * Message d'une durée refusée pour `doc`, ou `undefined` si `totalFrames`
 * est accepté : entier de 1 à `maxTotalFrames(doc)`, pas plus court que la
 * fin de la dernière plage.
 */
export function totalFramesError(doc: ITimelineDocument, totalFrames: number): string | undefined {
  const max = maxTotalFrames(doc);
  if (!Number.isInteger(totalFrames) || totalFrames < MIN_TOTAL_FRAMES || totalFrames > max) {
    return `La durée doit être un nombre entier de ${MIN_TOTAL_FRAMES} à ${formatCount(max)} images.`;
  }
  const last = lastUsedFrame(doc);
  if (last === undefined || totalFrames >= last.frame) return undefined;
  return (
    `La durée ne peut pas être inférieure à ${last.frame} images : ` +
    `une plage du calque « ${last.layerName} » se termine à l'image ${last.frame}.`
  );
}

/** Dernière image utilisée par une plage (dossiers compris), ou `undefined` sans plage. */
export function lastUsedFrame(doc: ITimelineDocument): ILastUsedFrame | undefined {
  let last: ILastUsedFrame | undefined;
  walkLayers(doc.layers, ({ node }) => {
    if (!isLayer(node)) return;
    node.spans.forEach((span) => {
      if (last === undefined || span.end > last.frame) last = { frame: span.end, layerName: node.name };
    });
  });
  return last;
}

function withSettings(doc: ITimelineDocument, settings: Partial<ITimelineSettings>): ITimelineDocument {
  return { ...doc, settings: { ...doc.settings, ...settings } };
}

/**
 * Commande qui règle une valeur de `settings` : refuse avec `check`, ne
 * change rien si la valeur est déjà en place, mémorise l'ancienne valeur.
 */
function createSettingCommand(
  label: string,
  key: keyof ITimelineSettings,
  value: number,
  check: (doc: ITimelineDocument) => string | undefined
): ICommand {
  let previous: number | undefined;
  return Object.freeze({
    label,
    do: (doc: ITimelineDocument) => {
      const reason = check(doc);
      if (reason !== undefined) throw new CommandRefusedError(label, reason);
      previous = doc.settings[key];
      return previous === value ? doc : withSettings(doc, { [key]: value });
    },
    undo: (doc: ITimelineDocument) =>
      previous === undefined || previous === doc.settings[key] ? doc : withSettings(doc, { [key]: previous })
  });
}

/** Commande « Modifier la cadence » : `settings.fps` = `fps` (entier de 1 à 240). */
export function createSetFpsCommand(fps: number): ICommand {
  return createSettingCommand(TimeSettingsLabels.SET_FPS, 'fps', fps, () => fpsError(fps));
}

/**
 * Commande « Modifier la durée » : `settings.totalFrames` = `totalFrames`
 * (entier de 1 à `maxTotalFrames(doc)`, pas plus court que la fin de la
 * dernière plage).
 */
export function createSetTotalFramesCommand(totalFrames: number): ICommand {
  return createSettingCommand(TimeSettingsLabels.SET_TOTAL_FRAMES, 'totalFrames', totalFrames, (doc) =>
    totalFramesError(doc, totalFrames)
  );
}
