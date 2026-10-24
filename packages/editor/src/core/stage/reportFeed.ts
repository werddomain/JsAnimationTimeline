// packages/editor/src/core/stage/reportFeed.ts
/**
 * Fil des avertissements des scènes vers `stage:report`. Le `StageHost` du
 * runtime repart d'une liste vide à chaque document et y remet les
 * avertissements qui durent ; le fil n'émet que ceux qui sont nouveaux par
 * rapport à la liste finale du document précédent (même code, scène, calque
 * et propriété), y compris ceux relevés après son chargement (erreur de
 * `render` ou de `sync`).
 *
 * Une erreur de scène, ou un avertissement envoyé par `ctx.report` pendant
 * le rendu ou la synchronisation, n'apparaît qu'à ce moment-là : quand deux
 * documents arrivent dans la même image d'affichage, le premier n'a jamais
 * été synchronisé, et sa liste ne contient pas l'avertissement du document
 * d'avant. Les clés des listes précédentes sont donc reportées de document en
 * document jusqu'à un passage complet (`sync` puis `render`) sur le document
 * courant (`completePass`). Un glisser de 60
 * commandes sur un calque à la scène inconnue, ou avec une scène dont
 * `render` ou `sync` lève, n'émet donc rien de plus, même à plusieurs
 * commandes par image.
 *
 * Avant `editor:ready`, rien n'est émis (les plugins s'abonnent pendant leur
 * `init`) : `start` émet alors une fois les avertissements du document
 * courant, puis le fil émet en direct.
 */

import type { IStageReport } from '@werddomain/timeline-runtime';

/** Clé d'un avertissement : code, scène, calque et propriété. */
export function reportKey(report: IStageReport): string {
  return [report.code, report.stageId ?? '', report.layerId ?? '', report.property ?? ''].join('\u0000');
}

/** Voir le commentaire du module. */
export class StageReportFeed {
  /** Avertissements du document précédent (liste finale, au début du chargement en cours). */
  private previous = new Set<string>();
  /** Avertissements déjà émis (ou retenus avant `start`) depuis le début du chargement en cours. */
  private seen = new Set<string>();
  /** Avertissements reportés depuis les documents précédents, jusqu'au prochain passage complet. */
  private carried = new Set<string>();
  private ready = false;

  constructor(private readonly emit: (report: IStageReport) => void) {}

  /**
   * Début d'un chargement : `previous` est la liste finale du document
   * précédent ; ses avertissements qui reviennent ne sont pas émis de nouveau,
   * ni ceux des listes reportées depuis le dernier passage complet.
   */
  beginLoad(previous: readonly IStageReport[]): void {
    previous.forEach((report) => this.carried.add(reportKey(report)));
    this.previous = new Set([...previous.map(reportKey), ...this.carried]);
    this.seen = new Set();
  }

  /** Un `sync` puis un `render` ont eu lieu sur le document courant : les listes précédentes ne sont plus reportées. */
  completePass(): void {
    this.carried = new Set();
  }

  /** Un avertissement ajouté par le `StageHost` : émis s'il est nouveau et si l'éditeur est prêt. */
  add(report: IStageReport): void {
    const key = reportKey(report);
    if (this.previous.has(key) || this.seen.has(key)) return;
    this.seen.add(key);
    if (this.ready) this.emit(report);
  }

  /** `editor:ready` : émet les avertissements de `current`, puis passe en direct. */
  start(current: readonly IStageReport[]): void {
    if (this.ready) return;
    this.ready = true;
    current.forEach((report) => this.emit(report));
  }
}
