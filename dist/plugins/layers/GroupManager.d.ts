/**
 * Group Manager
 * Manages layer groups in the timeline
 */
import { Component } from '../../core/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { Layer, TimelineDataModel } from '../../core/DataModel';
export interface GroupManagerOptions {
    eventEmitter: EventEmitter;
    dataModel: TimelineDataModel;
}
export declare class GroupManager extends Component {
    private eventEmitter;
    private dataModel;
    private options;
    private layers;
    constructor(container: HTMLElement, options: GroupManagerOptions);
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Update the layers array
     * @param layers Updated layers array
     */
    update(layers: Layer[]): void;
    /**
     * Render component HTML
     */
    render(): string;
    /**
     * Create a new group from selected layers
     * @param groupName Name for the new group
     * @param selectedLayerIds IDs of layers to include in the group
     * @returns The new group layer ID
     */
    createGroup(groupName: string, selectedLayerIds: string[]): string | null;
    /**
     * Delete a group
     * @param groupId Group layer ID
     * @param preserveChildren Whether to keep child layers or delete them too
     * @returns Success status
     */
    deleteGroup(groupId: string, preserveChildren?: boolean): boolean;
    /**
     * Rename a group
     * @param groupId Group layer ID
     * @param newName New group name
     * @returns Success status
     */
    renameGroup(groupId: string, newName: string): boolean;
    /**
     * Toggle group expanded/collapsed state
     * @param groupId Group layer ID
     * @returns Success status
     */
    toggleGroupExpanded(groupId: string): boolean;
    /**
     * Add a layer to a group
     * @param layerId Layer ID
     * @param groupId Group layer ID
     * @returns Success status
     */
    addLayerToGroup(layerId: string, groupId: string): boolean;
    /**
     * Remove a layer from its group
     * @param layerId Layer ID
     * @returns Success status
     */
    removeLayerFromGroup(layerId: string): boolean;
    /**
     * Check if a layer is a group
     * @param layer Layer to check
     * @returns True if the layer is a group
     */
    isGroup(layer: Layer): boolean;
    /**
     * Get all child layers of a group
     * @param groupId Group layer ID
     * @returns Array of child layers
     */
    getChildLayers(groupId: string): Layer[];
    /**
     * Get a layer's parent group
     * @param layerId Layer ID
     * @returns Parent group or null if not in a group
     */
    getParentGroup(layerId: string): Layer | null;
    /**
     * Find a group layer by ID
     * @param groupId Group layer ID
     * @returns Group layer or undefined
     */
    private findGroupById;
    /**
     * Update group structure after changes
     */
    private updateGroupStructure;
    /**
     * Check if adding a layer to a group would create a circular reference
     * @param layerId Layer to add
     * @param groupId Group to add to
     * @returns True if circular reference would be created
     */
    private wouldCreateCircularReference;
    /**
     * Handle layer added event
     * @param layer Added layer
     */
    private handleLayerAdded;
    /**
     * Handle layer removed event
     * @param layerId Removed layer ID
     */
    private handleLayerRemoved;
    /**
     * Handle layer updated event
     * @param layer Updated layer
     */
    private handleLayerUpdated;
    /**
     * Get all top-level groups (groups that aren't children of other groups)
     * @returns Array of top-level group layers
     */
    getTopLevelGroups(): Layer[];
    /**
     * Get all layers in a flat structure with proper indentation level
     * @returns Array of layers with their indentation level
     */
    getLayersWithIndentation(): {
        layer: Layer;
        indentLevel: number;
    }[];
    /**
     * Add a layer and its children to the result array
     * @param layer Layer to add
     * @param indentLevel Current indentation level
     * @param result Result array
     */
    private addLayerWithChildren;
    /**
     * Clean up
     */
    destroy(): void;
}
