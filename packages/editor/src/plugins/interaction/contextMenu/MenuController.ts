// packages/editor/src/plugins/interaction/contextMenu/MenuController.ts
/** Accessible, viewport-bounded menu with instance-local focus and cleanup. */
import type { IContextMenuAction, IMenuPosition } from './types';

const EDGE = 8;

/** Clamp after measuring; CSS also limits the menu at narrow viewports. */
export function menuPosition(point: IMenuPosition, width: number, height: number, viewportWidth: number, viewportHeight: number): IMenuPosition {
  return { x: Math.max(EDGE, Math.min(point.x, viewportWidth - width - EDGE)), y: Math.max(EDGE, Math.min(point.y, viewportHeight - height - EDGE)) };
}

export class MenuController {
  private portal: HTMLElement | undefined;
  private menu: HTMLElement | undefined;
  private restore: HTMLElement | undefined;
  private cleanups: Array<() => void> = [];

  constructor(private readonly root: HTMLElement) {}

  open(point: IMenuPosition, restore: HTMLElement, actions: () => readonly IContextMenuAction[]): void {
    this.close(false);
    const doc = this.root.ownerDocument;
    const portal = doc.createElement('div');
    portal.className = 'JsTimeLine jt-context-menu-portal';
    const menu = doc.createElement('div');
    menu.className = 'jt-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Actions de la timeline');
    this.portal = portal;
    this.menu = menu;
    this.restore = restore;
    const buttons = actions().map((spec, index) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.dataset.contextAction = spec.id;
      button.tabIndex = index === 0 ? 0 : -1;
      button.textContent = spec.label;
      if (!spec.enabled) {
        button.setAttribute('aria-disabled', 'true');
        if (spec.reason !== undefined) {
          button.setAttribute('aria-description', spec.reason);
          button.title = spec.reason;
        }
      }
      button.addEventListener('click', () => {
        const fresh = actions().find((action) => action.id === spec.id);
        if (fresh?.enabled !== true) return;
        this.close(true);
        fresh.run();
      });
      menu.append(button);
      return button;
    });
    menu.addEventListener('keydown', (event) => this.keydown(event, buttons));
    portal.append(menu);
    doc.body.append(portal);
    const view = doc.defaultView;
    // Scroll events may be queued by scrolling the target into view before
    // contextmenu. Only a position change after opening dismisses this menu.
    const positions = new Map<EventTarget, IMenuPosition>();
    positions.set(doc, { x: view?.scrollX ?? 0, y: view?.scrollY ?? 0 });
    let ancestor: HTMLElement | null = this.root;
    while (ancestor !== null) {
      positions.set(ancestor, { x: ancestor.scrollLeft, y: ancestor.scrollTop });
      ancestor = ancestor.parentElement;
    }
    this.root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      positions.set(element, { x: element.scrollLeft, y: element.scrollTop });
    });
    const rect = menu.getBoundingClientRect();
    const positioned = menuPosition(point, rect.width, rect.height, view?.innerWidth ?? 320, view?.innerHeight ?? 480);
    menu.style.left = `${positioned.x}px`;
    menu.style.top = `${positioned.y}px`;
    const outside = (event: Event): void => {
      if (event.target instanceof Node && !menu.contains(event.target)) this.close(false);
    };
    const scroll = (event: Event): void => {
      if (event.target === menu) return;
      const target = event.target;
      const previous = target === null ? undefined : positions.get(target);
      const current = target === doc ? { x: view?.scrollX ?? 0, y: view?.scrollY ?? 0 }
        : target instanceof Element ? { x: target.scrollLeft, y: target.scrollTop } : undefined;
      if (previous !== undefined && current?.x === previous.x && current.y === previous.y) return;
      this.close(true);
    };
    const resize = (): void => this.close(true);
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('contextmenu', outside, true);
    doc.addEventListener('scroll', scroll, true);
    doc.addEventListener('focusin', outside);
    view?.addEventListener('resize', resize);
    this.cleanups.push(() => {
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('contextmenu', outside, true);
      doc.removeEventListener('scroll', scroll, true);
      doc.removeEventListener('focusin', outside);
      view?.removeEventListener('resize', resize);
    });
    buttons[0]?.focus({ preventScroll: true });
  }

  /** Never move outside focus back into an editor. */
  close(restoreFocus: boolean): void {
    const hadFocus = this.menu?.contains(this.root.ownerDocument.activeElement) === true;
    const restore = this.restore;
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.portal?.remove();
    this.portal = undefined;
    this.menu = undefined;
    this.restore = undefined;
    if (restoreFocus && hadFocus && restore?.isConnected) restore.focus({ preventScroll: true });
  }

  private keydown(event: KeyboardEvent, buttons: readonly HTMLButtonElement[]): void {
    const current = buttons.findIndex((button) => button === this.root.ownerDocument.activeElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = (current + 1) % buttons.length; break;
      case 'ArrowUp': next = (current - 1 + buttons.length) % buttons.length; break;
      case 'Home': next = 0; break;
      case 'End': next = buttons.length - 1; break;
      case 'Escape': event.preventDefault(); event.stopPropagation(); this.close(true); return;
      case 'Tab': this.close(true); return;
      case 'Enter': case ' ': event.preventDefault(); buttons[current]?.click(); return;
      default: return;
    }
    event.preventDefault();
    buttons.forEach((button, index) => { button.tabIndex = index === next ? 0 : -1; });
    buttons[next]?.focus({ preventScroll: true });
  }
}
