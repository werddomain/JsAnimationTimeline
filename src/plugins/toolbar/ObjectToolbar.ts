/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/plugins/toolbar/ObjectToolbar.ts
/**
 * Object Toolbar
 * Manages the object manipulation toolbar
 */

import { EventEmitter } from '../../core/EventEmitter';
import { TimelineConstants } from '../../core/Constants';
import { Component } from '../../core/BaseComponent';

const { EVENTS, CSS_CLASSES } = TimelineConstants;

export interface ObjectToolbarOptions {
  container: HTMLElement;
  eventEmitter: EventEmitter;
  onNewObject: () => void;
  onCreateGroup: () => void;
  onDeleteObject: () => void;
}

export interface ObjectToolbarData {
  hasSelection: boolean;
}

export class ObjectToolbar extends Component {
  private eventEmitter: EventEmitter;
  private options: ObjectToolbarOptions;
  private hasSelection: boolean = false;
  
  constructor(options: ObjectToolbarOptions) {
    super(options.container, 'timeline-object-toolbar');
    this.eventEmitter = options.eventEmitter;
    this.options = options;
    
    this.init();
  }
  
  /**
   * Initialize the toolbar
   */
  private init(): void {
    this.initialize();
  }
  
  /**
   * Initialize event listeners
   */
  public initialize(): void {
    const element = this.getElement();
    if (element) {
      element.addEventListener('click', this.handleClick.bind(this));
    }
  }
  
  /**
   * Render the toolbar
   */
  public render(): string {
    return `
      <div id="${this.elementId}" class="${CSS_CLASSES.OBJECT_TOOLBAR}">
        <div class="timeline-object-toolbar-content">
          <button class="timeline-btn" data-action="new-object" title="New Object">
            <span class="timeline-icon">+</span>
            <span>New Object</span>
          </button>
          <button class="timeline-btn" data-action="create-group" title="Create Group" ${this.hasSelection ? '' : 'disabled'}>
            <span class="timeline-icon">📁</span>
            <span>Create Group</span>
          </button>
          <button class="timeline-btn" data-action="delete-object" title="Delete Object" ${this.hasSelection ? '' : 'disabled'}>
            <span class="timeline-icon">🗑️</span>
            <span>Delete Object</span>
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Update the toolbar state
   * @param data The data to update
   */
  public update(data: ObjectToolbarData): void {
    if (data.hasSelection !== undefined) {
      this.hasSelection = data.hasSelection;
    }
    
    const element = this.getElement();
    if (!element) return;
    
    // Update button states
    const groupBtn = element.querySelector('[data-action="create-group"]') as HTMLButtonElement;
    const deleteBtn = element.querySelector('[data-action="delete-object"]') as HTMLButtonElement;
    
    if (groupBtn && deleteBtn) {
      groupBtn.disabled = !this.hasSelection;
      deleteBtn.disabled = !this.hasSelection;
    }
  }
  
  /**
   * Handle toolbar button clicks
   * @param e Click event
   */
  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const button = target.closest('.timeline-btn') as HTMLButtonElement;
    
    if (!button || button.disabled) return;
    
    const action = button.getAttribute('data-action');
    if (!action) return;
    
    switch (action) {
      case 'new-object':
        this.options.onNewObject();
        break;
      case 'create-group':
        this.options.onCreateGroup();
        break;
      case 'delete-object':
        this.options.onDeleteObject();
        break;
    }
  }
  

  
//  /**
//   * Clean up event listeners
//   */
//  public destroy(): void {
//    const element = this.getElement();
//    if (element) {
//      element.removeEventListener('click', this.handleClick.bind(this));
//    }
//  }
//}data-action="delete-object"]') as HTMLButtonElement;
    
//    if (groupBtn && deleteBtn) {
//      groupBtn.disabled = !this.hasSelection;
//      deleteBtn.disabled = !this.hasSelection;
//    }
//  }
  
  
  /**
   * Enable or disable buttons based on selection
   * @param hasSelection Whether any objects are selected
   */
  public updateButtonState(hasSelection: boolean): void {
    this.update({ hasSelection });
  }
  
//  /**
//   * Clean up event listeners
//   */
//  public destroy(): void {
//    const element = this.getElement();
//    if (element) {
//      element.removeEventListener('click', this.handleClick.bind(this));
//    }
//  }
//}data-action="delete-object"]') as HTMLButtonElement;
    
//    groupBtn.disabled = !hasSelection;
//    deleteBtn.disabled = !hasSelection;
//  }
}