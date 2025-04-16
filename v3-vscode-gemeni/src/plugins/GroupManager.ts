import { BaseComponent } from '@core/BaseComponent';
import { DataModel } from '@core/DataModel';
import { EventEmitter } from '@core/EventEmitter';
import { Events, GroupData } from '@utils/EventTypes';

/**
 * Options for initializing the GroupManager
 */
export interface GroupManagerOptions {
    container: HTMLElement;
    id?: string;
}

/**
 * GroupManager plugin that manages layer grouping and hierarchy
 */
export class GroupManager extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    
    // Plugin metadata
    public metadata = {
        name: 'GroupManager',
        version: '1.0.0',
        dependencies: [
            { name: 'LayerManager' }
        ]
    };

    /**
     * Constructor for GroupManager
     * @param options Options for initializing the group manager
     */
    constructor(options: GroupManagerOptions) {
        super(options.container, options.id || 'timeline-group-manager');
        this.dataModel = DataModel.getInstance();
        this.eventEmitter = EventEmitter.getInstance();
    }

    /**
     * Initialize the group manager
     */
    public initialize(): void {
        // Listen for events
        this.eventEmitter.on(Events.GROUP_ADDED, this.handleGroupAdded, this);
        this.eventEmitter.on(Events.GROUP_REMOVED, this.handleGroupRemoved, this);
        this.eventEmitter.on(Events.GROUP_RENAMED, this.handleGroupRenamed, this);
        this.eventEmitter.on(Events.LAYER_ADDED, this.handleLayerAdded, this);
        this.eventEmitter.on(Events.LAYER_REMOVED, this.handleLayerRemoved, this);
    }

    /**
     * Render the group manager
     * @returns HTML string for the group manager
     */
    public render(): string {
        // The group manager doesn't have its own UI - it augments the layer manager
        return `<div id="${this.id}" style="display: none;"></div>`;
    }

    /**
     * Update the group manager with new data
     * @param data The data to update with
     */
    public update(data: any): void {
        // The group manager doesn't have its own UI to update
    }

    /**
     * Clean up the group manager
     */
    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.GROUP_ADDED, this.handleGroupAdded);
        this.eventEmitter.off(Events.GROUP_REMOVED, this.handleGroupRemoved);
        this.eventEmitter.off(Events.GROUP_RENAMED, this.handleGroupRenamed);
        this.eventEmitter.off(Events.LAYER_ADDED, this.handleLayerAdded);
        this.eventEmitter.off(Events.LAYER_REMOVED, this.handleLayerRemoved);
    }

    /**
     * Handle group added event
     */
    private handleGroupAdded = (sender: any, data: { group: GroupData }): void => {
        // Notify the layer manager to update its display
        this.eventEmitter.emit(Events.LAYER_REORDERED, this, {
            layerId: "",  // Not needed for full refresh
            newIndex: 0   // Not needed for full refresh
        });
    };

    /**
     * Handle group removed event
     */
    private handleGroupRemoved = (sender: any, data: { groupId: string }): void => {
        // Notify the layer manager to update its display
        this.eventEmitter.emit(Events.LAYER_REORDERED, this, {
            layerId: "",  // Not needed for full refresh
            newIndex: 0   // Not needed for full refresh
        });
    };

    /**
     * Handle group renamed event
     */
    private handleGroupRenamed = (sender: any, data: { groupId: string, name: string }): void => {
        // Notify the layer manager to update its display
        this.eventEmitter.emit(Events.LAYER_REORDERED, this, {
            layerId: "",  // Not needed for full refresh
            newIndex: 0   // Not needed for full refresh
        });
    };

    /**
     * Handle layer added event
     */
    private handleLayerAdded = (sender: any, data: any): void => {
        // Nothing to do here - layer manager handles the display
    };

    /**
     * Handle layer removed event
     */
    private handleLayerRemoved = (sender: any, data: any): void => {
        // Nothing to do here - layer manager handles the display
    };

    /**
     * Add a new group
     * @param name The name of the group
     * @returns The added group data
     */
    public addGroup(name: string): GroupData {
        const groupId = `group-${Date.now()}`;
        return this.dataModel.addGroup({
            id: groupId,
            name: name,
            isExpanded: true
        }, this);
    }

    /**
     * Remove a group
     * @param groupId The ID of the group to remove
     */
    public removeGroup(groupId: string): void {
        this.dataModel.removeGroup(groupId, this);
    }

    /**
     * Rename a group
     * @param groupId The ID of the group to rename
     * @param name The new name for the group
     */
    public renameGroup(groupId: string, name: string): void {
        const group = this.dataModel.getGroups().find(g => g.id === groupId);
        if (group) {
            group.name = name;
            this.eventEmitter.emit(Events.GROUP_RENAMED, this, { groupId, name });
        }
    }

    /**
     * Add a layer to a group
     * @param layerId The ID of the layer to add to the group
     * @param groupId The ID of the group to add the layer to
     */
    public addLayerToGroup(layerId: string, groupId: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (layer) {
            layer.groupId = groupId;
            // Notify layer manager to update its display
            this.eventEmitter.emit(Events.LAYER_REORDERED, this, {
                layerId: "",  // Not needed for full refresh
                newIndex: 0   // Not needed for full refresh
            });
        }
    }

    /**
     * Remove a layer from its group
     * @param layerId The ID of the layer to remove from its group
     */
    public removeLayerFromGroup(layerId: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (layer && layer.groupId) {
            layer.groupId = undefined;
            // Notify layer manager to update its display
            this.eventEmitter.emit(Events.LAYER_REORDERED, this, {
                layerId: "",  // Not needed for full refresh
                newIndex: 0   // Not needed for full refresh
            });
        }
    }

    /**
     * Toggle a group's expanded state
     * @param groupId The ID of the group to toggle
     */
    public toggleGroupExpanded(groupId: string): void {
        const group = this.dataModel.getGroups().find(g => g.id === groupId);
        if (group) {
            group.isExpanded = !group.isExpanded;
            // Notify layer manager to update its display
            this.eventEmitter.emit(Events.LAYER_REORDERED, this, {
                layerId: "",  // Not needed for full refresh
                newIndex: 0   // Not needed for full refresh
            });
        }
    }
}
