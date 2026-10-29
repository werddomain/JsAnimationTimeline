// packages/editor/src/plugins/layers/target/targetAlert.ts
/**
 * Alerte de cible manquante d'un calque, déduite de l'état des scènes
 * (`ctx.stage`) et jamais des événements `stage:report` :
 * - aucune alerte sans scène (`stage: false`, timeline seule) ;
 * - aucune alerte pour un calque sans cible (il n'anime encore rien : ce
 *   n'est pas une cible perdue) ;
 * - sinon, alerte si le calque est dans `missingTargets`, avec la raison
 *   tirée des avertissements de ce calque : aucune scène ne l'accepte, scène
 *   inconnue, erreur de la scène (son `resolve` a levé), ou objet introuvable.
 */

import { StageReportCodes } from '@kazo-ca/timeline-runtime';
import type { IStageReport, LayerTarget } from '@kazo-ca/timeline-runtime';

/** Ce que l'alerte lit des scènes (sous-ensemble de `IEditorStage`). */
export interface ITargetAlertSource {
  readonly stages: readonly { readonly id: string }[];
  readonly missingTargets: readonly string[];
  readonly warnings: readonly IStageReport[];
}

/** Raison d'une cible manquante. */
export type TargetAlertReason = 'unrouted' | 'unknown-stage' | 'stage-error' | 'not-found';

/** Alerte d'un calque : `missing` faux et libellé vide quand tout va bien. */
export interface ITargetAlert {
  readonly missing: boolean;
  readonly reason: TargetAlertReason | null;
  readonly label: string;
}

/** Libellés des alertes (infobulle et libellé accessible du bouton). */
export const TargetAlertLabels = Object.freeze({
  unrouted: 'Cible introuvable : aucune scène ne la prend en charge',
  unknownStage: (stageId: string): string => `Cible introuvable : la scène « ${stageId} » n'existe pas`,
  stageError: 'Cible introuvable : la scène a signalé une erreur',
  notFound: 'Cible introuvable sur la scène'
});

const NO_ALERT: ITargetAlert = Object.freeze({ missing: false, reason: null, label: '' });

/** Alerte du calque `layerId` dont la cible est `target`. */
export function computeTargetAlert(
  source: ITargetAlertSource,
  layerId: string,
  target: LayerTarget | undefined
): ITargetAlert {
  if (source.stages.length === 0 || target === undefined || !source.missingTargets.includes(layerId)) return NO_ALERT;
  const warning = source.warnings.find((report) =>
    report.layerId === layerId &&
    (report.code === StageReportCodes.UNROUTED || report.code === StageReportCodes.UNKNOWN_STAGE ||
      report.code === StageReportCodes.STAGE_ERROR));
  if (warning?.code === StageReportCodes.UNROUTED) {
    return Object.freeze({ missing: true, reason: 'unrouted', label: TargetAlertLabels.unrouted });
  }
  if (warning?.code === StageReportCodes.UNKNOWN_STAGE) {
    const label = TargetAlertLabels.unknownStage(warning.stageId ?? '');
    return Object.freeze({ missing: true, reason: 'unknown-stage', label });
  }
  if (warning?.code === StageReportCodes.STAGE_ERROR) {
    return Object.freeze({ missing: true, reason: 'stage-error', label: TargetAlertLabels.stageError });
  }
  return Object.freeze({ missing: true, reason: 'not-found', label: TargetAlertLabels.notFound });
}
