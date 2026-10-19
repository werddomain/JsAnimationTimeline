import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer } from '../data/ITimeLineData';
import { IMenuItem } from './ContextMenu';

export class LayerPanel {
  private context: IJsTimeLineContext;
  private selectedLayerId: string | null = null;
  private draggedLayerId: string | null = null;
  private dropIndicator: HTMLElement | null = null;
  private collapsedFolders: Set<string> = new Set();
  private contextMenuTrigger: HTMLElement | null = null;
  private isTouchDevice: boolean = false;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
    this.isTouchDevice = this.detectTouchDevice();
    this.setupEventListeners();
    this.createDropIndicator();
    this.restoreCollapsedState();
    this.setupSelectionTrigger();
  }

  /**
   * Detect if device supports touch
   */
  private detectTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Setup selection-based context menu trigger
   */
  private setupSelectionTrigger(): void {
    if (!this.isTouchDevice) return;

    // Listen to layer selection changes
    const eventManager = this.context.Core.eventManager;
    if (!eventManager) return;

    // Listen for layer selection
    eventManager.on('onLayerSelect', () => {
      this.updateContextMenuTrigger();
    });
  }

  /**
   * Update context menu trigger position for selected layer
   */
  private updateContextMenuTrigger(): void {
    const layerContainer = this.context.UI.layerPanelContent;
    if (!layerContainer) return;

    // Remove existing trigger
    if (this.contextMenuTrigger) {
      this.contextMenuTrigger.remove();
      this.contextMenuTrigger = null;
    }

    // Only show trigger on touch devices
    if (!this.isTouchDevice) return;

    // Only show trigger if a layer is selected
    if (!this.selectedLayerId) return;

    const layerElement = layerContainer.querySelector(`[data-layer-id="${this.selectedLayerId}"]`) as HTMLElement;
    if (!layerElement) return;

    // Create trigger icon
    this.contextMenuTrigger = document.createElement('div');
    this.contextMenuTrigger.className = 'context-menu-trigger';
    this.contextMenuTrigger.innerHTML = '⋮'; // Three dots

    // Position at end of layer row
    const layerRect = layerElement.getBoundingClientRect();
    const containerRect = layerContainer.getBoundingClientRect();
    
    this.contextMenuTrigger.style.position = 'absolute';
    this.contextMenuTrigger.style.right = '8px';
    this.contextMenuTrigger.style.top = `${layerRect.top - containerRect.top + 8}px`;

    // Add click handler
    this.contextMenuTrigger.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Simulate right-click on the layer element
      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: layerRect.right - 50,
        clientY: layerRect.top + layerRect.height / 2
      });
      layerElement.dispatchEvent(contextMenuEvent);
    });

    layerContainer.appendChild(this.contextMenuTrigger);
  }

  /**
   * Restore collapsed folders from StateManager
   */
  private restoreCollapsedState(): void {
    const stored = this.context.Core.stateManager.get('collapsedFolders');
    if (stored && Array.isArray(stored)) {
      this.collapsedFolders = new Set(stored);
    }
  }

  /**
   * Create a drop indicator element for visual feedback
   */
  private createDropIndicator(): void {
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'layer-drop-indicator';
    this.dropIndicator.style.display = 'none';
  }

  /**
   * Render the layer panel with all layers
   */
  public render(): void {
    const data = this.context.Data.getData();
    const container = this.context.UI.layerPanelContent;

    // Clear existing content
    container.innerHTML = '';

    // Create scrollable content container
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'layer-panel-layers';
    
    // Add ARIA attributes for accessibility
    contentWrapper.setAttribute('role', 'tree');
    contentWrapper.setAttribute('aria-label', 'Layer hierarchy');

    // Render all layers recursively
    this.renderLayers(data.layers, contentWrapper, 0);

    // Add toolbar with management buttons
    const toolbar = this.createToolbar();
    
    container.appendChild(contentWrapper);
    container.appendChild(toolbar);
    
    // Setup keyboard navigation after rendering
    this.setupKeyboardNavigation(contentWrapper);
  }

  /**
   * Create the layer management toolbar
   */
  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'layer-panel-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Layer management controls');

    const addLayerBtn = document.createElement('button');
    addLayerBtn.className = 'layer-toolbar-btn';
    addLayerBtn.innerHTML = '➕ Layer';
    addLayerBtn.title = 'Add Layer';
    addLayerBtn.setAttribute('aria-label', 'Add new layer');
    addLayerBtn.addEventListener('click', () => this.onAddLayer());

    const addFolderBtn = document.createElement('button');
    addFolderBtn.className = 'layer-toolbar-btn';
    addFolderBtn.innerHTML = '📁 Folder';
    addFolderBtn.title = 'Add Folder';
    addFolderBtn.setAttribute('aria-label', 'Add new folder');
    addFolderBtn.addEventListener('click', () => this.onAddFolder());

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'layer-toolbar-btn layer-toolbar-btn-delete';
    deleteBtn.innerHTML = '🗑 Delete';
    deleteBtn.title = 'Delete Selected';
    deleteBtn.setAttribute('aria-label', 'Delete selected layer');
    deleteBtn.addEventListener('click', () => this.onDelete());

    toolbar.appendChild(addLayerBtn);
    toolbar.appendChild(addFolderBtn);
    toolbar.appendChild(deleteBtn);

    return toolbar;
  }

  /**
   * Recursively render layers and their children
   * @param layers Array of layers to render
   * @param container Container element to append to
   * @param depth Nesting depth for indentation
   */
  private renderLayers(layers: ILayer[], container: HTMLElement, depth: number): void {
    layers.forEach(layer => {
      const layerRow = this.createLayerRow(layer, depth);
      container.appendChild(layerRow);

      // If this is a folder with children, recursively render them only if not collapsed
      if (layer.type === 'folder' && layer.children && layer.children.length > 0) {
        if (!this.collapsedFolders.has(layer.id)) {
          this.renderLayers(layer.children, container, depth + 1);
        }
      }
    });
  }

  /**
   * Create a single layer row element
   * @param layer The layer data
   * @param depth Nesting depth for indentation
   * @returns The layer row element
   */
  private createLayerRow(layer: ILayer, depth: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.setAttribute('data-layer-id', layer.id);
    row.setAttribute('data-layer-type', layer.type);
    
    // ARIA attributes for accessibility
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-label', `${layer.type === 'folder' ? 'Folder' : 'Layer'}: ${layer.name}`);
    row.setAttribute('aria-selected', this.selectedLayerId === layer.id ? 'true' : 'false');
    if (layer.type === 'folder') {
      const isExpanded = !this.collapsedFolders.has(layer.id);
      row.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    }
    if (layer.locked) {
      row.setAttribute('aria-disabled', 'true');
    }
    row.setAttribute('tabindex', this.selectedLayerId === layer.id ? '0' : '-1');

    // Apply indentation for nested layers
    if (depth > 0) {
      row.style.paddingLeft = `${depth * 20}px`;
    }

    // Click to select
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectLayer(layer.id);
    });

    // Right-click for context menu
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectLayer(layer.id);
      this.showLayerContextMenu(e, layer);
    });

    // Drag and drop handlers on the row for drop zone
    row.addEventListener('dragover', (e) => this.onDragOver(e, layer.id, layer.type));
    row.addEventListener('drop', (e) => this.onDrop(e, layer.id, layer.type));
    row.addEventListener('dragleave', (e) => this.onDragLeave(e));

    // Create drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'layer-drag-handle';
    dragHandle.textContent = '::';
    dragHandle.setAttribute('draggable', 'true');
    dragHandle.setAttribute('title', 'Drag to reorder');
    
    // Drag handlers on the handle only
    dragHandle.addEventListener('dragstart', (e) => this.onDragStart(e, layer.id));
    dragHandle.addEventListener('dragend', (e) => this.onDragEnd(e));

    // Create layer controls container (left side)
    const controls = document.createElement('div');
    controls.className = 'layer-controls';

    // Folder icon or expand/collapse button
    if (layer.type === 'folder') {
      const folderIcon = document.createElement('span');
      folderIcon.className = 'layer-icon layer-icon-folder';
      folderIcon.textContent = '▶'; // Could use actual icon
      
      // Add collapsed class if folder is collapsed
      if (this.collapsedFolders.has(layer.id)) {
        folderIcon.classList.add('collapsed');
      } else {
        folderIcon.classList.add('expanded');
      }
      
      // Add click handler to toggle collapse
      folderIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFolderCollapse(layer.id);
      });
      
      controls.appendChild(folderIcon);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'layer-icon-spacer';
      controls.appendChild(spacer);
    }

    // Visibility toggle (eye icon)
    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'layer-btn layer-btn-visibility';
    visibilityBtn.setAttribute('title', 'Toggle visibility');
    visibilityBtn.textContent = layer.visible !== false ? '👁' : '🚫';
    visibilityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleVisibility(layer.id);
    });
    controls.appendChild(visibilityBtn);

    // Lock toggle
    const lockBtn = document.createElement('button');
    lockBtn.className = 'layer-btn layer-btn-lock';
    lockBtn.setAttribute('title', 'Toggle lock');
    lockBtn.textContent = layer.locked ? '🔒' : '🔓';
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLock(layer.id);
    });
    controls.appendChild(lockBtn);

    // Create layer name container (right side)
    const nameContainer = document.createElement('div');
    nameContainer.className = 'layer-name';
    nameContainer.textContent = layer.name;
    
    // Double-click to rename
    nameContainer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.startRename(layer.id, nameContainer);
    });

    // Assemble the row
    row.appendChild(dragHandle);
    row.appendChild(controls);
    row.appendChild(nameContainer);

    return row;
  }

  /**
   * Setup event listeners for layer management
   */
  private setupEventListeners(): void {
    // Listen for layer events to re-render
    this.context.Core.eventManager.on('layer:added', () => {
      this.render();
      if (this.context.UI.timelineGrid) {
        this.context.UI.timelineGrid.render();
      }
    });

    this.context.Core.eventManager.on('folder:added', () => {
      this.render();
      if (this.context.UI.timelineGrid) {
        this.context.UI.timelineGrid.render();
      }
    });

    this.context.Core.eventManager.on('layer:deleted', () => {
      this.render();
      if (this.context.UI.timelineGrid) {
        this.context.UI.timelineGrid.render();
      }
    });

    this.context.Core.eventManager.on('layer:renamed', () => {
      this.render();
    });

    this.context.Core.eventManager.on('layer:visibilityChanged', () => {
      this.render();
    });

    this.context.Core.eventManager.on('layer:lockChanged', () => {
      this.render();
    });

    this.context.Core.eventManager.on('layer:reordered', () => {
      this.render();
      if (this.context.UI.timelineGrid) {
        this.context.UI.timelineGrid.render();
      }
    });

    this.context.Core.eventManager.on('layer:reparented', () => {
      this.render();
      if (this.context.UI.timelineGrid) {
        this.context.UI.timelineGrid.render();
      }
    });
  }

  /**
   * Select a layer
   */
  private selectLayer(id: string): void {
    this.selectedLayerId = id;
    
    // Update ARIA selected attribute on all layer rows
    const container = this.context.UI.layerPanelContent;
    const allRows = container.querySelectorAll('.layer-row');
    allRows.forEach((row) => {
      const layerId = row.getAttribute('data-layer-id');
      const isSelected = layerId === id;
      row.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      row.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
    
    // Focus the selected layer for keyboard navigation
    const selectedRow = container.querySelector(`[data-layer-id="${id}"]`) as HTMLElement;
    if (selectedRow) {
      selectedRow.focus();
    }
    
    this.render();

    // Emit event
    this.context.Core.eventManager.emit('layer:selected', { layerId: id });
    this.context.Core.eventManager.emit('onLayerSelect', { layerId: id });

    // Update mobile context menu trigger
    this.updateContextMenuTrigger();
  }

  /**
   * Setup keyboard navigation for layers
   */
  private setupKeyboardNavigation(container: HTMLElement): void {
    container.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('layer-row')) return;

      const layerId = target.getAttribute('data-layer-id');
      if (!layerId) return;

      const data = this.context.Data.getData();
      const allLayers = this.getAllLayers(data.layers);
      const currentIndex = allLayers.findIndex(l => l.id === layerId);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < allLayers.length - 1) {
            this.selectLayer(allLayers[currentIndex + 1].id);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            this.selectLayer(allLayers[currentIndex - 1].id);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          // Expand folder if collapsed
          const layer = allLayers[currentIndex];
          if (layer.type === 'folder' && this.collapsedFolders.has(layer.id)) {
            this.toggleFolderCollapse(layer.id);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          // Collapse folder if expanded
          const currentLayer = allLayers[currentIndex];
          if (currentLayer.type === 'folder' && !this.collapsedFolders.has(currentLayer.id)) {
            this.toggleFolderCollapse(currentLayer.id);
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          // Toggle folder collapse or trigger rename
          const selectedLayer = allLayers[currentIndex];
          if (selectedLayer.type === 'folder') {
            this.toggleFolderCollapse(selectedLayer.id);
          }
          break;

        case 'Delete':
          e.preventDefault();
          // Delete selected layer
          if (this.selectedLayerId) {
            const layerManager = this.context.Core.layerManager;
            if (layerManager) {
              layerManager.deleteObject(this.selectedLayerId);
            }
          }
          break;
      }
    });
  }

  /**
   * Get all layers in a flat array (for keyboard navigation)
   */
  private getAllLayers(layers: readonly ILayer[]): ILayer[] {
    const result: ILayer[] = [];
    
    for (const layer of layers) {
      result.push(layer as ILayer);
      
      // Only include visible children (not collapsed)
      if (layer.type === 'folder' && layer.children && !this.collapsedFolders.has(layer.id)) {
        result.push(...this.getAllLayers(layer.children));
      }
    }
    
    return result;
  }

  /**
   * Toggle layer visibility
   */
  private toggleVisibility(id: string): void {
    const layerManager = this.context.Core.layerManager;
    if (layerManager) {
      layerManager.toggleVisibility(id);
    }
  }

  /**
   * Toggle layer lock
   */
  private toggleLock(id: string): void {
    const layerManager = this.context.Core.layerManager;
    if (layerManager) {
      layerManager.toggleLock(id);
    }
  }

  /**
   * Toggle folder collapse state
   */
  private toggleFolderCollapse(id: string): void {
    if (this.collapsedFolders.has(id)) {
      this.collapsedFolders.delete(id);
    } else {
      this.collapsedFolders.add(id);
    }
    
    // Store collapsed state in StateManager
    this.context.Core.stateManager.set('collapsedFolders', Array.from(this.collapsedFolders));
    
    // Re-render to show/hide children
    this.render();
    
    // Also trigger TimelineGrid re-render
    if (this.context.UI.timelineGrid) {
      this.context.UI.timelineGrid.updateCollapsedState();
      this.context.UI.timelineGrid.render();
    }
    
    // Emit event
    this.context.Core.eventManager.emit('folder:toggled', { id, collapsed: this.collapsedFolders.has(id) });
  }

  /**
   * Start renaming a layer
   */
  private startRename(id: string, nameContainer: HTMLElement): void {
    const currentName = nameContainer.textContent || '';
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layer-name-input';
    input.value = currentName;
    
    // Replace text with input
    nameContainer.innerHTML = '';
    nameContainer.appendChild(input);
    input.focus();
    input.select();

    // Save on Enter or blur
    const save = () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        const layerManager = this.context.Core.layerManager;
        if (layerManager) {
          layerManager.renameObject(id, newName);
        }
      } else {
        this.render();
      }
    };

    // Cancel on Escape
    const cancel = () => {
      this.render();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
  }

  /**
   * Add a new layer
   */
  private onAddLayer(): void {
    const layerManager = this.context.Core.layerManager;
    if (layerManager) {
      layerManager.addLayer();
    }
  }

  /**
   * Add a new folder
   */
  private onAddFolder(): void {
    const layerManager = this.context.Core.layerManager;
    if (layerManager) {
      layerManager.addFolder();
    }
  }

  /**
   * Delete selected layer
   */
  private onDelete(): void {
    if (!this.selectedLayerId) {
      alert('Please select a layer to delete');
      return;
    }

    const layerManager = this.context.Core.layerManager;
    if (layerManager) {
      if (confirm('Are you sure you want to delete this layer?')) {
        layerManager.deleteObject(this.selectedLayerId);
        this.selectedLayerId = null;
      }
    }
  }

  /**
   * Drag start handler
   */
  private onDragStart(e: DragEvent, layerId: string): void {
    this.draggedLayerId = layerId;
    
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', layerId);
    }

    // Add visual feedback
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  }

  /**
   * Drag end handler
   */
  private onDragEnd(e: DragEvent): void {
    const target = e.target as HTMLElement;
    target.style.opacity = '';
    
    // Hide drop indicator
    if (this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
    }

    this.draggedLayerId = null;
  }

  /**
   * Drag over handler
   */
  private onDragOver(e: DragEvent, targetLayerId: string, targetType: string): void {
    e.preventDefault();
    
    if (!this.draggedLayerId || this.draggedLayerId === targetLayerId) {
      return;
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    // Show drop indicator
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const isTopHalf = mouseY < rect.height / 2;

    // For folders, also consider dropping inside
    const isFolderCenter = targetType === 'folder' && 
                          mouseY > rect.height * 0.25 && 
                          mouseY < rect.height * 0.75;

    if (isFolderCenter) {
      // Drop inside folder
      target.classList.add('layer-row-drop-inside');
      target.classList.remove('layer-row-drop-before', 'layer-row-drop-after');
    } else if (isTopHalf) {
      // Drop before
      target.classList.add('layer-row-drop-before');
      target.classList.remove('layer-row-drop-after', 'layer-row-drop-inside');
    } else {
      // Drop after
      target.classList.add('layer-row-drop-after');
      target.classList.remove('layer-row-drop-before', 'layer-row-drop-inside');
    }
  }

  /**
   * Drag leave handler
   */
  private onDragLeave(e: DragEvent): void {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('layer-row-drop-before', 'layer-row-drop-after', 'layer-row-drop-inside');
  }

  /**
   * Drop handler
   */
  private onDrop(e: DragEvent, targetLayerId: string, targetType: string): void {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    target.classList.remove('layer-row-drop-before', 'layer-row-drop-after', 'layer-row-drop-inside');

    if (!this.draggedLayerId || this.draggedLayerId === targetLayerId) {
      return;
    }

    const layerManager = this.context.Core.layerManager;
    if (!layerManager) return;

    // Determine drop position
    const rect = target.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const isTopHalf = mouseY < rect.height / 2;
    const isFolderCenter = targetType === 'folder' && 
                          mouseY > rect.height * 0.25 && 
                          mouseY < rect.height * 0.75;

    if (isFolderCenter) {
      // Reparent into folder (at end)
      layerManager.reparentObject(this.draggedLayerId, targetLayerId);
    } else {
      // Reorder at same level - calculate the new index
      const data = this.context.Data.getData();
      const result = this.calculateReorderIndex(data.layers, this.draggedLayerId, targetLayerId, isTopHalf ? 'before' : 'after');
      
      if (result) {
        // Check if we need to reparent first (moving from one parent to another)
        if ((result as any).needsReparent) {
          // Reparent to the target's parent at the specified index (atomic operation)
          layerManager.reparentObject(this.draggedLayerId, result.parentId, undefined, result.newIndex);
        } else {
          // Simple reorder within the same parent
          // This will emit 'layer:reordered' event
          // which will trigger re-render of both LayerPanel and TimelineGrid
          layerManager.reorderObject(this.draggedLayerId, result.newIndex);
        }
      }
    }
  }

  /**
   * Calculate the new index for reordering a layer
   * @param layers The layers array to search
   * @param draggedId ID of the layer being dragged
   * @param targetId ID of the target layer
   * @param position 'before' or 'after' the target
   * @returns Object with newIndex and parentId, or null if not found
   */
  private calculateReorderIndex(
    layers: readonly ILayer[], 
    draggedId: string, 
    targetId: string, 
    position: 'before' | 'after'
  ): { newIndex: number; parentId: string | null } | null {
    // Helper function to find layer and its parent
    const findLayerWithParent = (
      layerList: readonly ILayer[], 
      id: string, 
      parentId: string | null = null
    ): { layer: ILayer; parent: string | null; siblings: readonly ILayer[] } | null => {
      for (const layer of layerList) {
        if (layer.id === id) {
          return { layer, parent: parentId, siblings: layerList };
        }
        if (layer.children) {
          const result = findLayerWithParent(layer.children, id, layer.id);
          if (result) return result;
        }
      }
      return null;
    };

    // Find both dragged and target layers
    const draggedInfo = findLayerWithParent(layers, draggedId);
    const targetInfo = findLayerWithParent(layers, targetId);

    if (!draggedInfo || !targetInfo) {
      console.error('Could not find dragged or target layer');
      return null;
    }

    // If they are not in the same parent, we need to handle reparenting
    // Return the target's parent and the index where we want to insert
    if (draggedInfo.parent !== targetInfo.parent) {
      // Calculate index in target's parent
      const siblings = targetInfo.siblings;
      const targetIndex = siblings.findIndex(l => l.id === targetId);
      
      if (targetIndex === -1) {
        console.error('Could not find target index');
        return null;
      }

      // Calculate the new index based on position
      // Since the dragged item is not in this array yet, no adjustment needed
      const newIndex = position === 'before' ? targetIndex : targetIndex + 1;
      
      return { 
        newIndex, 
        parentId: targetInfo.parent,
        needsReparent: true 
      } as any;
    }

    // Get the siblings array
    const siblings = targetInfo.siblings;
    const targetIndex = siblings.findIndex(l => l.id === targetId);
    
    if (targetIndex === -1) {
      console.error('Could not find target index');
      return null;
    }

    const draggedIndex = siblings.findIndex(l => l.id === draggedId);
    if (draggedIndex === -1) {
      console.error('Could not find dragged layer index');
      return null;
    }

    // Calculate new index based on position
    // Important: LayerManager.reorderObject() removes the item first, then inserts at newIndex
    // So we need to calculate the index AFTER removal
    let newIndex: number;
    
    if (position === 'before') {
      // Want to insert before target
      newIndex = targetIndex;
      // If dragged is before target, after removal target shifts back by 1
      if (draggedIndex < targetIndex) {
        newIndex--;
      }
    } else {
      // Want to insert after target
      newIndex = targetIndex + 1;
      // If dragged is before target, after removal everything shifts back by 1
      if (draggedIndex < targetIndex) {
        newIndex--;
      }
    }

    return { newIndex, parentId: draggedInfo.parent };
  }

  /**
   * Show context menu for a layer
   */
  private showLayerContextMenu(e: MouseEvent, layer: ILayer): void {
    const contextMenu = this.context.UI.contextMenu;
    const layerManager = this.context.Core.layerManager;
    
    if (!contextMenu || !layerManager) return;

    const menuItems: IMenuItem[] = [
      {
        label: 'Insert Layer',
        action: () => {
          const data = this.context.Data.getData();
          layerManager.addLayer(`New Layer`, layer.id);
        }
      },
      {
        label: 'Insert Folder',
        action: () => {
          const data = this.context.Data.getData();
          layerManager.addFolder(`New Folder`, layer.id);
        }
      },
      {
        separator: true
      },
      {
        label: 'Delete Layer',
        action: () => {
          // Emit confirmation event
          const confirmed = confirm(`Delete layer "${layer.name}"?`);
          if (confirmed) {
            layerManager.deleteObject(layer.id);
          }
        }
      },
      {
        label: 'Rename Layer',
        action: () => {
          // Find the layer row and trigger rename
          const layerRow = this.context.UI.layerPanelContent.querySelector(`[data-layer-id="${layer.id}"]`);
          if (layerRow) {
            const nameContainer = layerRow.querySelector('.layer-name') as HTMLElement;
            if (nameContainer) {
              this.startRename(layer.id, nameContainer);
            }
          }
        }
      },
      {
        separator: true
      },
      {
        label: 'Show/Hide Others',
        action: () => {
          this.toggleOthersVisibility(layer.id);
        }
      },
      {
        label: 'Lock Others',
        action: () => {
          this.lockOthers(layer.id);
        }
      },
      {
        separator: true
      },
      {
        label: 'Properties...',
        enabled: false
      }
    ];

    contextMenu.show(e.clientX, e.clientY, menuItems);
  }

  /**
   * Toggle visibility of all layers except the specified one
   */
  private toggleOthersVisibility(excludeLayerId: string): void {
    const data = this.context.Data.getData();
    const layerManager = this.context.Core.layerManager;
    if (!layerManager) return;

    const toggleLayersRecursive = (layers: readonly ILayer[]) => {
      layers.forEach(layer => {
        if (layer.id !== excludeLayerId) {
          layerManager.toggleVisibility(layer.id);
        }
        if (layer.children) {
          toggleLayersRecursive(layer.children);
        }
      });
    };

    toggleLayersRecursive(data.layers);
  }

  /**
   * Lock all layers except the specified one
   */
  private lockOthers(excludeLayerId: string): void {
    const data = this.context.Data.getData();
    const layerManager = this.context.Core.layerManager;
    if (!layerManager) return;

    const lockLayersRecursive = (layers: readonly ILayer[]) => {
      layers.forEach(layer => {
        if (layer.id !== excludeLayerId && !layer.locked) {
          layerManager.toggleLock(layer.id);
        }
        if (layer.children) {
          lockLayersRecursive(layer.children);
        }
      });
    };

    lockLayersRecursive(data.layers);
  }
}
