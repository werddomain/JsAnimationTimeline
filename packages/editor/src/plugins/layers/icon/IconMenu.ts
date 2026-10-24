// packages/editor/src/plugins/layers/icon/IconMenu.ts
/**
 * Menu de choix d'icône : une boîte `role="dialog"` rendue dans le conteneur
 * de l'éditeur, ancrée sous l'icône cliquée et ramenée dans la fenêtre. Elle
 * contient la liste `role="menu"` des entrées et, dans un groupe frère, la
 * saisie de « Personnalisée… » (validée par `validateLayerIcon`).
 *
 * Fermeture : Échap, Tab, choix (le focus revient où il était), clic ou
 * focus à l'extérieur (le focus n'est pas rendu). Les flèches, Début et Fin
 * déplacent le focus. Toute touche pressée dans le menu est arrêtée pour que
 * les raccourcis de l'éditeur ne la voient pas.
 */

import { BUILTIN_LAYER_ICONS } from '../list/layerIcon';
import { validateLayerIcon } from './iconCommand';
import { LAYER_ICON_TEXTS, builtinIconLabel } from './iconChoices';
import type { IconChoice } from './iconChoices';
import { clampMenuPosition } from './menuPosition';

/** Classes du menu. */
export const ICON_MENU_CLASSES = Object.freeze({
  menu: 'jt-icon-menu',
  list: 'jt-icon-menu__list',
  item: 'jt-icon-menu__item',
  glyph: 'jt-icon-menu__glyph',
  custom: 'jt-icon-menu__custom',
  input: 'jt-icon-menu__input',
  error: 'jt-icon-menu__error'
});

/** Rappels et réglages du menu. */
export interface IconMenuHandlers {
  /** Choix fait : `undefined` pour l'icône par défaut. Le menu se ferme ensuite. */
  readonly onPick: (icon: string | undefined) => void;
  /** Fermeture du menu (quelle qu'en soit la cause), appelée une seule fois. */
  readonly onClose: () => void;
  /** Élément qui reprend le focus à la fermeture par choix, Échap ou Tab. */
  readonly returnFocus?: HTMLElement;
  /** Vrai pour une cible dont le mousedown ne doit pas fermer le menu (l'icône d'ancrage). */
  readonly ignoreOutside?: (target: Node) => boolean;
  /** Valeur de la saisie personnalisée à préremplir (icône personnalisée actuelle). */
  readonly customValue?: string;
}

function choiceLabel(choice: IconChoice): string {
  if (choice.kind === 'default') return LAYER_ICON_TEXTS.defaultIcon;
  if (choice.kind === 'custom') return LAYER_ICON_TEXTS.custom;
  return builtinIconLabel(choice.icon);
}

/** Un menu d'icônes ouvert ; `close()` le retire et libère ses écouteurs. */
export class IconMenu {
  readonly element: HTMLElement;
  private readonly doc: Document;
  private readonly items: HTMLButtonElement[] = [];
  private readonly custom: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly error: HTMLElement;
  private readonly anchor: DOMRect | undefined;
  private closed = false;

  constructor(
    container: HTMLElement,
    choices: readonly IconChoice[],
    anchor: DOMRect | undefined,
    private readonly handlers: IconMenuHandlers
  ) {
    this.doc = container.ownerDocument;
    const box = this.doc.createElement('div');
    box.classList.add(ICON_MENU_CLASSES.menu);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', LAYER_ICON_TEXTS.dialogLabel);
    const list = this.doc.createElement('div');
    list.classList.add(ICON_MENU_CLASSES.list);
    list.setAttribute('role', 'menu');
    list.setAttribute('aria-label', LAYER_ICON_TEXTS.menuLabel);
    choices.forEach((choice) => this.addItem(list, choice));
    this.custom = this.doc.createElement('div');
    this.input = this.doc.createElement('input');
    this.error = this.doc.createElement('p');
    this.buildCustom();
    box.append(list, this.custom);
    this.element = box;
    box.addEventListener('keydown', this.onKeyDown);
    box.addEventListener('focusout', this.onFocusOut);
    box.addEventListener('mousedown', this.onInsideMouseDown);
    this.doc.addEventListener('mousedown', this.onOutside, true);
    this.anchor = anchor;
    container.appendChild(box);
    this.place();
    const currentIndex = choices.findIndex((choice) => choice.current);
    this.items[Math.max(0, currentIndex)]?.focus();
  }

  /** Ferme le menu (sans effet s'il est déjà fermé) ; `restoreFocus` rend le focus à `returnFocus`. */
  close(restoreFocus = false): void {
    if (this.closed) return;
    this.closed = true;
    this.element.removeEventListener('keydown', this.onKeyDown);
    this.element.removeEventListener('focusout', this.onFocusOut);
    this.element.removeEventListener('mousedown', this.onInsideMouseDown);
    this.doc.removeEventListener('mousedown', this.onOutside, true);
    this.element.remove();
    if (restoreFocus) this.handlers.returnFocus?.focus();
    this.handlers.onClose();
  }

