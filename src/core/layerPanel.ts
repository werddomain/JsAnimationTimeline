import { StateManager } from './stateManager';
import { EventManager } from './eventManager';

export interface LayerData {
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export class LayerPanel {
  private container: HTMLElement;
  private stateManager: StateManager;
  private eventManager: EventManager;
  private isEditing: boolean = false;
  // Variable to store the index of the item being dragged
  private dragSourceIdx: number = -1;
  
  constructor(container: HTMLElement, stateManager: StateManager, eventManager: EventManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.eventManager = eventManager;
    this.eventManager.subscribe('stateChange', () => {
      // Don't re-render if we're currently editing a name
      if (!this.isEditing) {
        this.render();
      }
    });
    this.render();
  }private attachFooterControls() {
    // Add button for adding a new layer
    const addBtn = this.container.querySelector('.layer-panel__footer .layer-panel__add-btn') as HTMLButtonElement;
    if (addBtn) {
      addBtn.onclick = () => this.addLayer();
    }

    // Delete button for removing the selected layer
    const deleteBtn = this.container.querySelector('.layer-panel__footer .layer-panel__delete-btn') as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.onclick = () => this.deleteSelectedLayer();
    }
  }

  private deleteSelectedLayer() {
    const state = this.stateManager.getState();
    const activeLayerIdx = state.playhead ? state.playhead.layerIdx : -1;
    
    if (activeLayerIdx < 0 || activeLayerIdx >= state.layers.length) {
      return; // No layer selected or invalid index
    }
    
    const layerName = state.layers[activeLayerIdx].name;
    
    // Show confirmation dialog
    if (confirm(`Are you sure you want to delete the layer "${layerName}"?`)) {
      const layers = state.layers.slice();
      const removed = layers.splice(activeLayerIdx, 1)[0];
      this.stateManager.updateLayers(layers);
      
      // Update playhead if needed
      if (layers.length > 0) {
        const newLayerIdx = Math.min(activeLayerIdx, layers.length - 1);
        this.stateManager.updatePlayhead({
          layerIdx: newLayerIdx,
          frame: state.playhead ? state.playhead.frame : 1
        });
      }
      
      // Emit layer removed event
      this.eventManager.emit('layerRemoved', removed);
    }
  }

  private addLayer() {
    const layers = this.stateManager.getState().layers.slice();
    layers.unshift({ name: 'New Layer', color: '#888', visible: true, locked: false });
    this.stateManager.updateLayers(layers);
    this.eventManager.emit('layerAdded', layers[0]);
  }

  render() {
    const state = this.stateManager.getState();
    const layers = state.layers;
    const activeLayerIdx = state.playhead ? state.playhead.layerIdx : 0;
    
    this.container.innerHTML = `
      <div class="layer-panel__header">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="layer-panel__list">        ${layers.map((layer, idx) => `          <div class="layer-panel__item${idx === activeLayerIdx ? ' active' : ''}" data-idx="${idx}">
            <span class="layer-panel__drag-handle" title="Drag to reorder" aria-label="Drag to reorder layer" role="button" draggable="true">⁞⁞</span>
            <span class="layer-panel__color" style="background:${layer.color}" aria-hidden="true"></span>            <span class="layer-panel__name" contenteditable="true" spellcheck="false" aria-label="Layer name ${layer.name}">${layer.name}</span>
            <button class="layer-panel__icon-btn layer-panel__visible-btn" title="Toggle Visibility" aria-label="Toggle layer visibility - currently ${layer.visible ? 'visible' : 'hidden'}" aria-pressed="${layer.visible}">${layer.visible ? '👁' : '<svg width=14 height=14><line x1=2 y1=2 x2=12 y2=12 stroke=gray stroke-width=2/><line x1=12 y1=2 x2=2 y2=12 stroke=gray stroke-width=2/></svg>'}</button>
            <button class="layer-panel__icon-btn layer-panel__lock-btn" title="Toggle Lock" aria-label="Toggle layer lock - currently ${layer.locked ? 'locked' : 'unlocked'}" aria-pressed="${layer.locked}">${layer.locked ? '🔒' : '🔓'}</button>
            <button class="layer-panel__up-btn" title="Move Up" aria-label="Move layer up"${idx === 0 ? ' disabled' : ''}>▲</button>
            <button class="layer-panel__down-btn" title="Move Down" aria-label="Move layer down"${idx === layers.length - 1 ? ' disabled' : ''}>▼</button>
          </div>
        `).join('')}
      </div>      
      <div class="layer-panel__footer">
        <button class="layer-panel__add-btn" title="Add Layer">+</button>
        <button class="layer-panel__group-btn" title="Add Folder">📁</button>
        <button class="layer-panel__delete-btn" title="Delete Selected Layer">🗑️</button>
      </div>
    `;
    this.attachItemControls();
    this.attachFooterControls();
  }  /**
   * Attaches drag and drop event handlers to a layer item
   * @param item - The layer item element
   * @param idx - The index of the layer
   */
  private attachDragAndDropHandlers(item: Element, idx: number): void {    // Dragstart event - when user starts dragging the item
    item.addEventListener('dragstart', (e: Event) => {
      const dragEvent = e as DragEvent;
      const target = dragEvent.target as HTMLElement;
      
      // Check if the drag started from the drag handle
      // Using classList.contains instead of closest for more reliable detection
      if (target.classList && target.classList.contains('layer-panel__drag-handle') || 
          (target.parentElement && target.parentElement.classList.contains('layer-panel__drag-handle'))) {
        this.dragSourceIdx = idx;
        item.classList.add('dragging');
        
        console.log(`LayerPanel: Started dragging layer ${idx}`);
        
        // Set the drag effect and data
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.effectAllowed = 'move';
          dragEvent.dataTransfer.setData('text/plain', idx.toString());
          // Use the whole item as drag image for better visual feedback
          dragEvent.dataTransfer.setDragImage(item, 10, 10);
        }
      } else {
        // Prevent dragging if not initiated from the drag handle
        e.preventDefault();
        console.log('LayerPanel: Prevented drag - not from handle', target.className);
      }
    });
    
