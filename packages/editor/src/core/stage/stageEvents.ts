// packages/editor/src/core/stage/stageEvents.ts
/**
 * Événements des scènes, ajoutés à `TimelineEventMap` par fusion de
 * déclarations et émis par le noyau seul :
 * - `stage:report` : un nouvel avertissement d'une scène pour le document
 *   courant (cible introuvable, scène inconnue, cible en double, propriété
 *   inconnue, erreur de scène) ;
 * - `stage:targetsChanged` : la liste des cibles manquantes a changé (après
 *   un document, `refreshTargets`, ou un changement signalé par
 *   `targets.subscribe` d'une scène).
 */

import type { IStageReport } from '@kazo-ca/timeline-runtime';

/** Charge utile de `stage:report`. */
export type StageReportEvent = IStageReport;

/** Charge utile de `stage:targetsChanged`. */
export interface StageTargetsChangedEvent {
  /** Nouvelle liste des calques sans objet animé (`ctx.stage.missingTargets`). */
  readonly missingTargets: readonly string[];
}

declare module '../events/TimelineEventMap' {
  interface TimelineEventMap {
    'stage:report': StageReportEvent;
    'stage:targetsChanged': StageTargetsChangedEvent;
  }
}
