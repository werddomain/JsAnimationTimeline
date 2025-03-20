/**
 * Layer Editor Component
 * Provides a UI for editing layer properties
 */
import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { Layer } from '../../core/DataModel';
export interface LayerEditorOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onNameChange: (layerId: string, newName: string) => void;
    onColorChange: (layerId: string, newColor: string) => void;
    onVisibilityChange: (layerId: string, visible: boolean) => void;
    onLockChange: (layerId: string, locked: boolean) => void;
    onDelete: (layerId: string) => void;
    onAddToGroup: (layerId: string, groupId: string) => void;
    onRemoveFromGroup: (layerId: string) => void;
}
export declare class LayerEditor extends Component {
    private eventEmitter;
    private options;
    private selectedLayer;
    private availableGroups;
    constructor(options: LayerEditorOptions);
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Select a layer for editing
     */
    selectLayer(layerId: string): void;
    /**
     * Update the editor with new data
     */
    update(data: any): void;
    /**
     * Generate HTML for the editor
     */
    render(): string;
    /**
     * Render options for group selection dropdown
     */
    private renderGroupOptions;
    /**
     * Render options specific to regular layers
     */
    private renderLayerOptions;
    /**
     * Handle form submission
     */
    private handleSubmit;
    /**
     * Handle button clicks
     */
    private handleClick;
    /**
     * Handle input changes
     */
    private handleChange;
    /**
     * Show dialog to add layers to a group
     * This would be implemented with a custom dialog component in a real implementation
     */
    private showAddToGroupDialog;
    /**
     * Check if a layer is a group (has children)
     * This is a simplified version - in a real implementation, you'd use the GroupManager
     */
    private isGroup;
    /**
     * Set the available groups in the timeline
     */
    setAvailableGroups(groups: Layer[]): void;
    /**
     * Clean up event listeners
     */
    destroy(): void;
}
