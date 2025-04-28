/**
 * LayerManager plugin
 * Handles layer list management, selection, renaming, and reordering
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel, ILayer } from '../core/DataModel';
import { Events, CssClasses } from '../constants/Constants';

export interface ILayerManagerOptions {
    container: HTMLElement;
    dataModel: DataModel;
    eventEmitter: EventEmitter;
    timelineControl?: any; // Reference to TimelineControl
}

export class LayerManager extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private timelineControl: any; // Reference to TimelineControl
    private dragLayerIndex: number | null = null;
    private dragLayerElement: HTMLElement | null = null;
    private dragStartY: number = 0;
    
    /**
     * Constructor for LayerManager
     * @param options - Configuration options
     */
    constructor(options: ILayerManagerOptions) {
        super(options.container, 'timeline-layer-manager');
        
        this.dataModel = options.dataModel;
        this.eventEmitter = options.eventEmitter;
        this.timelineControl = options.timelineControl;
    }
    
    /**
     * Initialize the LayerManager component
     */    public initialize(): void {
        console.log('Initializing LayerManager...');
        
        if (!this.element) {
            console.error('LayerManager element not found. Make sure to call mount() before initialize()');
            return;
        }
        
        console.log('LayerManager element:', this.element);
        console.log('LayerManager container:', this.container);
        
        // Set up event listeners for model changes
        this.eventEmitter.on(Events.LAYER_ADDED, this.handleLayerAdded.bind(this));
        this.eventEmitter.on(Events.LAYER_REMOVED, this.handleLayerRemoved.bind(this));
        this.eventEmitter.on(Events.LAYER_MOVED, this.handleLayerMoved.bind(this));
        this.eventEmitter.on(Events.LAYER_RENAMED, this.handleLayerRenamed.bind(this));
        this.eventEmitter.on(Events.LAYER_SELECTED, this.handleLayerSelected.bind(this));
        this.eventEmitter.on(Events.LAYER_DESELECTED, this.handleLayerDeselected.bind(this));
        
        // Find the layers toolbar in the DOM
        const layersContainer = this.container.closest(`.${CssClasses.TIMELINE_LAYERS_CONTAINER}`);
        const toolbar = layersContainer?.querySelector(`.${CssClasses.TIMELINE_LAYERS_TOOLBAR}`);
        
        console.log('Found layers container:', layersContainer);
        console.log('Found toolbar:', toolbar);
        
        if (toolbar) {
            console.log('Setting up toolbar buttons...');
            toolbar.innerHTML = this.renderToolbar();
            this.setupToolbarEventListeners(toolbar);
        } else {
            console.error('Layers toolbar not found');
        }
        
        // Force an update to render any existing layers
        this.update();
        
        console.log('LayerManager initialized successfully');
    }
      /**
     * Render the LayerManager component
     * @returns HTML string representation
     */
    public render(): string {
        const layers = this.dataModel.getLayers();
        const layersArray = Object.values(layers).sort((a, b) => a.order - b.order);
        
        // Return just the content without wrapping it in another div
        // since the container is already the timeline-layer-list
        return layersArray.map(layer => this.renderLayer(layer)).join('');
    }
      /**
     * Update the LayerManager component
     * @param data - New data for the component
     */
    public update(data?: any): void {
        if (!this.element) {
            throw new Error('LayerManager element not created. Make sure to call mount() before update().');
        }
        
        console.log('LayerManager update called. Current layers:', Object.keys(this.dataModel.getLayers()).length);
        
        // Re-render the entire layer list
        this.element.innerHTML = this.render();
        
        // Set up event listeners for layer elements
        this.setupLayerEventListeners();
        
        console.log('LayerManager update completed. DOM updated with layers.');
    }
    
    /**
     * Destroy the LayerManager component and clean up resources
     */
    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.LAYER_ADDED, this.handleLayerAdded.bind(this));
        this.eventEmitter.off(Events.LAYER_REMOVED, this.handleLayerRemoved.bind(this));
        this.eventEmitter.off(Events.LAYER_MOVED, this.handleLayerMoved.bind(this));
        this.eventEmitter.off(Events.LAYER_RENAMED, this.handleLayerRenamed.bind(this));
        this.eventEmitter.off(Events.LAYER_SELECTED, this.handleLayerSelected.bind(this));
        this.eventEmitter.off(Events.LAYER_DESELECTED, this.handleLayerDeselected.bind(this));
    }
    
    /**
     * Render the toolbar with layer controls
     * @returns HTML string representation of toolbar
     */
    private renderToolbar(): string {
        return `
            <button class="timeline-button add-layer-btn" title="Add Layer">
                <span class="timeline-icon">+</span>
            </button>
            <button class="timeline-button remove-layer-btn" title="Remove Layer">
                <span class="timeline-icon">-</span>
            </button>
            <button class="timeline-button group-layers-btn" title="Group Layers">
                <span class="timeline-icon">G</span>
            </button>
            <button class="timeline-button ungroup-layers-btn" title="Ungroup Layers">
                <span class="timeline-icon">UG</span>
            </button>
        `;
    }
    
    /**
     * Render a single layer row
     * @param layer - Layer to render
     * @returns HTML string representation of layer row
     */
    private renderLayer(layer: ILayer): string {
        const selectedClass = this.dataModel.getSelectedLayerIds().includes(layer.id) ? 
            CssClasses.LAYER_SELECTED : '';
        const visibleClass = layer.visible ? CssClasses.LAYER_VISIBLE : '';
        const lockedClass = layer.locked ? CssClasses.LAYER_LOCKED : '';
        
        return `
            <div class="${CssClasses.LAYER_ROW} ${selectedClass} ${visibleClass} ${lockedClass}"
                data-layer-id="${layer.id}" 
                data-layer-index="${layer.order}">
                <div class="layer-drag-handle" title="Drag to Reorder">
                    <span class="timeline-icon">⋮⋮</span>
                </div>
                 <div class="layer-name">${layer.name}</div>
 <div class="layer-color" style="background-color: ${layer.color}"></div>

                <div class="layer-visibility-toggle" title="Toggle Visibility">
                    <span class="timeline-icon">${layer.visible ? '👁️' : '👁️‍🗨️'}</span>
                </div>
<div class="layer-lock-toggle" title="Toggle Lock">
                    <span class="timeline-icon">${layer.locked ? '🔒' : '🔓'}</span>
                </div>                
               
               
                
            </div>
        `;
    }
    
    /**
     * Set up event listeners for toolbar buttons
     * @param toolbar - Toolbar element
     */    private setupToolbarEventListeners(toolbar: Element): void {
        const addLayerBtn = toolbar.querySelector('.add-layer-btn');
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', this.handleAddLayerClick.bind(this));
        }
        
        const removeLayerBtn = toolbar.querySelector('.remove-layer-btn');
        if (removeLayerBtn) {
            removeLayerBtn.addEventListener('click', this.handleRemoveLayerClick.bind(this));
        }
        
        const groupLayersBtn = toolbar.querySelector('.group-layers-btn');
        if (groupLayersBtn) {
            groupLayersBtn.addEventListener('click', this.handleGroupLayersClick.bind(this));
        }
        
        const ungroupLayersBtn = toolbar.querySelector('.ungroup-layers-btn');
        if (ungroupLayersBtn) {
            ungroupLayersBtn.addEventListener('click', this.handleUngroupLayersClick.bind(this));
        }
    }
    
    /**
     * Set up event listeners for layer elements
     */
    private setupLayerEventListeners(): void {
        if (!this.element) return;
        
        // Add click handler for layers (selection)        
        const layerRows = this.element.querySelectorAll(`.${CssClasses.LAYER_ROW}`);
        layerRows.forEach(row => {
            row.addEventListener('click', this.handleLayerClick.bind(this));
            
            // Double click for rename
            row.addEventListener('dblclick', this.handleLayerDoubleClick.bind(this));
            
            // Right click for context menu
            row.addEventListener('contextmenu', this.handleLayerContextMenu.bind(this));
            
            // Visibility toggle
            const visibilityToggle = row.querySelector('.layer-visibility-toggle');
            if (visibilityToggle) {
                visibilityToggle.addEventListener('click', (e: Event) => {
                    e.stopPropagation();
                    this.handleVisibilityToggleClick(e as MouseEvent);
                });
            }
            
            // Lock toggle
            const lockToggle = row.querySelector('.layer-lock-toggle');
            if (lockToggle) {
                lockToggle.addEventListener('click', (e: Event) => {
                    e.stopPropagation();
                    this.handleLockToggleClick(e as MouseEvent);
                });
            }
            
            // Color swatch click
            const colorSwatch = row.querySelector('.layer-color');
            if (colorSwatch) {
                colorSwatch.addEventListener('click', (e: Event) => {
                    e.stopPropagation();
                    this.handleColorSwatchClick(e as MouseEvent);
                });
            }
            
            // Drag handle
            const dragHandle = row.querySelector('.layer-drag-handle');
            if (dragHandle) {
                dragHandle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.handleDragHandleMouseDown(e as MouseEvent);
                });
            }
        });
        
        // Global mouse events for drag and drop
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
      /**
     * Handle click on add layer button
     */    private handleAddLayerClick = (): void => {
        // Use the centralized addLayer method if available
        if (this.timelineControl && typeof this.timelineControl.addLayer === 'function') {
            // Let TimelineControl handle the layer creation, event emission and UI updates
            this.timelineControl.addLayer();
        } else {
            // Fallback to the old implementation if TimelineControl is not available
            console.warn('TimelineControl not available, using direct layer creation');
            
            // Generate a unique ID with timestamp and random number
            const timestamp = Date.now();
            const randomNum = Math.floor(Math.random() * 10000);
            const layerId = `layer-${timestamp}-${randomNum}`;
            
            // Generate a random color but ensure it's reasonably bright (not too dark)
            const getRandomColorComponent = () => Math.floor(Math.random() * 156) + 100; // 100-255
            const color = `rgb(${getRandomColorComponent()}, ${getRandomColorComponent()}, ${getRandomColorComponent()})`;
            
            // Calculate layer order (put new layer at the top)
            const layerCount = this.dataModel.getLayerCount();
            
            // Create a new layer
            const newLayer: ILayer = {
                id: layerId,
                name: `Layer ${layerCount + 1}`,
                order: layerCount,
                visible: true,
                locked: false,
                color: color,
                keyframes: {},
                parent: null
            };
            
            // Add the layer to the data model
            this.dataModel.addLayer(newLayer);
            
            // Select the new layer
            this.dataModel.clearLayerSelection();
            this.dataModel.selectLayer(layerId);
            
            console.log('Added new layer:', newLayer);
        }
    }
      /**
     * Handle click on remove layer button
     */
    private handleRemoveLayerClick = (): void => {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        
        if (selectedLayerIds.length === 0) {
            console.warn('No layers selected for removal');
            return;
        }
        
        console.log(`Removing ${selectedLayerIds.length} layer(s)...`);
        
        // Create a copy of the array since we'll be modifying the original during iteration
        const layersToRemove = [...selectedLayerIds];
        
        // Remove each selected layer
        layersToRemove.forEach(layerId => {
            const layer = this.dataModel.getLayer(layerId);
            if (layer) {
                console.log(`Removing layer: ${layer.name} (${layerId})`);
                this.dataModel.removeLayer(layerId);
            }
        });
        
        // Make sure we update the UI
        this.update();
    }
      /**
     * Handle click on group layers button
     */    private handleGroupLayersClick = (): void => {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        
        if (selectedLayerIds.length < 2) {
            console.warn('Need at least 2 layers to create a group');
            return;
        }
        
        console.log(`Creating group with ${selectedLayerIds.length} layers...`);
        
        // Group properties
        const layerCount = this.dataModel.getLayerCount();
        const groupName = `Group ${layerCount + 1}`;
        
        let groupLayer: ILayer;
        
        // Use centralized addLayer if available
        if (this.timelineControl && typeof this.timelineControl.addLayer === 'function') {
            groupLayer = this.timelineControl.addLayer({
                name: groupName,
                order: layerCount,
                color: '#CCCCCC', // Standard gray color for groups
                isGroup: true,
                children: []
            });
        } else {
            // Fallback to direct creation
            // Generate a unique ID with timestamp and random number
            const timestamp = Date.now();
            const randomNum = Math.floor(Math.random() * 10000);
            const groupId = `group-${timestamp}-${randomNum}`;
            
            // Create a new group layer
            groupLayer = {
                id: groupId,
                name: groupName,
                order: layerCount,
                visible: true,
                locked: false,
                color: '#CCCCCC', // Standard gray color for groups
                keyframes: {},
                parent: null,
                isGroup: true,
                children: []
            };
            
            // Add the group layer first
            this.dataModel.addLayer(groupLayer);
        }
        
        console.log(`Created new group: ${groupLayer.name} (${groupLayer.id})`);
        
        // Move selected layers into the group
        selectedLayerIds.forEach(layerId => {
            const layer = this.dataModel.getLayer(layerId);
            if (layer) {
                console.log(`Moving layer ${layer.name} to group ${groupLayer.name}`);
                this.dataModel.setLayerParent(layerId, groupLayer.id);
            }
        });
          // Select the new group
        this.dataModel.clearLayerSelection();
        this.dataModel.selectLayer(groupLayer.id);
        
        // Make sure we update the UI
        this.update();
    }
      /**
     * Handle click on ungroup layers button
     */
    private handleUngroupLayersClick = (): void => {
        const selectedLayerIds = this.dataModel.getSelectedLayerIds();
        
        if (selectedLayerIds.length === 0) {
            console.warn('No groups selected for ungrouping');
            return;
        }
        
        let ungroupedAny = false;
        
        // For each selected group layer, ungroup its children
        selectedLayerIds.forEach(layerId => {
            const layer = this.dataModel.getLayer(layerId);
            
            if (layer?.isGroup && layer.children && layer.children.length > 0) {
                console.log(`Ungrouping ${layer.name} with ${layer.children.length} children`);
                
                // Keep track of child IDs before we start modifying the group
                const childIds = [...layer.children];
                
                // Move all children out of the group
                childIds.forEach((childId: string) => {
                    const childLayer = this.dataModel.getLayer(childId);
                    if (childLayer) {
                        console.log(`Removing ${childLayer.name} from group ${layer.name}`);
                        this.dataModel.setLayerParent(childId, null);
                    }
                });
                
                // Remove the group layer
                console.log(`Removing group: ${layer.name} (${layerId})`);
                this.dataModel.removeLayer(layerId);
                
                ungroupedAny = true;
            } else {
                console.warn(`Layer ${layerId} is not a group or has no children`);
            }
        });
        
        if (ungroupedAny) {
            // Make sure we update the UI
            this.update();
        }
    }
    
    /**
     * Handle click on layer row
     */
    private handleLayerClick = (event: Event): void => {
        const layerRow = event.currentTarget as HTMLElement;
        if (!layerRow) return;
        
        const layerId = layerRow.getAttribute('data-layer-id');
        if (!layerId) return;
        
        // Check if we should add to selection (with Ctrl key)
        const isMultiSelect = (event as MouseEvent).ctrlKey;
        
        if (isMultiSelect) {
            // Toggle selection
            if (this.dataModel.isLayerSelected(layerId)) {
                this.dataModel.deselectLayer(layerId);
            } else {
                this.dataModel.selectLayer(layerId);
            }
        } else {
            // Clear previous selections
            this.dataModel.clearLayerSelection();
            
            // Select this layer
            this.dataModel.selectLayer(layerId);
        }
    }
    
    /**
     * Handle double click on layer (for renaming)
     */
    private handleLayerDoubleClick = (event: Event): void => {
        const layerRow = event.currentTarget as HTMLElement;
        if (!layerRow) return;
        
        const layerNameEl = layerRow.querySelector('.layer-name');
        if (!layerNameEl) return;
        
        const layerId = layerRow.getAttribute('data-layer-id');
        if (!layerId) return;
        
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Replace the name element with an input field
        const currentName = layer.name;
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.value = currentName;
        inputEl.className = 'layer-name-input';
        
        // Replace the name element with the input
        layerNameEl.replaceWith(inputEl);
        
        // Focus the input
        inputEl.focus();
        inputEl.select();
        
        // Handle blur and enter key events to save the name
        const saveLayerName = () => {
            const newName = inputEl.value.trim() || currentName;
            this.dataModel.renameLayer(layerId, newName);
            
            // Restore the name element
            const newNameEl = document.createElement('div');
            newNameEl.className = 'layer-name';
            newNameEl.textContent = newName;
            
            inputEl.replaceWith(newNameEl);
        };
        
        inputEl.addEventListener('blur', saveLayerName);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveLayerName();
            } else if (e.key === 'Escape') {
                // Restore without saving
                const newNameEl = document.createElement('div');
                newNameEl.className = 'layer-name';
                newNameEl.textContent = currentName;
                
                inputEl.replaceWith(newNameEl);
            }
        });
        
        // Stop event propagation
        event.stopPropagation();
    }
    
    /**
     * Handle right click on layer (context menu)
     */
    private handleLayerContextMenu = (event: Event): void => {
        event.preventDefault();
        const mouseEvent = event as MouseEvent;
        const layerRow = mouseEvent.currentTarget as HTMLElement;
        if (!layerRow) return;
        
        const layerId = layerRow.getAttribute('data-layer-id');
        if (!layerId) return;
        
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // If layer not selected, select it
        if (!this.dataModel.isLayerSelected(layerId)) {
            this.dataModel.clearLayerSelection();
            this.dataModel.selectLayer(layerId);
        }
        
        // Create context menu
        this.showLayerContextMenu(mouseEvent, layerId);
    }
    private showLayerContextMenu(event: MouseEvent, layerId: string): void {
    // Remove any existing context menus
    this.removeContextMenu();
    
    const layer = this.dataModel.getLayer(layerId);
    if (!layer) return;
    
    // Create menu element
    const menuEl = document.createElement('div');
    menuEl.className = 'timeline-layer-context-menu';
    
    // Set position near cursor
    menuEl.style.left = `${event.clientX}px`;
    menuEl.style.top = `${event.clientY}px`;
    
    // Create menu items
    const menuItems: MenuItemType[] = [
        { 
            label: 'Rename', 
            icon: '✏️', 
            handler: () => this.startRenameLayer(layerId)
        },
        { 
            label: 'Change Color', 
            icon: '🎨', 
            handler: () => this.showColorPicker(event, layerId)
        },
        { 
            type: 'separator' 
        },
        { 
            label: layer.visible ? 'Hide Layer' : 'Show Layer', 
            icon: layer.visible ? '👁️‍🗨️' : '👁️', 
            handler: () => this.toggleLayerVisibility(layerId)
        },
        { 
            label: layer.locked ? 'Unlock Layer' : 'Lock Layer', 
            icon: layer.locked ? '🔓' : '🔒', 
            handler: () => this.toggleLayerLock(layerId)
        },
        { 
            type: 'separator' 
        },
        { 
            label: 'Duplicate Layer', 
            icon: '📋', 
            handler: () => this.duplicateLayer(layerId)
        },
        { 
            label: 'Delete Layer', 
            icon: '🗑️', 
            handler: () => this.deleteLayer(layerId)
        }
    ];
    
    // Create menu item elements
    menuItems.forEach(item => {
        if (item.type === 'separator') {
            const separatorEl = document.createElement('div');
            separatorEl.className = 'menu-item separator';
            menuEl.appendChild(separatorEl);
        } else {
            const itemEl = document.createElement('div');
            itemEl.className = 'menu-item';
            
            // Icon
            const iconEl = document.createElement('span');
            iconEl.className = 'menu-icon';
            iconEl.textContent = item.icon;
            itemEl.appendChild(iconEl);
            
            // Label
            const labelEl = document.createElement('span');
            labelEl.textContent = item.label;
            itemEl.appendChild(labelEl);
            
            // Event handler
            itemEl.addEventListener('click', () => {
                item.handler();
                this.removeContextMenu();
            });
            
            menuEl.appendChild(itemEl);
        }
    });
        
        // Add to DOM
        document.body.appendChild(menuEl);
        
        // Adjust position if off-screen
        const menuRect = menuEl.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            menuEl.style.left = `${window.innerWidth - menuRect.width - 5}px`;
        }
        if (menuRect.bottom > window.innerHeight) {
            menuEl.style.top = `${window.innerHeight - menuRect.height - 5}px`;
        }
        
        // Click outside to close
        const handleOutsideClick = (e: MouseEvent) => {
            if (!menuEl.contains(e.target as Node)) {
                this.removeContextMenu();
                document.removeEventListener('click', handleOutsideClick);
            }
        };
        
        // Small delay to avoid the menu being closed immediately
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }
    
    /**
     * Remove context menu from DOM
     */
    private removeContextMenu(): void {
        const existingMenu = document.querySelector('.timeline-layer-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }
    
    /**
     * Show color picker for layer
     */
    private showColorPicker(event: MouseEvent, layerId: string): void {
        // Remove any existing color pickers
        this.removeColorPicker();
        
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Create color picker element
        const pickerEl = document.createElement('div');
        pickerEl.className = 'timeline-color-picker';
        
        // Set position near cursor
        pickerEl.style.left = `${event.clientX}px`;
        pickerEl.style.top = `${event.clientY}px`;
        
        // Default color palette
        const colors = [
            '#FF5252', '#FF4081', '#E040FB', '#7C4DFF', '#536DFE',
            '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE',
            '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40',
            '#FF6E40', '#FFFFFF', '#E0E0E0', '#9E9E9E', '#616161'
        ];
        
        // Create color options grid
        const colorOptionsEl = document.createElement('div');
        colorOptionsEl.className = 'color-options';
        
        colors.forEach(color => {
            const colorOptionEl = document.createElement('div');
            colorOptionEl.className = 'color-option';
            colorOptionEl.style.backgroundColor = color;
            if (layer.color === color) {
                colorOptionEl.classList.add('selected');
            }
            
            colorOptionEl.addEventListener('click', () => {
                this.updateLayerColor(layerId, color);
                this.removeColorPicker();
            });
            
            colorOptionsEl.appendChild(colorOptionEl);
        });
        
        pickerEl.appendChild(colorOptionsEl);
        
        // Custom color input
        const customColorContainer = document.createElement('div');
        customColorContainer.className = 'custom-color';
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = layer.color || '#FFFFFF';
        
        colorInput.addEventListener('change', () => {
            this.updateLayerColor(layerId, colorInput.value);
        });
        
        customColorContainer.appendChild(colorInput);
        pickerEl.appendChild(customColorContainer);
        
        // Add to DOM
        document.body.appendChild(pickerEl);
        
        // Adjust position if off-screen
        const pickerRect = pickerEl.getBoundingClientRect();
        if (pickerRect.right > window.innerWidth) {
            pickerEl.style.left = `${window.innerWidth - pickerRect.width - 5}px`;
        }
        if (pickerRect.bottom > window.innerHeight) {
            pickerEl.style.top = `${window.innerHeight - pickerRect.height - 5}px`;
        }
        
        // Click outside to close
        const handleOutsideClick = (e: MouseEvent) => {
            if (!pickerEl.contains(e.target as Node)) {
                this.removeColorPicker();
                document.removeEventListener('click', handleOutsideClick);
            }
        };
        
        // Small delay to avoid the picker being closed immediately
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }
    
    /**
     * Remove color picker from DOM
     */
    private removeColorPicker(): void {
        const existingPicker = document.querySelector('.timeline-color-picker');
        if (existingPicker) {
            existingPicker.remove();
        }
    }
    
    /**
     * Handle click on color swatch
     */
    private handleColorSwatchClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const layerRow = target.closest(`.${CssClasses.LAYER_ROW}`);
        if (!layerRow) return;
        
        const layerId = layerRow.getAttribute('data-layer-id');
        if (!layerId) return;
        
        // Show color picker
        this.showColorPicker(event, layerId);
    }
    
    /**
     * Start layer rename operation
     */
    private startRenameLayer(layerId: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        const layerRow = this.element?.querySelector(`[data-layer-id="${layerId}"]`);
        if (!layerRow) return;
        
        const layerNameEl = layerRow.querySelector('.layer-name');
        if (!layerNameEl) return;
        
        // Replace the name element with an input field
        const currentName = layer.name;
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.value = currentName;
        inputEl.className = 'layer-name-input';
        
        // Replace the name element with the input
        layerNameEl.replaceWith(inputEl);
        
        // Focus the input
        inputEl.focus();
        inputEl.select();
        
        // Handle blur and enter key events to save the name
        const saveLayerName = () => {
            const newName = inputEl.value.trim() || currentName;
            this.dataModel.renameLayer(layerId, newName);
            this.update();
        };
        
        inputEl.addEventListener('blur', saveLayerName);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveLayerName();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                this.update(); // Revert without saving
                e.preventDefault();
            }
        });
    }
    
    /**
     * Toggle layer visibility
     */
    private toggleLayerVisibility(layerId: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Use the timelineControl if available
        if (this.timelineControl && typeof this.timelineControl.setLayerVisibility === 'function') {
            this.timelineControl.setLayerVisibility(layerId, !layer.visible);
        } else {
            // Update the data model directly
            this.dataModel.updateLayer(layerId, { visible: !layer.visible });
        }
        
        this.update();
    }
    
    /**
     * Toggle layer lock
     */
    private toggleLayerLock(layerId: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Use the timelineControl if available
        if (this.timelineControl && typeof this.timelineControl.setLayerLock === 'function') {
            this.timelineControl.setLayerLock(layerId, !layer.locked);
        } else {
            // Update the data model directly
            this.dataModel.updateLayer(layerId, { locked: !layer.locked });
        }
        
        this.update();
    }
    
    /**
     * Duplicate a layer
     */
    private duplicateLayer(layerId: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Use the timelineControl if available
        if (this.timelineControl && typeof this.timelineControl.duplicateLayer === 'function') {
            this.timelineControl.duplicateLayer(layerId);
        } else {
            // Manual duplication
            const timestamp = Date.now();
            const randomNum = Math.floor(Math.random() * 10000);
            const newLayerId = `layer-${timestamp}-${randomNum}`;
            
            // Create a deep copy of the layer
            const newLayer: ILayer = {
                ...layer,
                id: newLayerId,
                name: `${layer.name} (Copy)`,
                keyframes: { ...layer.keyframes },
                // Adjust order to place it just after the original
                order: layer.order + 1
            };
            
            // Add the new layer
            this.dataModel.addLayer(newLayer);
            
            // Reorder other layers to make room for this one
            const layers = this.dataModel.getLayers();
            Object.values(layers).forEach(l => {
                if (l.id !== newLayerId && l.order >= newLayer.order) {
                    this.dataModel.updateLayer(l.id, { order: l.order + 1 });
                }
            });
            
            // Select the new layer
            this.dataModel.clearLayerSelection();
            this.dataModel.selectLayer(newLayerId);
        }
        
        this.update();
    }
    
    /**
     * Delete a layer
     */
    private deleteLayer(layerId: string): void {
        // Use the timelineControl if available
        if (this.timelineControl && typeof this.timelineControl.removeLayer === 'function') {
            this.timelineControl.removeLayer(layerId);
        } else {
            // Remove the layer directly
            this.dataModel.removeLayer(layerId);
        }
        
        this.update();
    }
    
    /**
     * Update a layer's color
     */
    private updateLayerColor(layerId: string, color: string): void {
        const layer = this.dataModel.getLayer(layerId);
        if (!layer) return;
        
        // Use the timelineControl if available
        if (this.timelineControl && typeof this.timelineControl.updateLayerColor === 'function') {
            this.timelineControl.updateLayerColor(layerId, color);
        } else {
            // Update the data model directly
            this.dataModel.updateLayer(layerId, { color });
        }
        
        this.update();
    }
    
    /**
     * Handle click on visibility toggle
     */
    private handleVisibilityToggleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const toggleEl = target.closest('.layer-visibility-toggle');
        if (!toggleEl) return;
        
        const layerRow = toggleEl.closest(`.${CssClasses.LAYER_ROW}`);
        if (!layerRow) return;
        
        const layerId = layerRow.getAttribute('data-layer-id');
        if (!layerId) return;
        
        this.toggleLayerVisibility(layerId);
    }
    
    /**
     * Handle click on lock toggle
     */
    private handleLockToggleClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const toggleEl = target.closest('.layer-lock-toggle');
        if (!toggleEl) return;
        
        const layerRow = toggleEl.closest(`.${CssClasses.LAYER_ROW}`);
        if (!layerRow) return;
        
        const layerId = layerRow.getAttribute('data-layer-id');
        if (!layerId) return;
        
        this.toggleLayerLock(layerId);
    }
    
    /**
     * Handle mousedown on drag handle (for reordering)
     */
    private handleDragHandleMouseDown = (event: MouseEvent): void => {
        const handle = event.currentTarget as HTMLElement;
        const layerRow = handle.closest(`.${CssClasses.LAYER_ROW}`);
        
        if (!layerRow) return;
        
        this.dragLayerElement = layerRow as HTMLElement;
        this.dragLayerIndex = parseInt(layerRow.getAttribute('data-layer-index') || '-1', 10);
        this.dragStartY = event.clientY;
        
        // Add dragging class
        layerRow.classList.add('dragging');
        
        // Stop event propagation
        event.stopPropagation();
    }
    
    /**
     * Handle mousemove during layer drag
     */    private handleMouseMove = (event: MouseEvent): void => {
        if (this.dragLayerElement === null || this.dragLayerIndex === null) return;
        
        const deltaY = event.clientY - this.dragStartY;
        
        // Apply transform to the dragged element
        (this.dragLayerElement as HTMLElement).style.transform = `translateY(${deltaY}px)`;
        
        // Find the layer that would be at the new position
        const layerRows = Array.from(this.element?.querySelectorAll(`.${CssClasses.LAYER_ROW}`) || []);
        const rowHeight = this.dragLayerElement.offsetHeight;
        
        // Calculate the new index based on the drag position
        const dragRowIndex = layerRows.indexOf(this.dragLayerElement);
        const newIndex = Math.max(0, Math.min(
            layerRows.length - 1, 
            dragRowIndex + Math.round(deltaY / rowHeight)
        ));
        
        // Temporarily shift the layers to show where the dragged layer would end up
        layerRows.forEach((row, index) => {
            if (row !== this.dragLayerElement) {
                const htmlRow = row as HTMLElement;
                if (dragRowIndex < newIndex && index > dragRowIndex && index <= newIndex) {
                    htmlRow.style.transform = 'translateY(-100%)';
                } else if (dragRowIndex > newIndex && index < dragRowIndex && index >= newIndex) {
                    htmlRow.style.transform = 'translateY(100%)';
                } else {
                    htmlRow.style.transform = '';
                }
            }
        });
    }
    
    /**
     * Handle mouseup after layer drag
     */
    private handleMouseUp = (event: MouseEvent): void => {
        if (this.dragLayerElement === null || this.dragLayerIndex === null) return;
        
        const deltaY = event.clientY - this.dragStartY;
        
        // Find all layer rows
        const layerRows = Array.from(this.element?.querySelectorAll(`.${CssClasses.LAYER_ROW}`) || []);
        const rowHeight = this.dragLayerElement.offsetHeight;
        
        // Calculate the new index based on the final drag position
        const dragRowIndex = layerRows.indexOf(this.dragLayerElement);
        const newIndex = Math.max(0, Math.min(
            layerRows.length - 1, 
            dragRowIndex + Math.round(deltaY / rowHeight)
        ));
        
        // If the layer position changed, update the model
        if (newIndex !== dragRowIndex) {
            const layerId = this.dragLayerElement.getAttribute('data-layer-id');
            
            if (layerId) {
                // Calculate the new order value
                const targetOrder = parseInt(layerRows[newIndex].getAttribute('data-layer-index') || '0', 10);
                
                // Move the layer to the new order
                this.dataModel.moveLayer(layerId, targetOrder);
            }
        }
          // Reset all transforms
        layerRows.forEach(row => {
            (row as HTMLElement).style.transform = '';
            row.classList.remove('dragging');
        });
        
        // Reset drag state
        this.dragLayerElement = null;
        this.dragLayerIndex = null;
    }
    
    /**
     * Handle layer added event
     * @param event - Layer added event
     */    /**
     * Handle layer added event
     * @param event - Layer added event
     */
    private handleLayerAdded(event: any): void {
        console.log('Layer added event received:', event.data);
        console.log('Current layers:', this.dataModel.getLayers());
        this.update();
    }
    
    /**
     * Handle layer removed event
     * @param event - Layer removed event
     */
    private handleLayerRemoved(event: any): void {
        this.update();
    }
    
    /**
     * Handle layer moved event
     * @param event - Layer moved event
     */
    private handleLayerMoved(event: any): void {
        this.update();
    }
    
    /**
     * Handle layer renamed event
     * @param event - Layer renamed event
     */
    private handleLayerRenamed(event: any): void {
        const layerId = event.data.layerId;
        const newName = event.data.newName;
        
        // Update just the name element without a full re-render
        const layerNameEl = this.element?.querySelector(`.${CssClasses.LAYER_ROW}[data-layer-id="${layerId}"] .layer-name`);
        
        if (layerNameEl) {
            layerNameEl.textContent = newName;
        }
    }
    
    /**
     * Handle layer selected event
     * @param event - Layer selected event
     */
    private handleLayerSelected(event: any): void {
        const layerId = event.data.layerId;
        
        // Add selected class to the layer
        const layerRow = this.element?.querySelector(`.${CssClasses.LAYER_ROW}[data-layer-id="${layerId}"]`);
        
        if (layerRow) {
            layerRow.classList.add(CssClasses.LAYER_SELECTED);
        }
    }
    
    /**
     * Handle layer deselected event
     * @param event - Layer deselected event
     */
    private handleLayerDeselected(event: any): void {
        const layerId = event.data.layerId;
        
        // Remove selected class from the layer
        const layerRow = this.element?.querySelector(`.${CssClasses.LAYER_ROW}[data-layer-id="${layerId}"]`);
        
        if (layerRow) {
            layerRow.classList.remove(CssClasses.LAYER_SELECTED);
        }
    }
    
    /**
     * Mount the component
     * Override the mount method to directly modify the container
     * without replacing its HTML content
     */
    public mount(): void {
        if (!this.container) {
            throw new Error(`Cannot mount component ${this.id} - container is null`);
        }
        
        console.log(`Mounting LayerManager ${this.id} to container:`, this.container);
        
        // Set the element reference to the container
        // instead of replacing the container content
        this.element = this.container;
        
        // Initialize the content, but don't replace the container
        this.update();
        
        console.log(`LayerManager ${this.id} mounted successfully`, this.element);
    }

}

    /**
     * Show context menu for layer
     */
    // Define our menu item types
interface MenuSeparator {
    type: 'separator';
}

interface MenuItem {
    type?: undefined;
    label: string;
    icon: string;
    handler: () => void;
}

type MenuItemType = MenuItem | MenuSeparator;


