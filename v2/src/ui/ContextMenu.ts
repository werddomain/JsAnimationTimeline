/**
 * MenuItem interface
 */
export interface IMenuItem {
  label?: string;
  action?: () => void;
  enabled?: boolean;
  separator?: boolean;
  submenu?: IMenuItem[];
}

/**
 * ContextMenu
 * Reusable context menu system for the timeline control
 */
export class ContextMenu {
  private menuElement: HTMLElement | null = null;
  private isVisible: boolean = false;

  constructor() {
    this.setupGlobalListeners();
  }

  /**
   * Setup global event listeners for closing menu
   */
  private setupGlobalListeners(): void {
    // Close on escape key
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * Show the context menu at specified coordinates
   * @param x X coordinate (screen position)
   * @param y Y coordinate (screen position)
   * @param items Menu items to display
   */
  public show(x: number, y: number, items: IMenuItem[]): void {
    // Hide any existing menu
    this.hide();

    // Create menu element
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'context-menu';
    this.menuElement.style.position = 'fixed';
    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
    this.menuElement.style.zIndex = '10000';

    // Add menu items
    items.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        this.menuElement!.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        menuItem.textContent = item.label || '';

        // Handle enabled/disabled state
        const isEnabled = item.enabled !== false;
        if (!isEnabled) {
          menuItem.classList.add('disabled');
        } else if (item.action) {
          menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            item.action!();
            this.hide();
          });
        }

        this.menuElement!.appendChild(menuItem);
      }
    });

    // Add to DOM
    document.body.appendChild(this.menuElement);
    this.isVisible = true;

    // Adjust position if menu goes off screen
    this.adjustPosition();

    // Setup click outside to close
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 0);
  }

  /**
   * Hide the context menu
   */
  public hide(): void {
    if (this.menuElement && this.menuElement.parentElement) {
      this.menuElement.parentElement.removeChild(this.menuElement);
    }
    this.menuElement = null;
    this.isVisible = false;
    document.removeEventListener('click', this.handleOutsideClick);
  }

  /**
   * Check if menu is currently visible
   */
  public isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Handle clicks outside the menu
   */
  private handleOutsideClick = (e: MouseEvent): void => {
    if (this.menuElement && !this.menuElement.contains(e.target as Node)) {
      this.hide();
    }
  };

  /**
   * Adjust menu position if it goes off screen
   */
  private adjustPosition(): void {
    if (!this.menuElement) return;

    const rect = this.menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newLeft = rect.left;
    let newTop = rect.top;

    // Adjust horizontal position
    if (rect.right > viewportWidth) {
      newLeft = viewportWidth - rect.width - 10;
    }
    if (newLeft < 0) {
      newLeft = 10;
    }

    // Adjust vertical position
    if (rect.bottom > viewportHeight) {
      newTop = viewportHeight - rect.height - 10;
    }
    if (newTop < 0) {
      newTop = 10;
    }

    this.menuElement.style.left = `${newLeft}px`;
    this.menuElement.style.top = `${newTop}px`;
  }

  /**
   * Destroy the context menu instance
   */
  public destroy(): void {
    this.hide();
  }
}
