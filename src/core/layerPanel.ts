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

  constructor(container: HTMLElement, stateManager: StateManager, eventManager: EventManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.eventManager = eventManager;
    this.eventManager.subscribe('stateChange', () => this.render());
    this.render();
    this.attachHeaderControls();
  }

  private attachHeaderControls() {
    // Add button for adding a new layer
    const header = this.container.querySelector('.layer-panel__header');
    if (header) {
      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.title = 'Add Layer';
      addBtn.className = 'layer-panel__add-btn';
      addBtn.onclick = () => this.addLayer();
      header.appendChild(addBtn);
    }
  }

  private addLayer() {
    const layers = this.stateManager.getState().layers.slice();
    layers.unshift({ name: 'New Layer', color: '#888', visible: true, locked: false });
    this.stateManager.updateLayers(layers);
    this.eventManager.emit('layerAdded', layers[0]);
  }

  render() {
    const layers = this.stateManager.getState().layers;
    this.container.innerHTML = `
      <div class="layer-panel__header">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="layer-panel__list">
        ${layers.map((layer, idx) => `
          <div class="layer-panel__item${idx === 0 ? ' active' : ''}" data-idx="${idx}">
            <span class="layer-panel__color" style="background:${layer.color}"></span>
            <span class="layer-panel__name" contenteditable="true" spellcheck="false">${layer.name}</span>
            <button class="layer-panel__icon-btn layer-panel__visible-btn" title="Toggle Visibility">${layer.visible ? '👁' : '<svg width=14 height=14><line x1=2 y1=2 x2=12 y2=12 stroke=gray stroke-width=2/><line x1=12 y1=2 x2=2 y2=12 stroke=gray stroke-width=2/></svg>'}</button>
            <button class="layer-panel__icon-btn layer-panel__lock-btn" title="Toggle Lock">${layer.locked ? '🔒' : '🔓'}</button>
            <button class="layer-panel__remove-btn" title="Remove Layer">✖</button>
            <button class="layer-panel__up-btn" title="Move Up">▲</button>
            <button class="layer-panel__down-btn" title="Move Down">▼</button>
          </div>
        `).join('')}
      </div>
      <div class="layer-panel__footer">
        <button class="layer-panel__icon-btn" title="Add Folder">📁</button>
      </div>
    `;
    this.attachItemControls();
    this.attachHeaderControls();
  }

  private attachItemControls() {
    const items = this.container.querySelectorAll('.layer-panel__item');
    items.forEach(item => {
      const idx = parseInt(item.getAttribute('data-idx') || '0', 10);
      // Remove
      const removeBtn = item.querySelector('.layer-panel__remove-btn') as HTMLButtonElement;
      if (removeBtn) removeBtn.onclick = () => {
        const layers = this.stateManager.getState().layers.slice();
        const removed = layers.splice(idx, 1)[0];
        this.stateManager.updateLayers(layers);
        this.eventManager.emit('layerRemoved', removed);
      };
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
      };
      // Rename
      const nameSpan = item.querySelector('.layer-panel__name') as HTMLSpanElement;
      if (nameSpan) {
        nameSpan.onblur = () => {
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
