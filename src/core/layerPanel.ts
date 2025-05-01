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
  private eventManager: EventManager;  private isEditing: boolean = false;
  
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
      <div class="layer-panel__list">
        ${layers.map((layer, idx) => `
          <div class="layer-panel__item${idx === activeLayerIdx ? ' active' : ''}" data-idx="${idx}">
            <span class="layer-panel__color" style="background:${layer.color}"></span>            <span class="layer-panel__name" contenteditable="true" spellcheck="false">${layer.name}</span>
            <button class="layer-panel__icon-btn layer-panel__visible-btn" title="Toggle Visibility">${layer.visible ? '👁' : '<svg width=14 height=14><line x1=2 y1=2 x2=12 y2=12 stroke=gray stroke-width=2/><line x1=12 y1=2 x2=2 y2=12 stroke=gray stroke-width=2/></svg>'}</button>
            <button class="layer-panel__icon-btn layer-panel__lock-btn" title="Toggle Lock">${layer.locked ? '🔒' : '🔓'}</button>
            <button class="layer-panel__up-btn" title="Move Up">▲</button>
            <button class="layer-panel__down-btn" title="Move Down">▼</button>
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
  }

  private attachItemControls() {
    const items = this.container.querySelectorAll('.layer-panel__item');
    items.forEach(item => {
      const idx = parseInt(item.getAttribute('data-idx') || '0', 10);      // Layer selection
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
        // Up
      const upBtn = item.querySelector('.layer-panel__up-btn') as HTMLButtonElement;
      if (upBtn) upBtn.onclick = () => {
        const layers = this.stateManager.getState().layers.slice();
        if (idx > 0) {
          const [moved] = layers.splice(idx, 1);
          layers.splice(idx - 1, 0, moved);
          this.stateManager.updateLayers(layers);
          this.eventManager.emit('layerReordered', layers);
        }
      };
      // Down
      const downBtn = item.querySelector('.layer-panel__down-btn') as HTMLButtonElement;
      if (downBtn) downBtn.onclick = () => {
        const layers = this.stateManager.getState().layers.slice();
        if (idx < layers.length - 1) {
          const [moved] = layers.splice(idx, 1);
          layers.splice(idx + 1, 0, moved);
          this.stateManager.updateLayers(layers);
          this.eventManager.emit('layerReordered', layers);
        }
      };      // Rename
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
          layers[idx].name = nameSpan.textContent?.trim() || 'Layer';
          this.stateManager.updateLayers(layers);
          if (oldName !== layers[idx].name) {
            this.eventManager.emit('layerRenamed', { idx, name: layers[idx].name });
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
