// packages/editor/src/plugins/layers/selection/clickIntent.ts
/**
 * Ce qu'un clic dans la liste des calques demande, d'après les touches
 * modificatrices (Cmd compte comme Ctrl). Fonction pure, sans DOM.
 */

/** Clic réduit à ce qui compte : la ligne touchée (aucune si zone vide) et les modificateurs. */
export interface ClickInput {
  readonly id: string | undefined;
  readonly ctrl: boolean;
  readonly shift: boolean;
}

/** Action demandée par un clic. */
export type ClickIntent =
  | { readonly kind: 'replace'; readonly id: string }
  | { readonly kind: 'toggle'; readonly id: string }
  | { readonly kind: 'range'; readonly from: string; readonly to: string; readonly additive: boolean }
  | { readonly kind: 'clear' };

/**
 * Action d'un clic : sur une ligne, clic seul = sélectionner seulement elle ;
 * Ctrl = inverser son état ; Maj = plage depuis l'ancre sur les lignes
 * visibles (sans ancre, comme un clic seul) ; Ctrl+Maj = plage ajoutée.
 * Dans la zone vide, un clic seul vide la sélection ; avec Ctrl ou Maj, rien
 * (on ne perd pas la sélection sur un clic raté).
 */
export function resolveClick(input: ClickInput, anchor: string | undefined): ClickIntent | undefined {
  const { id, ctrl, shift } = input;
  if (id === undefined) return ctrl || shift ? undefined : { kind: 'clear' };
  if (shift) {
    return anchor === undefined
      ? { kind: 'replace', id }
      : { kind: 'range', from: anchor, to: id, additive: ctrl };
  }
  return ctrl ? { kind: 'toggle', id } : { kind: 'replace', id };
}
