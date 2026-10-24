// packages/editor/src/plugins/layers/toolbar/ToolbarView.ts
/**
 * Vue de la barre d'outils des calques : le DOM des boutons, l'état activé /
 * désactivé et la navigation aux flèches (tabindex itinérant : un seul bouton
 * est dans l'ordre de tabulation). Aucune logique métier : les clics sont
 * transmis par la fonction `onAction`.
 *
 * Un bouton indisponible porte `aria-disabled="true"` (pas l'attribut natif
 * `disabled`) : il reste atteignable aux flèches, comme dans une barre d'outils
 * WAI-ARIA, et le focus ne tombe pas sur `body` quand le bouton focalisé
 * devient indisponible. Son clic est ignoré.
 */

/** Actions de la barre. */
export type ToolbarAction = 'newLayer' | 'newFolder' | 'group' | 'delete';

/** Classes de la barre d'outils. */
export const LAYER_TOOLBAR_CLASSES = Object.freeze({
  toolbar: 'jt-layer-toolbar',
  button: 'jt-layer-toolbar__button',
  icon: 'jt-layer-toolbar__icon'
});

/** Description d'un bouton : icône, libellé (titre et nom accessible français). */
interface IButtonSpec {
  readonly action: ToolbarAction;
  readonly icon: string;
  readonly label: string;
}

/** Boutons, dans l'ordre d'affichage (Flash : calque, dossier, puis grouper et supprimer). */
export const LAYER_TOOLBAR_BUTTONS: readonly IButtonSpec[] = Object.freeze([
  { action: 'newLayer', icon: '＋', label: 'Nouveau calque' },
  { action: 'newFolder', icon: '📁', label: 'Nouveau dossier' },
  { action: 'group', icon: '⧉', label: 'Grouper la sélection' },
  { action: 'delete', icon: '🗑', label: 'Supprimer la sélection' }
]);

/** Libellé accessible de la barre. */
export const LAYER_TOOLBAR_LABEL = 'Actions sur les calques';

/** Vrai si le bouton est indisponible (`aria-disabled="true"`). */
function isUnavailable(button: HTMLButtonElement): boolean {
  return button.getAttribute('aria-disabled') === 'true';
}

/** Barre d'outils montée dans un élément. */
export class ToolbarView {
  readonly element: HTMLElement;
  private readonly buttons = new Map<ToolbarAction, HTMLButtonElement>();
  private active: ToolbarAction = 'newLayer';
  private readonly onKeyDown = (event: KeyboardEvent): void => this.navigate(event);

  constructor(slot: HTMLElement, onAction: (action: ToolbarAction) => void) {
    const doc = slot.ownerDocument;
    this.element = doc.createElement('div');
    this.element.classList.add(LAYER_TOOLBAR_CLASSES.toolbar);
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', LAYER_TOOLBAR_LABEL);
    LAYER_TOOLBAR_BUTTONS.forEach((spec) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.classList.add(LAYER_TOOLBAR_CLASSES.button);
      button.title = spec.label;
      button.setAttribute('aria-label', spec.label);
      button.dataset.action = spec.action;
      const icon = doc.createElement('span');
      icon.classList.add(LAYER_TOOLBAR_CLASSES.icon);
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = spec.icon;
      button.append(icon);
      button.addEventListener('click', () => {
        if (!isUnavailable(button)) onAction(spec.action);
      });
      button.addEventListener('focus', () => this.setActive(spec.action));
      this.buttons.set(spec.action, button);
      this.element.append(button);
    });
    this.element.addEventListener('keydown', this.onKeyDown);
    slot.append(this.element);
    this.setActive(this.active);
  }

  /** Bouton d'une action. */
  button(action: ToolbarAction): HTMLButtonElement | undefined {
    return this.buttons.get(action);
  }

  /** Rend les boutons disponibles ou non (`aria-disabled`) ; le bouton actif ne change pas. */
  setEnabled(enabled: Readonly<Record<ToolbarAction, boolean>>): void {
    this.buttons.forEach((button, action) => {
      if (enabled[action]) button.removeAttribute('aria-disabled');
      else button.setAttribute('aria-disabled', 'true');
    });
  }

  /** Donne le focus au premier bouton (« Nouveau calque », toujours disponible). */
  focusFirst(): void {
    this.buttons.get('newLayer')?.focus();
  }

  /** Retire la barre du DOM. */
  dispose(): void {
    this.element.removeEventListener('keydown', this.onKeyDown);
    this.element.remove();
    this.buttons.clear();
  }

  private setActive(action: ToolbarAction): void {
    this.active = action;
    this.buttons.forEach((button, key) => button.setAttribute('tabindex', key === action ? '0' : '-1'));
  }

  /** Flèches gauche / droite (en boucle), Début et Fin, indisponibles compris. */
  private navigate(event: KeyboardEvent): void {
    const current = LAYER_TOOLBAR_BUTTONS.findIndex((spec) => spec.action === this.active);
    const target = this.targetIndex(event.key, current, LAYER_TOOLBAR_BUTTONS.length);
    if (target === undefined) return;
    event.preventDefault();
    const spec = LAYER_TOOLBAR_BUTTONS[target];
    if (spec === undefined) return;
    this.setActive(spec.action);
    this.buttons.get(spec.action)?.focus();
  }

  private targetIndex(key: string, current: number, count: number): number | undefined {
    if (key === 'ArrowRight') return (current + 1) % count;
    if (key === 'ArrowLeft') return (current - 1 + count) % count;
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    return undefined;
  }
}
