// packages/editor/src/core/stage/reportFeed.ts
/**
 * Fil des avertissements des scènes vers `stage:report`. Le `StageHost` du
 * runtime repart d'une liste vide à chaque document et y remet les
 * avertissements qui durent ; le fil n'émet que ceux qui sont nouveaux par
 * rapport au document précédent (même code, scène, calque et propriété). Un
 * glisser de 60 commandes sur un calque à la scène inconnue n'émet donc rien.
 *
 * Avant `editor:ready`, rien n'est émis (les plugins s'abonnent pendant leur
 * `init`) : `ready` émet alors une fois les avertissements du document
 * courant, puis le fil émet en direct.
 */

import type { IStageReport } from '@werddomain/timeline-runtime';

/** Clé d'un avertissement : code, scène, calque et propriété. */
export function reportKey(report: IStageReport): string {
  return [report.code, report.stageId ?? '', report.layerId ?? '', report.property ?? ''].join('\u0000');
}

/** Voir le commentaire du module. */
export class StageReportFeed {
  /** Avertissements déjà connus pour le document courant (émis, ou présents au document précédent). */
  private known = new Set<string>();
  private ready = false;

  constructor(private readonly emit: (report: IStageReport) => void) {}

  /** Début d'un chargement : les avertissements de `previous` qui reviennent ne sont pas émis de nouveau. */
  beginLoad(previous: readonly IStageReport[]): void {
    this.known = new Set(previous.map(reportKey));
  }

  /** Fin d'un chargement : seuls les avertissements de `current` restent connus. */
  endLoad(current: readonly IStageReport[]): void {
    this.known = new Set(current.map(reportKey));
  }

  /** Un avertissement ajouté par le `StageHost` : émis s'il est nouveau et si l'éditeur est prêt. */
  add(report: IStageReport): void {
    const key = reportKey(report);
    if (this.known.has(key)) return;
    this.known.add(key);
    if (this.ready) this.emit(report);
  }

  /** `editor:ready` : émet les avertissements de `current`, puis passe en direct. */
  start(current: readonly IStageReport[]): void {
    if (this.ready) return;
    this.ready = true;
    current.forEach((report) => this.emit(report));
  }
}
