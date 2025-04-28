/**
 * GroupManager plugin
 * Manages layer groups and hierarchy
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel, ILayer } from '../core/DataModel';
import { Events, CssClasses } from '../constants/Constants';

export interface IGroup {
    id: string;
    name: string;
    expanded: boolean;
    layerIds: string[];
}

export interface IGroupManagerOptions {
    container: HTMLElement;
    dataModel: DataModel;
    eventEmitter: EventEmitter;
    timelineControl?: any; // Reference to TimelineControl
}

export class GroupManager extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private timelineControl: any; // Reference to TimelineControl
    private groups: Map<string, IGroup> = new Map();
    
    /**
     * Constructor for GroupManager
     * @param options - Configuration options
     */    constructor(options: IGroupManagerOptions) {
        super(options.container, 'timeline-groups-manager');
        
        this.dataModel = options.dataModel;
        this.eventEmitter = options.eventEmitter;
        this.timelineControl = options.timelineControl;
    }
    
    /**
     * Initialize the GroupManager component
     */
    public initialize(): void {
        // Set up event listeners
        this.eventEmitter.on(Events.LAYER_ADDED, this.handleLayerAdded.bind(this));
        this.eventEmitter.on(Events.LAYER_REMOVED, this.handleLayerRemoved.bind(this));
        this.eventEmitter.on(Events.GROUP_CREATED, this.handleGroupCreated.bind(this));
        this.eventEmitter.on(Events.GROUP_REMOVED, this.handleGroupRemoved.bind(this));
        this.eventEmitter.on(Events.GROUP_EXPANDED, this.handleGroupExpanded.bind(this));
        this.eventEmitter.on(Events.GROUP_COLLAPSED, this.handleGroupCollapsed.bind(this));
    }
    
    /**
     * Render the GroupManager component
     * @returns HTML string representation
     */
    public render(): string {
        return `<div class="timeline-groups-manager"></div>`;
    }
    
    /**
     * Update the GroupManager component
     * @param data - New data for the component
     */
    public update(data?: any): void {
        // The GroupManager doesn't have its own UI elements
        // It adds group indicators to the LayerManager's layers
    }
    
    /**
     * Destroy the GroupManager component and clean up resources
     */
    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.LAYER_ADDED, this.handleLayerAdded.bind(this));
        this.eventEmitter.off(Events.LAYER_REMOVED, this.handleLayerRemoved.bind(this));
        this.eventEmitter.off(Events.GROUP_CREATED, this.handleGroupCreated.bind(this));
        this.eventEmitter.off(Events.GROUP_REMOVED, this.handleGroupRemoved.bind(this));
        this.eventEmitter.off(Events.GROUP_EXPANDED, this.handleGroupExpanded.bind(this));
        this.eventEmitter.off(Events.GROUP_COLLAPSED, this.handleGroupCollapsed.bind(this));
        
        // Clear groups
        this.groups.clear();
    }
    
    /**
     * Create a group
     * @param name - Group name
     * @param layerIds - IDs of layers to include in the group
     * @returns Group ID
     */
    public createGroup(name: string, layerIds: string[]): string {
        const groupId = `group-${Date.now()}`;
        
        // Create group
        const group: IGroup = {
            id: groupId,
            name,
            expanded: true,
            layerIds: [...layerIds]
        };
        
        this.groups.set(groupId, group);
        
        // Update layers
        layerIds.forEach(layerId => {
            const layer = this.dataModel.getLayer(layerId);
            if (layer) {
                this.dataModel.updateLayer(layerId, { groupId });
            }
        });
        
        // Emit event
        this.eventEmitter.emit(Events.GROUP_CREATED, {
            groupId,
            name
        }, this);
        
        return groupId;
    }
    
    /**
     * Remove a group
     * @param groupId - Group ID
     */
    public removeGroup(groupId: string): void {
        const group = this.groups.get(groupId);
        
        if (!group) return;
        
        // Update layers
        group.layerIds.forEach(layerId => {
            const layer = this.dataModel.getLayer(layerId);
            if (layer && layer.groupId === groupId) {
                this.dataModel.updateLayer(layerId, { groupId: undefined });
            }
        });
        
        // Remove group
        this.groups.delete(groupId);
        
        // Emit event
        this.eventEmitter.emit(Events.GROUP_REMOVED, {
            groupId,
            name: group.name
        }, this);
    }
    
    /**
     * Add a layer to a group
     * @param groupId - Group ID
     * @param layerId - Layer ID
     */
    public addLayerToGroup(groupId: string, layerId: string): void {
        const group = this.groups.get(groupId);
        const layer = this.dataModel.getLayer(layerId);
        
        if (!group || !layer) return;
        
        // Remove from previous group
        if (layer.groupId && layer.groupId !== groupId) {
            this.removeLayerFromGroup(layer.groupId, layerId);
        }
        
        // Add to group
        if (!group.layerIds.includes(layerId)) {
            group.layerIds.push(layerId);
            this.dataModel.updateLayer(layerId, { groupId });
        }
    }
    
    /**
     * Remove a layer from a group
     * @param groupId - Group ID
     * @param layerId - Layer ID
     */
    public removeLayerFromGroup(groupId: string, layerId: string): void {
        const group = this.groups.get(groupId);
        
        if (!group) return;
        
        // Remove from group
        const index = group.layerIds.indexOf(layerId);
        if (index !== -1) {
            group.layerIds.splice(index, 1);
            
            const layer = this.dataModel.getLayer(layerId);
            if (layer && layer.groupId === groupId) {
                this.dataModel.updateLayer(layerId, { groupId: undefined });
            }
            
            // If group is empty, remove it
            if (group.layerIds.length === 0) {
                this.removeGroup(groupId);
            }
        }
    }
    
    /**
     * Expand a group
     * @param groupId - Group ID
     */
    public expandGroup(groupId: string): void {
        const group = this.groups.get(groupId);
        
        if (!group || group.expanded) return;
        
        // Expand group
        group.expanded = true;
        
        // Emit event
        this.eventEmitter.emit(Events.GROUP_EXPANDED, {
            groupId,
            name: group.name
        }, this);
    }
    
    /**
     * Collapse a group
     * @param groupId - Group ID
     */
    public collapseGroup(groupId: string): void {
        const group = this.groups.get(groupId);
        
        if (!group || !group.expanded) return;
        
        // Collapse group
        group.expanded = false;
        
        // Emit event
        this.eventEmitter.emit(Events.GROUP_COLLAPSED, {
            groupId,
            name: group.name
        }, this);
    }
    
    /**
     * Rename a group
     * @param groupId - Group ID
     * @param name - New group name
     */
    public renameGroup(groupId: string, name: string): void {
        const group = this.groups.get(groupId);
        
        if (!group) return;
        
        // Rename group
        group.name = name;
    }
    
    /**
     * Get all groups
     * @returns Map of group IDs to group objects
     */
    public getGroups(): Map<string, IGroup> {
        return this.groups;
    }
    
    /**
     * Get a specific group
     * @param groupId - Group ID
     * @returns Group object if found, undefined otherwise
     */
    public getGroup(groupId: string): IGroup | undefined {
        return this.groups.get(groupId);
    }
    
    /**
     * Check if a group is expanded
     * @param groupId - Group ID
     * @returns True if expanded, false otherwise
     */
    public isGroupExpanded(groupId: string): boolean {
        const group = this.groups.get(groupId);
        return group ? group.expanded : false;
    }
    
    /**
     * Get the group for a layer
     * @param layerId - Layer ID
     * @returns Group object if found, undefined otherwise
     */
    public getGroupForLayer(layerId: string): IGroup | undefined {
        const layer = this.dataModel.getLayer(layerId);
        
        if (!layer || !layer.groupId) return undefined;
        
        return this.groups.get(layer.groupId);
    }
    
    /**
     * Handle layer added event
     * @param event - Layer added event
     */
    private handleLayerAdded(event: any): void {
        // Nothing to do here
    }
    
    /**
     * Handle layer removed event
     * @param event - Layer removed event
     */
    private handleLayerRemoved(event: any): void {
        const layer = event.data as ILayer;
        
        if (layer.groupId) {
            this.removeLayerFromGroup(layer.groupId, layer.id);
        }
    }
    
    /**
     * Handle group created event
     * @param event - Group created event
     */
    private handleGroupCreated(event: any): void {
        // Nothing to do here
    }
    
    /**
     * Handle group removed event
     * @param event - Group removed event
     */
    private handleGroupRemoved(event: any): void {
        // Nothing to do here
    }
    
    /**
     * Handle group expanded event
     * @param event - Group expanded event
     */
    private handleGroupExpanded(event: any): void {
        // Nothing to do here
    }
    
    /**
     * Handle group collapsed event
     * @param event - Group collapsed event
     */
    private handleGroupCollapsed(event: any): void {
        // Nothing to do here
    }
}
