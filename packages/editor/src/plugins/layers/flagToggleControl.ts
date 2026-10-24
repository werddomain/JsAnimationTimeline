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
  /** Pictogramme du bouton selon l'état. */
  readonly glyph: (pressed: boolean) => string;
  /** Libellé de l'action d'une ligne selon son état courant (« Masquer le calque »). */
  readonly rowLabel: (pressed: boolean) => string;
  /** Libellé de l'action de l'en-tête selon l'état de l'ensemble. */
  readonly headerLabel: (allPressed: boolean) => string;
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
function paintButton(button: HTMLButtonElement, pressed: boolean, label: string, glyph: string): void {
  button.textContent = glyph;
  button.setAttribute('aria-pressed', String(pressed));
  button.setAttribute('aria-label', label);
  button.title = label;
}

function createButton(host: HTMLElement, className: string, onClick: () => void): HTMLButtonElement {
  const button = host.ownerDocument.createElement('button');
  button.type = 'button';
  button.classList.add(FLAG_BUTTON_CLASSES.button, className);
  button.addEventListener('click', (event) => {
    // La ligne ne doit pas réagir (sélection, Y5) : le clic ne concerne que le drapeau.
    event.stopPropagation();
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
    paintButton(button, pressed, options.rowLabel(pressed), options.glyph(pressed));
    const inherited = options.inherited?.(row) ?? false;
    button.classList.toggle(FLAG_BUTTON_CLASSES.inherited, inherited);
    if (inherited) button.dataset.inherited = 'true';
    else delete button.dataset.inherited;
  };

  const paintHeader = (button: HTMLButtonElement): void => {
    const nodes = options.document().layers;
    const all = nodes.length > 0 && nodes.every(options.pressed);
    paintButton(button, all, options.headerLabel(all), options.glyph(all));
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
