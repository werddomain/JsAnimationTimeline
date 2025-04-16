// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\plugins\GroupManagement\GroupManager.ts
import { BaseComponent } from '../../components/base/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { CSS_CLASSES } from '../../utils/Constants';
import { EVENT_TYPES } from '../../utils/EventTypes';
import { Layer } from '../../types';

interface Group {
    id: string;
    name: string;
    layerIds: string[];
    expanded: boolean;
}

interface GroupManagerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter<string>;
}

export class GroupManager extends BaseComponent {
    private eventEmitter: EventEmitter<string>;
    private groups: Group[] = [];
    private layers: Layer[] = [];
    private selectedGroupId: string | null = null;
    public name = 'groupManager';
    public dependencies = [
        { name: 'layerManager', optional: false }
    ];

    constructor(options: GroupManagerOptions) {
        super(options.container, 'group-manager');
        this.eventEmitter = options.eventEmitter;
    }

public initialize(): void {
        this.setupEventListeners();
        
        // Listen for layer-related events
        this.eventEmitter.on(EVENT_TYPES.LAYER_ADDED, this, this.handleLayerAdded);
        this.eventEmitter.on(EVENT_TYPES.LAYER_REMOVED, this, this.handleLayerRemoved);
    }

    public render(): string {
        // This plugin doesn't directly render its own UI
        // It modifies the LayerManager's existing UI
        return '';
    }

    private renderGroupControls(): string {
        return `
            <div class="group-controls">
                <button class="create-group-btn">Create Group</button>
                <div class="group-list">
                    ${this.renderGroupList()}
                </div>
            </div>
        `;
    }

    private renderGroupList(): string {
        if (this.groups.length === 0) {
            return '<div class="no-groups-message">No groups</div>';
        }
        
        return this.groups.map(group => `
            <div class="group-item ${this.selectedGroupId === group.id ? 'selected' : ''}" 
                 data-group-id="${group.id}">
                <div class="group-header">
                    <span class="expand-toggle ${group.expanded ? 'expanded' : 'collapsed'}">
                        ${group.expanded ? '▼' : '►'}
                    </span>
                    <span class="group-name">${group.name}</span>
                    <div class="group-controls">
                        <button class="rename-group-btn" data-group-id="${group.id}">Rename</button>
                        <button class="delete-group-btn" data-group-id="${group.id}">Delete</button>
                    </div>
                </div>
                <div class="group-layers ${group.expanded ? 'expanded' : 'collapsed'}">
                    ${this.renderGroupLayers(group)}
                </div>
            </div>
        `).join('');
    }

    private renderGroupLayers(group: Group): string {
        if (group.layerIds.length === 0) {
            return '<div class="no-layers-message">No layers in this group</div>';
        }
        
        const groupLayers = this.layers.filter(layer => group.layerIds.includes(layer.id));
        
        return groupLayers.map(layer => `
            <div class="group-layer" data-layer-id="${layer.id}">
                ${layer.name}
                <button class="remove-from-group-btn" 
                       data-group-id="${group.id}" 
                       data-layer-id="${layer.id}">
                    Remove
                </button>
            </div>
        `).join('');
    }

    public update(data: { layers: Layer[], groups: Group[] }): void {
        this.layers = data.layers;
        this.groups = data.groups;
        
        // Update the UI if needed
        this.updateGroupUI();
    }

    private updateGroupUI(): void {
        // Find or create the group controls container
        let groupControlsContainer = this.container.querySelector('.group-controls');
        
        if (!groupControlsContainer) {
            // Append the group controls to the layer manager container
            const controlsHTML = this.renderGroupControls();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = controlsHTML;
            this.container.appendChild(tempDiv.firstElementChild as HTMLElement);
            groupControlsContainer = this.container.querySelector('.group-controls');
        } else {
            // Update the existing group controls
            (groupControlsContainer as HTMLElement).innerHTML = this.renderGroupList();
        }
    }

