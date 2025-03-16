// src/plugins/layers/GroupManager.ts
/**
 * Group Manager
 * Manages layer groups in the timeline
 */

import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { Layer } from '../../core/DataModel';
import { TimelineConstants } from '../../core/Constants';

const { EVENTS, CSS_CLASSES, COLORS } = TimelineConstants;

export interface GroupManagerOptions {
    eventEmitter: EventEmitter;
    onCreateGroup: (name: string, selectedLayerIds: string[]) => void;
    onDeleteGroup: (groupId: string, preserveChildren: boolean) => void;
    onRenameGroup: (groupId: string, newName: string) => void;
    onToggleGroupExpanded: (groupId: string) => void;
    onAddLayerToGroup: (layerId: string, groupId: string) => void;
    onRemoveLayerFromGroup: (layerId: string) => void;
}

export class GroupManager extends Component {
    private eventEmitter: EventEmitter;
    private options: GroupManagerOptions;
    private layers: Layer[] = [];

    constructor(container: HTMLElement, options: GroupManagerOptions) {
        super(container, 'timeline-group-manager');
        this.eventEmitter = options.eventEmitter;
        this.options = options;

        this.initialize();
    }

    /**
     * Initialize event listeners
     */
    public initialize(): void {
        // Listen for events relevant to group management
        this.eventEmitter.on(EVENTS.LAYER_ADDED, (layer: Layer) => {
            this.handleLayerAdded(layer);
        });

        this.eventEmitter.on(EVENTS.LAYER_REMOVED, (layerId: string) => {
            this.handleLayerRemoved(layerId);
        });

        this.eventEmitter.on(EVENTS.LAYER_UPDATED, (layer: Layer) => {
            this.handleLayerUpdated(layer);
        });
    }

    /**
     * Update the layers array
     * @param layers Updated layers array
     */
    public update(layers: Layer[]): void {
        this.layers = layers;
        this.updateGroupStructure();
    }

    /**
     * Render component HTML
     */
    public render(): string {
        // This component doesn't have its own UI elements
        // It works through the layer manager
        return '';
    }

    /**
     * Create a new group from selected layers
     * @param groupName Name for the new group
     * @param selectedLayerIds IDs of layers to include in the group
     * @returns The new group layer
     */
    public createGroup(groupName: string, selectedLayerIds: string[]): void {
        if (selectedLayerIds.length === 0) {
            console.warn('Cannot create a group with no layers selected');
            return;
        }

        this.options.onCreateGroup(groupName, selectedLayerIds);
    }

    /**
     * Delete a group
     * @param groupId Group layer ID
     * @param preserveChildren Whether to keep child layers or delete them too
     */
    public deleteGroup(groupId: string, preserveChildren: boolean = true): void {
        const group = this.findGroupById(groupId);
        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return;
        }

