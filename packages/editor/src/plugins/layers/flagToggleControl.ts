// packages/editor/src/plugins/layers/flagToggleControl.ts
/**
 * Contrôle de ligne « bouton à bascule » (œil, cadenas) et sa cellule
 * d'en-tête, partagés par `layers.visibility` et `layers.lock`. Le bouton
 * porte `aria-pressed` ; `update` met à jour l'élément existant (pas de
 * rendu complet) pour que le focus survive aux changements du document.
 *
 * L'en-tête bascule tous les nœuds de premier niveau ; son état est
 * rafraîchi par `refreshHeaders()`, que le plugin appelle à chaque document.
 */

import type { ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import type { ILayerRow, ILayerRowControl } from './list/types';
import './FlagToggle.less';

/** Réglages d'un contrôle à bascule. */
export interface IFlagToggleOptions {
  /** Identifiant du contrôle (celui du plugin). */
  readonly id: string;
  /** Position dans la ligne (voir `ILayerRowControl.order`). */
  readonly order: number;
  /** Classe du bouton, propre au contrôle (`jt-layer-flag--visibility`). */
  readonly className: string;
  /** État « enfoncé » du nœud (visible, verrouillé). */
  readonly pressed: (node: LayerNode) => boolean;
  /** Vrai si la ligne subit l'état sans le porter (verrou d'un dossier parent). */
  readonly inherited?: (row: ILayerRow) => boolean;
  /** Pictogramme du bouton selon l'état (et l'état hérité, pour une ligne). */
  readonly glyph: (pressed: boolean, inherited: boolean) => string;
  /** Libellé accessible stable d'une ligne, avec le nom du nœud (« Visibilité de « Héros » »). */
  readonly rowLabel: (node: LayerNode) => string;
  /** Action d'une ligne selon son état courant (infobulle : « Masquer le calque »). */
  readonly rowTitle: (pressed: boolean) => string;
  /** Note ajoutée au libellé et à l'infobulle d'une ligne dont l'état est hérité. */
  readonly inheritedNote?: string;
  /** Libellé accessible stable de l'en-tête (« Visibilité de tous les calques »). */
  readonly headerLabel: string;
  /** Action de l'en-tête selon l'état de l'ensemble (infobulle). */
  readonly headerTitle: (allPressed: boolean) => string;
  /** Document courant (état de l'en-tête). */
  readonly document: () => ITimelineDocument;
  /** Bascule le nœud `id` (clic sur une ligne). */
  readonly onToggle: (id: string) => void;
  /** Bascule tous les nœuds de premier niveau (clic sur l'en-tête). */
  readonly onToggleAll: () => void;
}

/** Contrôle prêt à être ajouté à `layers.list`, avec le rafraîchissement de son en-tête. */
export interface IFlagToggleControl extends ILayerRowControl {
  /** Remet à jour les boutons d'en-tête depuis le document courant. */
  readonly refreshHeaders: () => void;
}

/** Classes communes aux boutons à bascule. */
export const FLAG_BUTTON_CLASSES = Object.freeze({
  button: 'jt-layer-flag',
  header: 'jt-layer-flag--header',
  inherited: 'jt-layer-flag--inherited'
});

/** Pose l'état visuel et accessible du bouton. */
function paintButton(button: HTMLButtonElement, pressed: boolean, label: string, title: string, glyph: string): void {
  button.textContent = glyph;
  button.setAttribute('aria-pressed', String(pressed));
  button.setAttribute('aria-label', label);
  button.title = title;
}

function createButton(host: HTMLElement, className: string, onClick: () => void): HTMLButtonElement {
  const button = host.ownerDocument.createElement('button');
  button.type = 'button';
  button.classList.add(FLAG_BUTTON_CLASSES.button, className);
  // Seuls Entrée et Espace sont retenus (Entrée est le raccourci de lecture) : Ctrl+Z, flèches, clics
  // et pointeur remontent (annuler, sélection de la ligne qui reprend le focus).
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  });
  button.addEventListener('click', (event) => {
    // Le clic synthétisé par une activation au clavier (detail 0) ne doit pas atteindre la ligne :
    // la sélection y déplacerait le focus. Un vrai clic de souris remonte.
    if (event.detail === 0) event.stopPropagation();
    onClick();
  });
  host.appendChild(button);
  return button;
}

/** Crée le contrôle (bouton de ligne + cellule d'en-tête) décrit par `options`. */
export function createFlagToggleControl(options: IFlagToggleOptions): IFlagToggleControl {
  const headerButtons = new Map<HTMLElement, HTMLButtonElement>();

  const paintRow = (row: ILayerRow, element: HTMLElement): void => {
    const button = element.firstElementChild;
    if (!(button instanceof HTMLButtonElement)) return;
    const pressed = options.pressed(row.node);
    const inherited = options.inherited?.(row) ?? false;
    const note = inherited && options.inheritedNote !== undefined ? ` (${options.inheritedNote})` : '';
    paintButton(button, pressed, options.rowLabel(row.node) + note, options.rowTitle(pressed) + note, options.glyph(pressed, inherited));
    button.classList.toggle(FLAG_BUTTON_CLASSES.inherited, inherited);
    if (inherited) button.dataset.inherited = 'true';
    else delete button.dataset.inherited;
  };

  const paintHeader = (button: HTMLButtonElement): void => {
    const nodes = options.document().layers;
    const all = nodes.length > 0 && nodes.every(options.pressed);
    paintButton(button, all, options.headerLabel, options.headerTitle(all), options.glyph(all, false));
  };

  return {
    id: options.id,
    order: options.order,
    render: (row, element) => {
      createButton(element, options.className, () => options.onToggle(row.id));
      paintRow(row, element);
    },
    update: paintRow,
    renderHeader: (element) => {
      const button = createButton(element, options.className, options.onToggleAll);
      button.classList.add(FLAG_BUTTON_CLASSES.header);
      headerButtons.set(element, button);
      paintHeader(button);
    },
    disposeHeader: (element) => {
      headerButtons.delete(element);
    },
    refreshHeaders: () => headerButtons.forEach(paintHeader)
  };
}
