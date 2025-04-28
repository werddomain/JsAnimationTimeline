# Implementation Guide: Layer Row Functionality

This document provides a guide for implementing the functionality to make `timeline-layer-row` fully interactive with the following features:

## 1. Toggle Visibility and Lock

The template and CSS for visibility and lock toggles are already in place. You need to implement the following handlers:

```typescript
/**
 * Toggle layer visibility
 */
private toggleLayerVisibility(layerId: string): void {
    const layer = this.dataModel.getLayer(layerId);
    if (!layer) return;
    
    // Update the data model
    this.dataModel.updateLayer(layerId, { visible: !layer.visible });
    
    // Update the UI
    this.update();
}

/**
 * Toggle layer lock
 */
private toggleLayerLock(layerId: string): void {
    const layer = this.dataModel.getLayer(layerId);
    if (!layer) return;
    
    // Update the data model
    this.dataModel.updateLayer(layerId, { locked: !layer.locked });
    
    // Update the UI
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
```

## 2. Color Changing

Implement the color changing functionality:

```typescript
/**
 * Update a layer's color
 */
private updateLayerColor(layerId: string, color: string): void {
    const layer = this.dataModel.getLayer(layerId);
    if (!layer) return;
    
    // Update the data model
    this.dataModel.updateLayer(layerId, { color });
    
    // Update the UI
    this.update();
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
```

## 3. Right-Click Context Menu

Implement the right-click context menu for additional layer actions:

```typescript
// Add this interface definition at the top of your file
interface MenuItem {
    label: string;
    icon: string;
    handler: () => void;
}

interface MenuSeparator {
    type: 'separator';
}

type MenuItemType = MenuItem | MenuSeparator;

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

/**
 * Show context menu for layer
 */
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
```

## 4. Layer Duplication and Deletion

```typescript
/**
 * Duplicate a layer
 */
private duplicateLayer(layerId: string): void {
    const layer = this.dataModel.getLayer(layerId);
    if (!layer) return;
    
    // Generate a unique ID with timestamp and random number
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
    
    // Update the UI
    this.update();
}

/**
 * Delete a layer
 */
private deleteLayer(layerId: string): void {
    // Remove the layer from the data model
    this.dataModel.removeLayer(layerId);
    
    // Update the UI
    this.update();
}
```

## 5. Rename Layer Functionality

```typescript
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
```

## 6. Update Event Setup

Finally, update the `setupLayerEventListeners` method to include all the new event handlers:

```typescript
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
```

## CSS Classes

In the `Constants.ts` file, make sure you have the following CSS class constants defined:

```typescript
// Add these to your existing CssClasses object
LAYER_HIDDEN: 'layer-hidden',
LAYER_LOCKED: 'layer-locked',
```

## Rendering

Update the `renderLayer` method to include the hidden/locked classes:

```typescript
private renderLayer(layer: ILayer): string {
    const selectedClass = this.dataModel.getSelectedLayerIds().includes(layer.id) ? 
        CssClasses.LAYER_SELECTED : '';
    const visibleClass = layer.visible ? '' : CssClasses.LAYER_HIDDEN;
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
            <div class="layer-visibility-toggle" title="${layer.visible ? 'Hide Layer' : 'Show Layer'}">
                <span class="timeline-icon">${layer.visible ? '👁️' : '👁️‍🗨️'}</span>
            </div>
            <div class="layer-lock-toggle" title="${layer.locked ? 'Unlock Layer' : 'Lock Layer'}">
                <span class="timeline-icon">${layer.locked ? '🔒' : '🔓'}</span>
            </div>                
        </div>
    `;
}
```

This implementation guide should provide you with all the code needed to add the requested functionality to the layer rows. Ensure that you properly integrate these methods with the existing code, and check that the `DataModel` class has all the necessary methods for updating layer properties.