  /** Pose le menu sous l'ancre, dans la fenêtre (taille mesurée une fois dans le DOM). */
  private place(): void {
    const view = this.doc.defaultView;
    const size = this.element.getBoundingClientRect();
    const position = clampMenuPosition(
      this.anchor,
      { width: size.width, height: size.height },
      { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 }
    );
    this.element.style.left = `${position.left}px`;
    this.element.style.top = `${position.top}px`;
  }

  private addItem(menu: HTMLElement, choice: IconChoice): void {
    const item = this.doc.createElement('button');
    item.type = 'button';
    item.tabIndex = -1;
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(choice.current));
    item.classList.add(ICON_MENU_CLASSES.item);
    item.dataset.choice = choice.kind === 'builtin' ? choice.icon : choice.kind;
    if (choice.current) item.dataset.current = 'true';
    const glyph = this.doc.createElement('span');
    glyph.classList.add(ICON_MENU_CLASSES.glyph);
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = choice.kind === 'builtin' ? (BUILTIN_LAYER_ICONS[choice.icon] ?? '') : '';
    item.append(glyph, this.doc.createTextNode(choiceLabel(choice)));
    item.addEventListener('click', () => this.choose(choice));
    this.items.push(item);
    menu.appendChild(item);
  }

  private buildCustom(): void {
    this.custom.classList.add(ICON_MENU_CLASSES.custom);
    this.custom.setAttribute('role', 'group');
    this.custom.setAttribute('aria-label', LAYER_ICON_TEXTS.custom);
    this.custom.hidden = true;
    this.input.type = 'text';
    this.input.classList.add(ICON_MENU_CLASSES.input);
    this.input.setAttribute('aria-label', LAYER_ICON_TEXTS.customLabel);
    this.input.placeholder = LAYER_ICON_TEXTS.customLabel;
    this.input.value = this.handlers.customValue ?? '';
    this.error.classList.add(ICON_MENU_CLASSES.error);
    this.error.setAttribute('role', 'alert');
    this.error.hidden = true;
    const apply = this.doc.createElement('button');
    apply.type = 'button';
    apply.textContent = LAYER_ICON_TEXTS.apply;
    apply.addEventListener('click', () => this.applyCustom());
    this.custom.append(this.input, apply, this.error);
  }

  private choose(choice: IconChoice): void {
    if (choice.kind === 'custom') {
      this.custom.hidden = false;
      this.place();
      this.input.focus();
      this.input.select();
      return;
    }
    this.handlers.onPick(choice.kind === 'builtin' ? choice.icon : undefined);
    this.close(true);
  }

  private applyCustom(): void {
    const result = validateLayerIcon(this.input.value);
    if (!result.ok) {
      this.error.textContent = result.message;
      this.error.hidden = false;
      this.place();
      this.input.setAttribute('aria-invalid', 'true');
      this.input.focus();
      return;
    }
    this.handlers.onPick(result.icon);
    this.close(true);
  }

  private readonly onOutside = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && (this.element.contains(target) || this.handlers.ignoreOutside?.(target) === true)) return;
    this.close();
  };

  /**
   * Un mousedown dans le menu ne déplace pas le focus (Safari et Firefox macOS
   * ne focalisent pas les boutons ; une zone vide donnerait le focus au
   * conteneur). Seule la saisie texte le garde, pour poser le curseur.
   */
  private readonly onInsideMouseDown = (event: MouseEvent): void => {
    if (event.target !== this.input) event.preventDefault();
  };

  /** Le focus sort du menu vers un autre élément : on ferme sans rendre le focus. */
  private readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    // Un ancêtre (le conteneur de l'éditeur, focalisable) reçoit le focus quand on clique une zone
    // non focalisable du menu : ce n'est pas une sortie. Les vrais clics extérieurs passent par onOutside.
    if (next instanceof Node && !this.element.contains(next) && !next.contains(this.element)) this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      this.close(true);
    } else if (event.target === this.input) {
      this.onInputKey(event);
    } else {
      this.moveFocus(event);
    }
  };

  private onInputKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyCustom();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.items[0]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.items[this.items.length - 1]?.focus();
    }
  }

  private moveFocus(event: KeyboardEvent): void {
    const last = this.items.length - 1;
    const at = this.items.findIndex((item) => item === this.doc.activeElement);
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = at >= last ? 0 : at + 1;
    else if (event.key === 'ArrowUp') next = at <= 0 ? last : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === undefined) return;
    event.preventDefault();
    this.items[next]?.focus();
  }
}
