/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/plugins/layers/GroupManager.ts
/**
 * Group Manager
 * Manages layer groups in the timeline
 */

import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { Layer, TimelineDataModel } from '../../core/DataModel';
import { TimelineConstants } from '../../core/Constants';


const { EVENTS, CSS_CLASSES, COLORS } = TimelineConstants;

export interface GroupManagerOptions {
    eventEmitter: EventEmitter;
    dataModel: TimelineDataModel;

}

export class GroupManager extends Component {
    private eventEmitter: EventEmitter;
    private dataModel: TimelineDataModel;
    private options: GroupManagerOptions;
    private layers: Layer[] = [];

    constructor(container: HTMLElement, options: GroupManagerOptions) {
        super(container, 'timeline-group-manager');
        this.eventEmitter = options.eventEmitter;
        this.dataModel = options.dataModel;
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
     * @returns The new group layer ID
     */
    public createGroup(groupName: string, selectedLayerIds: string[]): string | null {
        if (selectedLayerIds.length === 0) {
            console.warn('Cannot create a group with no layers selected');
            return null;
        }

        // Validate that all selected layers exist
        const selectedLayers = this.layers.filter(layer => selectedLayerIds.includes(layer.id));
        if (selectedLayers.length !== selectedLayerIds.length) {
            console.warn('Some selected layers were not found');
            return null;
        }

        // Create a new group layer
        const colorIndex = this.layers.length % COLORS.LAYER_DEFAULTS.length;
        const newGroup = this.dataModel.addLayer({
            name: groupName || 'Group',
            visible: true,
            locked: false,
            color: COLORS.LAYER_DEFAULTS[colorIndex],
            isExpanded: true
        });

        if (!newGroup) {
            console.error('Failed to create group layer');
            return null;
        }

        // Move selected layers to be children of the group
        selectedLayerIds.forEach(layerId => {
            this.dataModel.updateLayer(layerId, { parentId: newGroup.id });
        });

        // Emit event to notify about the group creation
        this.eventEmitter.emitGroupCreated(newGroup.id, selectedLayerIds);

        return newGroup.id;
    }

    /**
     * Delete a group
     * @param groupId Group layer ID
     * @param preserveChildren Whether to keep child layers or delete them too
     * @returns Success status
     */
    public deleteGroup(groupId: string, preserveChildren: boolean = true): boolean {
        const group = this.findGroupById(groupId);
        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return false;
        }

        const childLayers = this.getChildLayers(groupId);

        if (preserveChildren) {
            // Move children up to the group's parent (or to root if none)
            childLayers.forEach(child => {
                this.dataModel.updateLayer(child.id, { parentId: group.parentId });
            });
        } else {
            // Delete all children
            childLayers.forEach(child => {
                this.dataModel.removeLayer(child.id);
            });
        }

        // Delete the group itself
        const result = this.dataModel.removeLayer(groupId);

        // Emit event for the deletion
        if (result) {
            this.eventEmitter.emitGroupDeleted(groupId, preserveChildren);
        }

        return result;
    }

    /**
     * Rename a group
     * @param groupId Group layer ID
     * @param newName New group name
     * @returns Success status
     */
    public renameGroup(groupId: string, newName: string): boolean {
        const group = this.findGroupById(groupId);
        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return false;
        }

        // Update the model
        const updatedGroup = this.dataModel.updateLayer(groupId, { name: newName });

        // Emit event for the rename
        if (updatedGroup) {
            this.eventEmitter.emitLayerNameChanged(groupId, newName);
            return true;
        }

        return false;
    }

    /**
     * Toggle group expanded/collapsed state
     * @param groupId Group layer ID
     * @returns Success status
     */
    public toggleGroupExpanded(groupId: string): boolean {
        const group = this.findGroupById(groupId);
        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return false;
        }

        const isExpanded = group.isExpanded !== false;
        const updatedGroup = this.dataModel.updateLayer(groupId, { isExpanded: !isExpanded });

        // Emit event for the toggle
        if (updatedGroup) {
            this.eventEmitter.emitGroupToggle(groupId, !isExpanded);
            return true;
        }

        return false;
    }

    /**
     * Add a layer to a group
     * @param layerId Layer ID
     * @param groupId Group layer ID
     * @returns Success status
     */
    public addLayerToGroup(layerId: string, groupId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);
        const group = this.findGroupById(groupId);

        if (!layer) {
            console.warn(`Layer with ID ${layerId} not found`);
            return false;
        }

        if (!group) {
            console.warn(`Group with ID ${groupId} not found`);
            return false;
        }

        // Check if adding would create a circular reference
        if (this.wouldCreateCircularReference(layerId, groupId)) {
            console.warn('Cannot add layer to group: would create circular reference');
            return false;
        }

        // Update layer's parent
        const updatedLayer = this.dataModel.updateLayer(layerId, { parentId: groupId });

        // Emit event for the addition
        if (updatedLayer) {
            this.eventEmitter.emitLayerUpdated(updatedLayer);
            return true;
        }

        return false;
    }

    /**
     * Remove a layer from its group
     * @param layerId Layer ID
     * @returns Success status
     */
    public removeLayerFromGroup(layerId: string): boolean {
        const layer = this.layers.find(l => l.id === layerId);

        if (!layer) {
            console.warn(`Layer with ID ${layerId} not found`);
            return false;
        }

        if (!layer.parentId) {
            console.warn(`Layer with ID ${layerId} is not in a group`);
            return false;
        }

        // Update layer to remove parent
        const updatedLayer = this.dataModel.updateLayer(layerId, { parentId: undefined });

        // Emit event for the removal
        if (updatedLayer) {
            this.eventEmitter.emitLayerUpdated(updatedLayer);
            this.eventEmitter.emitLayerGroupRemoved(layerId);
            return true;
        }

        return false;
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
        // Update internal state
        // Could implement more complex logic here if needed
    }

    /**
     * Check if adding a layer to a group would create a circular reference
     * @param layerId Layer to add
     * @param groupId Group to add to
     * @returns True if circular reference would be created
     */
    private wouldCreateCircularReference(layerId: string, groupId: string): boolean {
        // Check if the layer is an ancestor of the group
        let currentId = groupId;
        let currentLayer = this.layers.find(l => l.id === currentId);

        while (currentLayer && currentLayer.parentId) {
            if (currentLayer.parentId === layerId) {
                return true;
            }
            currentId = currentLayer.parentId;
            currentLayer = this.layers.find(l => l.id === currentId);
        }

        return false;
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
            // Children will need to be reassigned or deleted
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