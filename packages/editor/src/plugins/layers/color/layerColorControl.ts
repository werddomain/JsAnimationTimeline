// packages/editor/src/plugins/layers/color/layerColorControl.ts
/**
 * Contrôle de ligne de `layers.color` : un petit carré rempli de la couleur
 * du nœud ; il ouvre un `<input type="color">` natif (caché) et envoie le
 * choix à `onPick`. `update` ne recrée rien : il repeint le carré.
 */

import type { ILayerRow, ILayerRowControl } from '../list/types';
import { normalizeLayerColor } from './layerColor';

/** Ordre du contrôle : après l'œil (10) et le cadenas (20). */
export const LAYER_COLOR_CONTROL_ORDER = 30;

/** Classes du contrôle. */
export const LAYER_COLOR_CLASSES = Object.freeze({
  wrapper: 'jt-layer-color',
  swatch: 'jt-layer-color__swatch',
  swatchEmpty: 'jt-layer-color__swatch--empty',
  input: 'jt-layer-color__input'
});

/** Textes visibles (en français). */
export const LAYER_COLOR_TEXTS = Object.freeze({
  label: 'Couleur du calque',
  none: 'aucune'
});

/** Couleur proposée au premier choix quand le nœud n'en a pas. */
const FALLBACK_COLOR = '#808080';

interface ColorCell {
  rowId: string;
  readonly swatch: HTMLButtonElement;
  readonly input: HTMLInputElement;
  readonly cleanup: () => void;
}

/** Repeint le carré et l'entrée selon la couleur de la ligne. */
function paint(cell: ColorCell, row: ILayerRow): void {
  // Le document est une donnée utilisateur : seule une couleur `#rrggbb` est peinte.
  const color = row.node.color === undefined ? undefined : normalizeLayerColor(row.node.color);
  const text = color ?? LAYER_COLOR_TEXTS.none;
  cell.rowId = row.id;
  cell.swatch.classList.toggle(LAYER_COLOR_CLASSES.swatchEmpty, color === undefined);
  if (color === undefined) cell.swatch.style.removeProperty('background-color');
  else cell.swatch.style.backgroundColor = color;
  cell.swatch.title = `${LAYER_COLOR_TEXTS.label} : ${text}`;
  cell.swatch.setAttribute('aria-label', `${LAYER_COLOR_TEXTS.label} de ${row.node.name} : ${text}`);
  cell.input.value = color ?? FALLBACK_COLOR;
}

/**
 * Contrôle de ligne `layers.color`. `onPick(id, color)` est appelé au
 * `change` de l'entrée couleur (fin du choix, pas à chaque déplacement).
 */
export function createLayerColorControl(
  id: string,
  onPick: (nodeId: string, color: string) => void
): ILayerRowControl {
  const cells = new Map<HTMLElement, ColorCell>();
  return {
    id,
    order: LAYER_COLOR_CONTROL_ORDER,
    render(row, element) {
      const doc = element.ownerDocument;
      const wrapper = doc.createElement('span');
      wrapper.classList.add(LAYER_COLOR_CLASSES.wrapper);
      const swatch = doc.createElement('button');
      swatch.type = 'button';
      swatch.classList.add(LAYER_COLOR_CLASSES.swatch);
      const input = doc.createElement('input');
      input.type = 'color';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      input.classList.add(LAYER_COLOR_CLASSES.input);
      wrapper.append(swatch, input);
      element.appendChild(wrapper);
      // Le clic ne doit pas atteindre la ligne (sélection, Y5) ni se répéter.
      const onSwatchClick = (event: Event): void => {
        event.stopPropagation();
        input.click();
      };
      const onInputClick = (event: Event): void => event.stopPropagation();
      const onChange = (): void => onPick(cell.rowId, input.value);
      swatch.addEventListener('click', onSwatchClick);
      input.addEventListener('click', onInputClick);
      input.addEventListener('change', onChange);
      const cleanup = (): void => {
        swatch.removeEventListener('click', onSwatchClick);
        input.removeEventListener('click', onInputClick);
        input.removeEventListener('change', onChange);
      };
      const cell: ColorCell = { rowId: row.id, swatch, input, cleanup };
      cells.set(element, cell);
      paint(cell, row);
    },
    update(row, element) {
      const cell = cells.get(element);
      if (cell !== undefined) paint(cell, row);
    },
    dispose(_row, element) {
      cells.get(element)?.cleanup();
      cells.delete(element);
    }
  };
}
