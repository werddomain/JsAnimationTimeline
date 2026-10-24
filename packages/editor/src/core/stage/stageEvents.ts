// packages/editor/src/core/stage/stageEvents.ts
/**
 * Événement des scènes, ajouté à `TimelineEventMap` par fusion de
 * déclarations et émis par le noyau seul : `stage:report`, un nouvel
 * avertissement d'une scène pour le document courant (cible introuvable,
 * scène inconnue, cible en double, propriété inconnue, erreur de scène).
 */

import type { IStageReport } from '@werddomain/timeline-runtime';

/** Charge utile de `stage:report`. */
export type StageReportEvent = IStageReport;

declare module '../events/TimelineEventMap' {
  interface TimelineEventMap {
    'stage:report': StageReportEvent;
  }
}
