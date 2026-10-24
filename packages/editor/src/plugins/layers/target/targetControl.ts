// packages/editor/src/plugins/layers/target/targetControl.ts
/**
 * Contrôle de ligne de `layers.target` : un bouton par calque (rien sur un
 * dossier, qui n'a pas de cible). Le bouton dit la cible (libellé de la
 * scène, sinon le sélecteur ou la ref) et porte l'alerte de cible manquante
 * (classe `jt-layer-target--missing`, raison dans l'infobulle et le libellé
 * accessible). Un clic ouvre ou ferme la fenêtre de choix.
 *
 * `update` repeint l'élément existant (le focus survit aux changements du
 * document) ; le plugin repeint aussi toutes les lignes quand les cibles
 * manquantes changent (`stage:targetsChanged`).
 */

import { isLayer } from '@werddomain/timeline-runtime';
import type { LayerTarget } from '@werddomain/timeline-runtime';
import type { ILayerRow, ILayerRowControl } from '../list/types';
import type { ITargetAlert } from './targetAlert';

/** Classes du bouton de cible. */
export const TARGET_BUTTON_CLASSES = Object.freeze({
  button: 'jt-layer-target',
  missing: 'jt-layer-target--missing'
});

/** Pictogrammes du bouton : cible trouvée (ou absente), cible manquante. */
const GLYPHS = Object.freeze({ normal: '◎', missing: '⚠' });

/** Ce que le contrôle demande au plugin. */
export interface ITargetControlOptions {
  readonly id: string;
  readonly order: number;
  /** Texte de la cible d'un calque (« aucune cible » s'il n'en a pas). */
  readonly describe: (target: LayerTarget | undefined) => string;
  /** Alerte du calque `id`. */
  readonly alertOf: (id: string) => ITargetAlert;
  /** Clic sur le bouton de la ligne `id`. */
  readonly onActivate: (id: string, button: HTMLButtonElement) => void;
  /** La ligne `id` disparaît (calque supprimé, dossier replié, contrôle retiré). */
  readonly onDispose: (id: string) => void;
}

/** Contrôle de ligne, avec l'accès aux boutons pour les repeindre. */
export interface ITargetControl extends ILayerRowControl {
  /** Bouton de la ligne `id`, ou `undefined`. */
  readonly button: (id: string) => HTMLButtonElement | undefined;
  /** Repeint toutes les lignes affichées. */
  readonly repaintAll: () => void;
}

/** Crée le contrôle de ligne décrit par `options`. */
export function createTargetControl(options: ITargetControlOptions): ITargetControl {
  const rows = new Map<string, { row: ILayerRow; button: HTMLButtonElement }>();

  const paint = (row: ILayerRow, button: HTMLButtonElement): void => {
    if (!isLayer(row.node)) return;
    const alert = options.alertOf(row.id);
    const description = options.describe(row.node.target);
    const label = `Cible de « ${row.node.name} » : ${description}`;
    button.textContent = alert.missing ? GLYPHS.missing : GLYPHS.normal;
    button.classList.toggle(TARGET_BUTTON_CLASSES.missing, alert.missing);
    button.setAttribute('aria-label', alert.missing ? `${label}. ${alert.label}` : label);
    button.title = alert.missing ? `${description}\n${alert.label}` : description;
  };

  const render = (row: ILayerRow, element: HTMLElement): void => {
    if (!isLayer(row.node)) return;
    const button = element.ownerDocument.createElement('button');
    button.type = 'button';
    button.classList.add(TARGET_BUTTON_CLASSES.button);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    // Comme les boutons à bascule : seuls Entrée et Espace sont retenus (Entrée est le raccourci de lecture) ;
    // Ctrl+Z, flèches, raccourcis, pointeur et vrais clics remontent (la ligne se sélectionne).
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
      // Le clic d'une activation au clavier (detail 0) ne doit pas atteindre la ligne, qui prendrait le focus.
      if (event.detail === 0) event.stopPropagation();
      options.onActivate(row.id, button);
    });
    element.appendChild(button);
    rows.set(row.id, { row, button });
    paint(row, button);
  };

  return {
    id: options.id,
    order: options.order,
    render,
    update: (row, element) => {
      const entry = rows.get(row.id);
      if (entry === undefined) {
        // La ligne n'avait pas encore de bouton (elle vient de devenir un calque).
        element.replaceChildren();
        render(row, element);
        return;
      }
      rows.set(row.id, { row, button: entry.button });
      paint(row, entry.button);
    },
    dispose: (row) => {
      rows.delete(row.id);
      options.onDispose(row.id);
    },
    button: (id) => rows.get(id)?.button,
    repaintAll: () => rows.forEach(({ row, button }) => paint(row, button))
  };
}