    // Dragend event - when the drag operation ends
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      this.dragSourceIdx = -1;
      
      // Remove all drag-over classes
      const allItems = this.container.querySelectorAll('.layer-panel__item');
      allItems.forEach(i => i.classList.remove('drag-over'));
    });
    
    // Dragover event - while dragging over a potential drop target
    item.addEventListener('dragover', (e: Event) => {
      // Prevent default to allow drop
      e.preventDefault();
      const dragEvent = e as DragEvent;
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = 'move';
      }
    });
    
    // Dragenter event - when entering a potential drop target
    item.addEventListener('dragenter', (e: Event) => {
      e.preventDefault();
      if (this.dragSourceIdx !== idx) {
        item.classList.add('drag-over');
      }
    });
    
    // Dragleave event - when leaving a potential drop target
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    
    // Drop event - when releasing the dragged item
    item.addEventListener('drop', (e: Event) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      // Get the source index from the dragged data
      const draggedIdx = this.dragSourceIdx;
      const targetIdx = idx;
      
      if (draggedIdx !== -1 && draggedIdx !== targetIdx) {
        console.log(`LayerPanel: Dropped layer ${draggedIdx} onto position ${targetIdx}`);
        this.reorderLayer(draggedIdx, targetIdx);
      } else {
        console.log('LayerPanel: Drop canceled or dropped on same position');
      }
    });
  }
  
  /**
   * Reorders a layer from source index to target index
   * @param sourceIdx - The index of the layer to move
   * @param targetIdx - The target position index
   */
  private reorderLayer(sourceIdx: number, targetIdx: number): void {
    const state = this.stateManager.getState();
    const layers = state.layers.slice();
    
    // Store the active layer information before reordering
    const activeLayerIdx = state.playhead ? state.playhead.layerIdx : -1;
    const activeLayer = activeLayerIdx >= 0 ? layers[activeLayerIdx] : null;
    
    // Move the layer from source to target position
    const [movedLayer] = layers.splice(sourceIdx, 1);
    layers.splice(targetIdx, 0, movedLayer);
    
    console.log('LayerPanel: Layer order updated:', layers.map(l => l.name));
    
    // Update the state and emit event
    this.stateManager.updateLayers(layers);
    this.eventManager.emit('layerReordered', layers);
    
    // Update playhead's layer index if active layer was moved
    if (activeLayer) {
      const newActiveLayerIdx = layers.findIndex(layer => 
        layer.name === activeLayer.name);
      if (newActiveLayerIdx >= 0 && newActiveLayerIdx !== activeLayerIdx) {
        console.log(`LayerPanel: Updating active layer index from ${activeLayerIdx} to ${newActiveLayerIdx}`);
        this.stateManager.updatePlayhead({
          layerIdx: newActiveLayerIdx,
          frame: state.playhead ? state.playhead.frame : 1
        });
      }
    }
  }
  
  private attachItemControls() {
    const items = this.container.querySelectorAll('.layer-panel__item');
    items.forEach(item => {
      const idx = parseInt(item.getAttribute('data-idx') || '0', 10);
      
      // Layer selection
      item.addEventListener('click', (e) => {
        // Skip if the click was on a button or we're editing
        if ((e.target as HTMLElement).tagName === 'BUTTON' || this.isEditing) {
          return;
        }
        
        // Note: We no longer skip layer-panel__name clicks here as we handle them separately
        // Update active class
        const allItems = this.container.querySelectorAll('.layer-panel__item');
        allItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Update playhead layer index
        const state = this.stateManager.getState();
        
        // Emit layer selection event first to ensure UI updates
        console.log('LayerPanel: Emitting layerSelected event for layer', idx);
        this.eventManager.emit('layerSelected', idx);
        
        // Then update the playhead state
        this.stateManager.updatePlayhead({ 
          layerIdx: idx, 
          frame: state.playhead ? state.playhead.frame : 1 
        });
      });
      
      // Attach drag and drop handlers
      this.attachDragAndDropHandlers(item, idx);
      
      // Up button - kept for accessibility and as alternative to drag and drop
      const upBtn = item.querySelector('.layer-panel__up-btn') as HTMLButtonElement;
      if (upBtn) upBtn.onclick = () => {
        if (idx > 0) {
          this.reorderLayer(idx, idx - 1);
        }
      };
      
      // Down button - kept for accessibility and as alternative to drag and drop
      const downBtn = item.querySelector('.layer-panel__down-btn') as HTMLButtonElement;
      if (downBtn) downBtn.onclick = () => {
        const layers = this.stateManager.getState().layers;
        if (idx < layers.length - 1) {
          this.reorderLayer(idx, idx + 1);
        }
      };// Rename
      const nameSpan = item.querySelector('.layer-panel__name') as HTMLSpanElement;
      if (nameSpan) {        // Add click handler to prevent event propagation to parent
        // but still fire the layer selection event
        nameSpan.onclick = (e: MouseEvent) => {
          e.stopPropagation(); // Prevent bubbling to parent layer-panel__item
          
          console.log('LayerPanel: Layer name clicked for layer', idx);
            // Manually select this layer
          const allItems = this.container.querySelectorAll('.layer-panel__item');
          allItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          
          // Update playhead layer index
          const state = this.stateManager.getState();
          
          // Emit layer selection event first to ensure UI updates
          console.log('LayerPanel: Emitting layerSelected event for layer', idx);
          this.eventManager.emit('layerSelected', idx);
          
          // Then update the playhead state
          this.stateManager.updatePlayhead({ 
            layerIdx: idx, 
            frame: state.playhead ? state.playhead.frame : 1 
          });
        };
          // Add focus handling to prevent re-rendering during edit
        nameSpan.onfocus = () => {
          this.isEditing = true;
        };
          nameSpan.onblur = () => {
          this.isEditing = false;
          const layers = this.stateManager.getState().layers.slice();
          const oldName = layers[idx].name;
          const newName = nameSpan.textContent?.trim() || 'Layer';
          layers[idx].name = newName;
          this.stateManager.updateLayers(layers);
          if (oldName !== newName) {
            // Emit layerRenamed with both old and new names
            this.eventManager.emit('layerRenamed', { 
              idx, 
              name: newName, 
              oldName: oldName,
              newName: newName
            });
          }
        };
        
        nameSpan.onkeydown = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            nameSpan.blur();
          }
        };
      }
      // Visibility
      const visBtn = item.querySelector('.layer-panel__visible-btn') as HTMLButtonElement;
      if (visBtn) visBtn.onclick = () => {
        const layers = this.stateManager.getState().layers.slice();
        layers[idx].visible = !layers[idx].visible;
        this.stateManager.updateLayers(layers);
        this.eventManager.emit('layerVisibilityChanged', { idx, visible: layers[idx].visible });
      };
      // Lock
      const lockBtn = item.querySelector('.layer-panel__lock-btn') as HTMLButtonElement;
      if (lockBtn) lockBtn.onclick = () => {
        const layers = this.stateManager.getState().layers.slice();
        layers[idx].locked = !layers[idx].locked;
        this.stateManager.updateLayers(layers);
        this.eventManager.emit('layerLockChanged', { idx, locked: layers[idx].locked });
      };
    });
  }
}