        this.options.onDeleteGroup(groupId, preserveChildren);
    }

    /**
     * Rename a group
     * @param groupId Group layer ID
     * @param newName New group name
     */
    public renameGroup(groupId: string, newName: string): void {
        const group = this.findGroupById(groupId);
        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return;
        }

        this.options.onRenameGroup(groupId, newName);
    }

    /**
     * Toggle group expanded/collapsed state
     * @param groupId Group layer ID
     */
    public toggleGroupExpanded(groupId: string): void {
        const group = this.findGroupById(groupId);
        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return;
        }

        this.options.onToggleGroupExpanded(groupId);
    }

    /**
     * Add a layer to a group
     * @param layerId Layer ID
     * @param groupId Group layer ID
     */
    public addLayerToGroup(layerId: string, groupId: string): void {
        const layer = this.layers.find(l => l.id === layerId);
        const group = this.findGroupById(groupId);

        if (!layer) {
            console.warn(`Layer with ID ${layerId} not found`);
            return;
        }

        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return;
        }

        this.options.onAddLayerToGroup(layerId, groupId);
    }

    /**
     * Remove a layer from its group
     * @param layerId Layer ID
     */
    public removeLayerFromGroup(layerId: string): void {
        const layer = this.layers.find(l => l.id === layerId);

        if (!layer) {
            console.warn(`Layer with ID ${layerId} not found`);
            return;
        }

        if (!layer.parentId) {
            console.warn(`Layer with ID ${layerId} is not in a group`);
            return;
        }

        this.options.onRemoveLayerFromGroup(layerId);
    }

    /**
     * Check if a layer is a group
     * @param layer Layer to check
     * @returns True if the layer is a group
     */
    public isGroup(layer: Layer): boolean {
        // A layer is considered a group if it has children
        return this.getChildLayers(layer.id).length > 0;
    }

    /**
     * Get all child layers of a group
     * @param groupId Group layer ID
     * @returns Array of child layers
     */
    public getChildLayers(groupId: string): Layer[] {
        return this.layers.filter(layer => layer.parentId === groupId);
    }

    /**
     * Get a layer's parent group
     * @param layerId Layer ID
     * @returns Parent group or null if not in a group
     */
    public getParentGroup(layerId: string): Layer | null {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || !layer.parentId) return null;

        return this.layers.find(l => l.id === layer.parentId) || null;
    }

    /**
     * Find a group layer by ID
     * @param groupId Group layer ID
     * @returns Group layer or undefined
     */
    private findGroupById(groupId: string): Layer | undefined {
        return this.layers.find(layer => layer.id === groupId);
    }

    /**
     * Update group structure after changes
     */
    private updateGroupStructure(): void {
        // This would handle any necessary updates to maintain group hierarchy
        // For example, after layers are reordered
    }

    /**
     * Handle layer added event
     * @param layer Added layer
     */
    private handleLayerAdded(layer: Layer): void {
        // Update internal structures if needed
    }

    /**
     * Handle layer removed event
     * @param layerId Removed layer ID
     */
    private handleLayerRemoved(layerId: string): void {
        // Check if removed layer was a group, handle child orphaning
        const childLayers = this.layers.filter(layer => layer.parentId === layerId);

        if (childLayers.length > 0) {
            console.log(`Layer ${layerId} was a group with ${childLayers.length} children`);
            // Children will be handled by the TimelineControl based on the preserveChildren flag
        }
    }

    /**
     * Handle layer updated event
     * @param layer Updated layer
     */
    private handleLayerUpdated(layer: Layer): void {
        // Update internal structures if needed
    }

    /**
     * Get all top-level groups (groups that aren't children of other groups)
     * @returns Array of top-level group layers
     */
    public getTopLevelGroups(): Layer[] {
        return this.layers.filter(layer =>
            this.isGroup(layer) && !layer.parentId
        );
    }

    /**
     * Check if a layer is a direct child of a group
     * @param layerId Layer ID to check
     * @param groupId Group ID to check against
     * @returns True if the layer is a direct child of the group
     */
    public isChildOfGroup(layerId: string, groupId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        return layer ? layer.parentId === groupId : false;
    }

    /**
     * Get all layers in a flat structure with proper indentation level
     * @returns Array of layers with their indentation level
     */
    public getLayersWithIndentation(): { layer: Layer, indentLevel: number }[] {
        const result: { layer: Layer, indentLevel: number }[] = [];

        // Add top-level layers (those without a parent)
        const topLevelLayers = this.layers.filter(layer => !layer.parentId);

        // Process each top-level layer and its children recursively
        topLevelLayers.forEach(layer => {
            this.addLayerWithChildren(layer, 0, result);
        });

        return result;
    }

    /**
     * Add a layer and its children to the result array
     * @param layer Layer to add
     * @param indentLevel Current indentation level
     * @param result Result array
     */
    private addLayerWithChildren(
        layer: Layer,
        indentLevel: number,
        result: { layer: Layer, indentLevel: number }[]
    ): void {
        // Add the layer itself
        result.push({ layer, indentLevel });

        // If this is a group and it's expanded, add its children
        if (this.isGroup(layer) && layer.isExpanded !== false) {
            const children = this.getChildLayers(layer.id);

            // Sort children by their index if available
            const sortedChildren = [...children].sort((a, b) => {
                const indexA = typeof a.index === 'number' ? a.index : 0;
                const indexB = typeof b.index === 'number' ? b.index : 0;
                return indexA - indexB;
            });

            // Process each child
            sortedChildren.forEach(child => {
                this.addLayerWithChildren(child, indentLevel + 1, result);
            });
        }
    }

    /**
     * Clean up
     */
    public destroy(): void {
        // Clean up event listeners
    }
}