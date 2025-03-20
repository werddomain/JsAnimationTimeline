// src/plugins/layers/LayerEditor.ts
/**
 * Layer Editor Component
 * Provides a UI for editing layer properties
 */
import { Component } from '../../core/BaseComponent';
import { TimelineConstants } from '../../core/Constants';
const { EVENTS, CSS_CLASSES, COLORS } = TimelineConstants;
export class LayerEditor extends Component {
    constructor(options) {
        super(options.container, 'timeline-layer-editor');
        this.selectedLayer = null;
        this.availableGroups = [];
        this.eventEmitter = options.eventEmitter;
        this.options = options;
        this.initialize();
    }
    /**
     * Initialize event listeners
     */
    initialize() {
        // Listen for layer selection events
        this.eventEmitter.on(EVENTS.LAYER_SELECTED, (layerId) => {
            this.selectLayer(layerId);
        });
        // Listen for layer updates
        this.eventEmitter.on(EVENTS.LAYER_UPDATED, (layer) => {
            if (this.selectedLayer && layer.id === this.selectedLayer.id) {
                this.selectedLayer = layer;
                this.update({});
            }
        });
        const element = this.getElement();
        if (element) {
            element.addEventListener('submit', this.handleSubmit.bind(this));
            element.addEventListener('click', this.handleClick.bind(this));
            element.addEventListener('change', this.handleChange.bind(this));
        }
    }
    /**
     * Select a layer for editing
     */
    selectLayer(layerId) {
        // Find the layer in the data model (we'll need to get this from outside)
        // This would typically be passed in from the main timeline control
        this.selectedLayer = null; // Will be set by the timeline control
        this.update({});
    }
    /**
     * Update the editor with new data
     */
    update(data) {
        if (data.layer) {
            this.selectedLayer = data.layer;
        }
        if (data.availableGroups) {
            this.availableGroups = data.availableGroups;
        }
        const element = this.getElement();
        if (element) {
            element.innerHTML = this.render();
        }
    }
    /**
     * Generate HTML for the editor
     */
    render() {
        // If no layer is selected, show empty state
        if (!this.selectedLayer) {
            return `
                <div id="${this.elementId}" class="timeline-layer-editor">
                    <div class="timeline-layer-editor-empty">
                        No layer selected. Select a layer to edit its properties.
                    </div>
                </div>
            `;
        }
        // Determine if this is a group
        const isGroup = this.isGroup(this.selectedLayer);
        return `
            <div id="${this.elementId}" class="timeline-layer-editor">
                <div class="timeline-layer-editor-header">
                    <h3>Layer Properties${isGroup ? ' (Group)' : ''}</h3>
                </div>
                
                <form class="timeline-layer-editor-form">
                    <div class="timeline-layer-editor-field">
                        <label for="layer-name">Name:</label>
                        <input 
                            type="text" 
                            id="layer-name" 
                            name="name" 
                            value="${this.selectedLayer.name || ''}" 
                            required
                        >
                    </div>
                    
                    <div class="timeline-layer-editor-field">
                        <label for="layer-color">Color:</label>
                        <div class="timeline-layer-editor-color-picker">
                            <input 
                                type="color" 
                                id="layer-color" 
                                name="color" 
                                value="${this.selectedLayer.color || '#FFFFFF'}"
                            >
                        </div>
                    </div>
                    
                    <div class="timeline-layer-editor-field">
                        <label>Visibility:</label>
                        <div class="timeline-layer-editor-toggle">
                            <input 
                                type="checkbox" 
                                id="layer-visible" 
                                name="visible" 
                                ${this.selectedLayer.visible ? 'checked' : ''}
                            >
                            <label for="layer-visible" class="toggle-label">
                                ${this.selectedLayer.visible ? 'Visible' : 'Hidden'}
                            </label>
                        </div>
                    </div>
                    
                    <div class="timeline-layer-editor-field">
                        <label>Lock:</label>
                        <div class="timeline-layer-editor-toggle">
                            <input 
                                type="checkbox" 
                                id="layer-locked" 
                                name="locked" 
                                ${this.selectedLayer.locked ? 'checked' : ''}
                            >
                            <label for="layer-locked" class="toggle-label">
                                ${this.selectedLayer.locked ? 'Locked' : 'Unlocked'}
                            </label>
                        </div>
                    </div>
                    
                    ${isGroup ? this.renderGroupOptions() : this.renderLayerOptions()}
                    
                    <div class="timeline-layer-editor-actions">
                        <button type="submit" class="timeline-btn">Apply Changes</button>
                        <button type="button" class="timeline-btn danger" data-action="delete-layer">
                            Delete${isGroup ? ' Group' : ' Layer'}
                        </button>
                    </div>
                </form>
            </div>
        `;
    }
    ///**
    // * Render options specific to groups
    // */
    //private renderGroupOptions(): string {
    //    return `
    //        <div class="timeline-layer-editor-field">
    //            <label>Group Options:</label>
    //            <div class="timeline-layer-editor-group-options">
    //                <button type="button" class="timeline-btn" data-action="add-to-group">
    //                    Add Layers to Group
    //                </button>
    //                <button type="button" class="timeline-btn" data-action="toggle-expanded">
    //                    ${this.selectedLayer?.isExpanded !== false ? 'Collapse' : 'Expand'} Group
    //                </button>
    //            </div>
    //        </div>
    //    `;
    //}
    /**
     * Render options for group selection dropdown
     */
    renderGroupOptions() {
        return this.availableGroups
            .filter(group => { var _a; return group.id !== ((_a = this.selectedLayer) === null || _a === void 0 ? void 0 : _a.id); }) // Prevent assigning to self
            .map(group => {
            var _a;
            return `
                <option 
                    value="${group.id}" 
                    ${group.id === ((_a = this.selectedLayer) === null || _a === void 0 ? void 0 : _a.parentId) ? 'selected' : ''}
                >
                    ${group.name}
                </option>
            `;
        })
            .join('');
    }
    /**
     * Render options specific to regular layers
     */
    renderLayerOptions() {
        var _a;
        // Show group assignment options
        return `
            <div class="timeline-layer-editor-field">
                <label for="layer-group">Parent Group:</label>
                <div class="timeline-layer-editor-group-select">
                    <select id="layer-group" name="parentId">
                        <option value="">None (Top Level)</option>
                        ${this.renderGroupOptions()}
                    </select>
                    ${((_a = this.selectedLayer) === null || _a === void 0 ? void 0 : _a.parentId) ? `
                        <button type="button" class="timeline-btn" data-action="remove-from-group">
                            Remove from Group
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    /**
     * Handle form submission
     */
    handleSubmit(e) {
        e.preventDefault();
        if (!this.selectedLayer)
            return;
        const form = e.target;
        const formData = new FormData(form);
        // Get values from form
        const name = formData.get('name');
        const color = formData.get('color');
        const visible = formData.has('visible');
        const locked = formData.has('locked');
        const parentId = formData.get('parentId');
        // Update layer properties
        if (name !== this.selectedLayer.name) {
            this.options.onNameChange(this.selectedLayer.id, name);
        }
        if (color !== this.selectedLayer.color) {
            this.options.onColorChange(this.selectedLayer.id, color);
        }
        if (visible !== this.selectedLayer.visible) {
            this.options.onVisibilityChange(this.selectedLayer.id, visible);
        }
        if (locked !== this.selectedLayer.locked) {
            this.options.onLockChange(this.selectedLayer.id, locked);
        }
        // Handle group assignment changes
        if (parentId !== this.selectedLayer.parentId) {
            if (parentId) {
                this.options.onAddToGroup(this.selectedLayer.id, parentId);
            }
            else if (this.selectedLayer.parentId) {
                this.options.onRemoveFromGroup(this.selectedLayer.id);
            }
        }
    }
    /**
     * Handle button clicks
     */
    handleClick(e) {
        const target = e.target;
        if (!target || !this.selectedLayer)
            return;
        const button = target.closest('[data-action]');
        if (!button)
            return;
        const action = button.getAttribute('data-action');
        switch (action) {
            case 'delete-layer':
                if (confirm('Are you sure you want to delete this layer?')) {
                    this.options.onDelete(this.selectedLayer.id);
                }
                break;
            case 'add-to-group':
                this.showAddToGroupDialog();
                break;
            case 'remove-from-group':
                if (this.selectedLayer.parentId) {
                    this.options.onRemoveFromGroup(this.selectedLayer.id);
                }
                break;
            case 'toggle-expanded':
                // This would be handled by the timeline controller
                // We'd emit an event that the timeline controller would listen for
                this.eventEmitter.emitGroupToggle(this.selectedLayer.id, this.selectedLayer.isExpanded);
                //this.eventEmitter.emit('layer:group:toggle', this.selectedLayer.id);
                break;
        }
    }
    /**
     * Handle input changes
     */
    handleChange(e) {
        const target = e.target;
        if (!target || !target.name || !this.selectedLayer)
            return;
        const parentId = target.value;
        // If we want immediate updates without form submission:
        switch (target.name) {
            case 'visible':
                this.options.onVisibilityChange(this.selectedLayer.id, target.checked);
                break;
            case 'locked':
                this.options.onLockChange(this.selectedLayer.id, target.checked);
                break;
            case 'parentId':
                if (parentId !== this.selectedLayer.parentId) {
                    if (parentId) {
                        this.options.onAddToGroup(this.selectedLayer.id, parentId);
                    }
                    else if (this.selectedLayer.parentId) {
                        this.options.onRemoveFromGroup(this.selectedLayer.id);
                    }
                }
                break;
        }
    }
    /**
     * Show dialog to add layers to a group
     * This would be implemented with a custom dialog component in a real implementation
     */
    showAddToGroupDialog() {
        alert('In a real implementation, this would show a dialog to select layers to add to this group');
    }
    /**
     * Check if a layer is a group (has children)
     * This is a simplified version - in a real implementation, you'd use the GroupManager
     */
    isGroup(layer) {
        return this.availableGroups.includes(layer);
    }
    /**
     * Set the available groups in the timeline
     */
    setAvailableGroups(groups) {
        this.availableGroups = groups;
        this.update({});
    }
    /**
     * Clean up event listeners
     */
    destroy() {
        const element = this.getElement();
        if (element) {
            element.removeEventListener('submit', this.handleSubmit.bind(this));
            element.removeEventListener('click', this.handleClick.bind(this));
            element.removeEventListener('change', this.handleChange.bind(this));
        }
    }
}
//# sourceMappingURL=LayerEditor.js.map