    private setupEventListeners(): void {
        // Delegate events for all group-related buttons
        this.container.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            
            if (target.classList.contains('create-group-btn')) {
                this.createGroup();
            } else if (target.classList.contains('rename-group-btn')) {
                const groupId = target.dataset.groupId;
                if (groupId) this.promptRenameGroup(groupId);
            } else if (target.classList.contains('delete-group-btn')) {
                const groupId = target.dataset.groupId;
                if (groupId) this.deleteGroup(groupId);
            } else if (target.classList.contains('remove-from-group-btn')) {
                const groupId = target.dataset.groupId;
                const layerId = target.dataset.layerId;
                if (groupId && layerId) this.removeLayerFromGroup(groupId, layerId);
            } else if (target.classList.contains('expand-toggle')) {
                const groupItem = target.closest('.group-item') as HTMLElement;
                if (groupItem) {
                    const groupId = groupItem.dataset.groupId;
                    if (groupId) this.toggleGroupExpanded(groupId);
                }
            }
        });
        
        // Custom context menu for adding layers to groups
        this.container.addEventListener('contextmenu', (event) => {
            const target = event.target as HTMLElement;
            const layerItem = target.closest('.layer-item') as HTMLElement;
            
            if (layerItem) {
                event.preventDefault();
                const layerId = layerItem.dataset.layerId;
                if (layerId) {
                    this.showAddToGroupMenu(layerId, event.clientX, event.clientY);
                }
            }
        });
    }
    
    private createGroup(): void {
        const groupId = 'group_' + Date.now();
        const groupName = `Group ${this.groups.length + 1}`;
        
        const newGroup: Group = {
            id: groupId,
            name: groupName,
            layerIds: [],
            expanded: true
        };
        
        this.groups.push(newGroup);
        this.updateGroupUI();
        
        // Emit an event if needed
        // this.eventEmitter.emit('groupCreated', { group: newGroup });
    }
    
    private promptRenameGroup(groupId: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        const newName = prompt(`Rename group "${group.name}" to:`, group.name);
        if (newName !== null && newName.trim() !== '') {
            this.renameGroup(groupId, newName);
        }
    }
    
    private renameGroup(groupId: string, newName: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.name = newName;
            this.updateGroupUI();
            
            // Emit an event if needed
            // this.eventEmitter.emit('groupRenamed', { groupId, newName });
        }
    }
    
    private deleteGroup(groupId: string): void {
        this.groups = this.groups.filter(group => group.id !== groupId);
        this.updateGroupUI();
        
        // Emit an event if needed
        // this.eventEmitter.emit('groupDeleted', { groupId });
    }
    
    private toggleGroupExpanded(groupId: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.expanded = !group.expanded;
            this.updateGroupUI();
        }
    }
    
    private addLayerToGroup(groupId: string, layerId: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (group && !group.layerIds.includes(layerId)) {
            group.layerIds.push(layerId);
            this.updateGroupUI();
            
            // Emit an event if needed
            // this.eventEmitter.emit('layerAddedToGroup', { groupId, layerId });
        }
    }
    
    private removeLayerFromGroup(groupId: string, layerId: string): void {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.layerIds = group.layerIds.filter(id => id !== layerId);
            this.updateGroupUI();
            
            // Emit an event if needed
            // this.eventEmitter.emit('layerRemovedFromGroup', { groupId, layerId });
        }
    }
    
    private showAddToGroupMenu(layerId: string, x: number, y: number): void {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.group-context-menu');
        if (existingMenu) {
            document.body.removeChild(existingMenu);
        }
        
        // Create the context menu
        const menuHTML = `
            <div class="group-context-menu" style="left: ${x}px; top: ${y}px;">
                <div class="menu-title">Add to Group</div>
                ${this.groups.length === 0 ? 
                    '<div class="no-groups-menu-item">No groups available</div>' : 
                    this.groups.map(group => `
                        <div class="menu-item add-to-group-item" 
                             data-group-id="${group.id}" 
                             data-layer-id="${layerId}">
                            ${group.name}
                        </div>
                    `).join('')
                }
                <div class="menu-item create-group-item">Create new group</div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = menuHTML;
        const menuEl = tempDiv.firstElementChild as HTMLElement;
        document.body.appendChild(menuEl);
        
        // Set up event listeners for the menu
        menuEl.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            
            if (target.classList.contains('add-to-group-item')) {
                const groupId = target.dataset.groupId;
                const layerId = target.dataset.layerId;
                if (groupId && layerId) {
                    this.addLayerToGroup(groupId, layerId);
                }
            } else if (target.classList.contains('create-group-item')) {
                const newGroupId = 'group_' + Date.now();
                const newGroupName = `Group ${this.groups.length + 1}`;
                
                const newGroup: Group = {
                    id: newGroupId,
                    name: newGroupName,
                    layerIds: [layerId],
                    expanded: true
                };
                
                this.groups.push(newGroup);
                this.updateGroupUI();
            }
            
            // Remove the menu
            document.body.removeChild(menuEl);
        });
        
        // Close the menu when clicking outside
        document.addEventListener('click', function closeMenu(e) {
            if (!menuEl.contains(e.target as Node)) {
                document.body.removeChild(menuEl);
                document.removeEventListener('click', closeMenu);
            }
        });
    }
    
    private handleLayerAdded(data: { layer: Layer }): void {
        if (!this.layers.some(l => l.id === data.layer.id)) {
            this.layers.push(data.layer);
        }
    }
    
    private handleLayerRemoved(data: { layerId: string }): void {
        this.layers = this.layers.filter(layer => layer.id !== data.layerId);
        
        // Also remove the layer from any groups it's in
        for (const group of this.groups) {
            group.layerIds = group.layerIds.filter(id => id !== data.layerId);
        }
        
        this.updateGroupUI();
    }

    public destroy(): void {
        // Clean up event listeners
        this.eventEmitter.off(EVENT_TYPES.LAYER_ADDED, this.handleLayerAdded);
        this.eventEmitter.off(EVENT_TYPES.LAYER_REMOVED, this.handleLayerRemoved);
    }
}
