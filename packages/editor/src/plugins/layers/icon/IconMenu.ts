// packages/editor/src/plugins/layers/icon/IconMenu.ts
/**
 * Menu contextuel du choix d'icône (`role="menu"`) : rendu dans le conteneur
 * de l'éditeur, ancré sous l'icône cliquée. Il se ferme avec Échap, un clic
 * à l'extérieur ou un choix ; les flèches, Début et Fin déplacent le focus.
 * « Personnalisée… » ouvre un champ de saisie validé par `validateLayerIcon`.
 */

import { BUILTIN_LAYER_ICONS } from '../list/layerIcon';
import { validateLayerIcon } from './iconCommand';
import { LAYER_ICON_TEXTS } from './iconChoices';
import type { IconChoice } from './iconChoices';

/** Classes du menu. */
export const ICON_MENU_CLASSES = Object.freeze({
  menu: 'jt-icon-menu',
  item: 'jt-icon-menu__item',
  glyph: 'jt-icon-menu__glyph',
  custom: 'jt-icon-menu__custom',
  input: 'jt-icon-menu__input',
  error: 'jt-icon-menu__error'
});

/** Rappels du menu. */
export interface IconMenuHandlers {
  /** Choix fait : `undefined` pour l'icône par défaut. Le menu se ferme ensuite. */
  readonly onPick: (icon: string | undefined) => void;
  /** Fermeture du menu (quelle qu'en soit la cause), appelée une seule fois. */
  readonly onClose: () => void;
}

function choiceLabel(choice: IconChoice): string {
  if (choice.kind === 'default') return LAYER_ICON_TEXTS.defaultIcon;
  if (choice.kind === 'custom') return LAYER_ICON_TEXTS.custom;
  return choice.icon;
}

/** Un menu d'icônes ouvert ; `close()` le retire et libère ses écouteurs. */
export class IconMenu {
  readonly element: HTMLElement;
  private readonly doc: Document;
  private readonly items: HTMLButtonElement[] = [];
  private readonly custom: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly error: HTMLElement;
  private closed = false;

  constructor(
    container: HTMLElement,
    choices: readonly IconChoice[],
    anchor: DOMRect | undefined,
    private readonly handlers: IconMenuHandlers
  ) {
    this.doc = container.ownerDocument;
    const menu = this.doc.createElement('div');
    menu.classList.add(ICON_MENU_CLASSES.menu);
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', LAYER_ICON_TEXTS.menuLabel);
    choices.forEach((choice) => this.addItem(menu, choice));
    this.custom = this.doc.createElement('div');
    this.input = this.doc.createElement('input');
    this.error = this.doc.createElement('p');
    this.buildCustom();
    menu.appendChild(this.custom);
    menu.style.left = `${anchor?.left ?? 0}px`;
    menu.style.top = `${anchor?.bottom ?? 0}px`;
    this.element = menu;
    menu.addEventListener('keydown', this.onKeyDown);
    this.doc.addEventListener('mousedown', this.onOutside, true);
    container.appendChild(menu);
    this.items[0]?.focus();
  }

  /** Ferme le menu (sans effet s'il est déjà fermé). */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.element.removeEventListener('keydown', this.onKeyDown);
    this.doc.removeEventListener('mousedown', this.onOutside, true);
    this.element.remove();
    this.handlers.onClose();
  }

  private addItem(menu: HTMLElement, choice: IconChoice): void {
    const item = this.doc.createElement('button');
    item.type = 'button';
    item.tabIndex = -1;
    item.setAttribute('role', 'menuitem');
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
    this.custom.hidden = true;
    this.input.type = 'text';
    this.input.classList.add(ICON_MENU_CLASSES.input);
    this.input.setAttribute('aria-label', LAYER_ICON_TEXTS.customLabel);
    this.input.placeholder = LAYER_ICON_TEXTS.customLabel;
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
      this.input.focus();
      return;
    }
    this.handlers.onPick(choice.kind === 'builtin' ? choice.icon : undefined);
    this.close();
  }

  private applyCustom(): void {
    const result = validateLayerIcon(this.input.value);
    if (!result.ok) {
      this.error.textContent = result.message;
      this.error.hidden = false;
      this.input.setAttribute('aria-invalid', 'true');
      this.input.focus();
      return;
    }
    this.handlers.onPick(result.icon);
    this.close();
  }

  private readonly onOutside = (event: Event): void => {
    if (!(event.target instanceof Node) || !this.element.contains(event.target)) this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    } else if (event.target === this.input) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.applyCustom();
      }
    } else {
      this.moveFocus(event);
    }
  };

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
