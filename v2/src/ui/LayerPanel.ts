import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer } from '../data/ITimeLineData';

export class LayerPanel {
  private context: IJsTimeLineContext;
  private selectedLayerId: string | null = null;
  private draggedLayerId: string | null = null;
  private dropIndicator: HTMLElement | null = null;
  private collapsedFolders: Set<string> = new Set();

  constructor(context: IJsTimeLineContext) {
    this.context = context;
    this.setupEventListeners();
    this.createDropIndicator();
    this.restoreCollapsedState();
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

    // Render all layers recursively
    this.renderLayers(data.layers, contentWrapper, 0);

    // Add toolbar with management buttons
    const toolbar = this.createToolbar();
    
    container.appendChild(contentWrapper);
    container.appendChild(toolbar);
  }

  /**
   * Create the layer management toolbar
   */
  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'layer-panel-toolbar';

    const addLayerBtn = document.createElement('button');
    addLayerBtn.className = 'layer-toolbar-btn';
    addLayerBtn.innerHTML = '➕ Layer';
    addLayerBtn.title = 'Add Layer';
    addLayerBtn.addEventListener('click', () => this.onAddLayer());

    const addFolderBtn = document.createElement('button');
    addFolderBtn.className = 'layer-toolbar-btn';
    addFolderBtn.innerHTML = '📁 Folder';
    addFolderBtn.title = 'Add Folder';
    addFolderBtn.addEventListener('click', () => this.onAddFolder());

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'layer-toolbar-btn layer-toolbar-btn-delete';
    deleteBtn.innerHTML = '🗑 Delete';
    deleteBtn.title = 'Delete Selected';
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
    row.setAttribute('draggable', 'true');

    // Apply indentation for nested layers
    if (depth > 0) {
      row.style.paddingLeft = `${depth * 20}px`;
    }

    // Click to select
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectLayer(layer.id);
    });

    // Drag and drop handlers
    row.addEventListener('dragstart', (e) => this.onDragStart(e, layer.id));
    row.addEventListener('dragend', (e) => this.onDragEnd(e));
    row.addEventListener('dragover', (e) => this.onDragOver(e, layer.id, layer.type));
    row.addEventListener('drop', (e) => this.onDrop(e, layer.id, layer.type));
    row.addEventListener('dragleave', (e) => this.onDragLeave(e));

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
  }

  /**
   * Select a layer
   */
  private selectLayer(id: string): void {
    this.selectedLayerId = id;
    
    // Update visual selection
    const container = this.context.UI.layerPanelContent;
    const rows = container.querySelectorAll('.layer-row');
    rows.forEach(row => {
      if (row.getAttribute('data-layer-id') === id) {
        row.classList.add('layer-row-selected');
      } else {
        row.classList.remove('layer-row-selected');
      }
    });

    this.context.Core.eventManager.emit('layer:selected', { id });
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
      // Reparent into folder
      layerManager.reparentObject(this.draggedLayerId, targetLayerId);
    } else {
      // Reorder at same level
      // This is a simplified implementation - in a full implementation,
      // you would calculate the exact index considering the drop position
      // For now, we'll just emit an event
      this.context.Core.eventManager.emit('layer:dropReorder', {
        draggedId: this.draggedLayerId,
        targetId: targetLayerId,
        position: isTopHalf ? 'before' : 'after'
      });
      
      // Note: A complete implementation would need to calculate indices
      // and call layerManager.reorderObject() with the correct index
      console.log('Reorder not fully implemented - would move', this.draggedLayerId, 
                  isTopHalf ? 'before' : 'after', targetLayerId);
    }
  }
}
