/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/plugins/toolbar/ObjectToolbar.ts
/**
 * Object Toolbar
 * Manages the object manipulation toolbar
 */
import { TimelineConstants } from '../../core/Constants';
import { Component } from '../../core/BaseComponent';
const { EVENTS, CSS_CLASSES } = TimelineConstants;
export class ObjectToolbar extends Component {
    constructor(options) {
        super(options.container, 'timeline-object-toolbar');
        this.hasSelection = false;
        this.eventEmitter = options.eventEmitter;
        this.options = options;
        this.init();
    }
    /**
     * Initialize the toolbar
     */
    init() {
        this.initialize();
    }
    /**
     * Initialize event listeners
     */
    initialize() {
        const element = this.getElement();
        if (element) {
            element.addEventListener('click', this.handleClick.bind(this));
        }
    }
    /**
     * Render the toolbar
     */
    render() {
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
    update(data) {
        if (data.hasSelection !== undefined) {
            this.hasSelection = data.hasSelection;
        }
        const element = this.getElement();
        if (!element)
            return;
        // Update button states
        const groupBtn = element.querySelector('[data-action="create-group"]');
        const deleteBtn = element.querySelector('[data-action="delete-object"]');
        if (groupBtn && deleteBtn) {
            groupBtn.disabled = !this.hasSelection;
            deleteBtn.disabled = !this.hasSelection;
        }
    }
    /**
     * Handle toolbar button clicks
     * @param e Click event
     */
    handleClick(e) {
        const target = e.target;
        const button = target.closest('.timeline-btn');
        if (!button || button.disabled)
            return;
        const action = button.getAttribute('data-action');
        if (!action)
            return;
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
    updateButtonState(hasSelection) {
        this.update({ hasSelection });
    }
}
//# sourceMappingURL=ObjectToolbar.js.map