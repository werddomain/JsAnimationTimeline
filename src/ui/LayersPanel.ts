/**
 * Layers Panel UI Component for JsAnimationTimeline
 * Manages the left panel with layer list and controls
 * Following the Project Development Guidelines
 */

import { IJsTimeLineContext } from '../interfaces/IJsTimeLineContext';
import { ILayer, LayerType } from '../data/TimelineData';

/**
 * Layers Panel class that manages the layer list UI
 */
export class LayersPanel {
  private _element: HTMLElement;
  private _context: IJsTimeLineContext | null = null;

  constructor() {
    this._element = this._createElement();
  }

  /**
   * Initialize the layers panel with context
   */
  public initialize(context: IJsTimeLineContext): void {
    this._context = context;
    this._setupEventListeners();
    this._registerScrollElement();
  }

  /**
   * Get the DOM element
   */
  public getElement(): HTMLElement {
    return this._element;
  }

  /**
   * Dispose of the component
   */
  public dispose(): void {
    // Note: No scroll manager unregistration needed since we don't register layers panel for sync
    this._context = null;
  }

  /**
   * Register scroll element with scroll manager
   */
  private _registerScrollElement(): void {
    if (!this._context) return;

    const layersList = this._element.querySelector('[data-js-layers-list]') as HTMLElement;
    if (layersList) {
      // Make the layers list vertically scrollable only (no horizontal sync)
      layersList.style.overflowY = 'auto';
      layersList.style.overflowX = 'hidden';
      layersList.style.maxHeight = '100%';
      
      // Note: Not registering with scroll manager for sync since layers should scroll independently
    }
  }

  /**
   * Create the DOM structure
   */
  private _createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'timeline-layers-panel';
    
    element.innerHTML = `
      <div class="timeline-layers-header">
        <div class="timeline-layers-title">Layers</div>
        <div class="timeline-master-controls">
          <button class="master-visibility" title="Show/Hide All Layers" data-js-master-visibility>👁</button>
          <button class="master-lock" title="Lock/Unlock All Layers" data-js-master-lock>🔒</button>
        </div>
        <div class="timeline-layer-actions">
          <button class="add-layer" title="Add Layer" data-js-add-layer>+</button>
          <button class="add-folder" title="Add Folder" data-js-add-folder>📁</button>
        </div>
      </div>
      <div class="timeline-layers-list" data-js-layers-list>
        <!-- Layer list will be rendered here -->
        <div class="layer-placeholder">No layers yet. Click "+" to create one.</div>
      </div>
    `;
    
    return element;
  }

  /**
   * Setup event listeners
   */
  private _setupEventListeners(): void {
    if (!this._context) return;

    // Add layer button
    const addLayerBtn = this._element.querySelector('[data-js-add-layer]') as HTMLButtonElement;
    if (addLayerBtn) {
      addLayerBtn.addEventListener('click', () => {
        this._context!.Core.eventManager.emit('layer:add-requested', { type: 'layer' });
      });
    }

    // Add folder button
    const addFolderBtn = this._element.querySelector('[data-js-add-folder]') as HTMLButtonElement;
    if (addFolderBtn) {
      addFolderBtn.addEventListener('click', () => {
        this._context!.Core.eventManager.emit('layer:add-requested', { type: 'folder' });
      });
    }

    // Master visibility toggle
    const masterVisibilityBtn = this._element.querySelector('[data-js-master-visibility]') as HTMLButtonElement;
    if (masterVisibilityBtn) {
      masterVisibilityBtn.addEventListener('click', () => {
        this._context!.Core.eventManager.emit('layer:toggle-all-visibility');
      });
    }

    // Master lock toggle
    const masterLockBtn = this._element.querySelector('[data-js-master-lock]') as HTMLButtonElement;
    if (masterLockBtn) {
      masterLockBtn.addEventListener('click', () => {
        this._context!.Core.eventManager.emit('layer:toggle-all-lock');
      });
    }

    // Listen for data changes to update layer list
    this._context.Core.eventManager.on('data:layers-changed', () => {
      this._renderLayerList();
    });
  }

  /**
   * Render the layer list
   */
  private _renderLayerList(): void {
    if (!this._context) return;

    const layersList = this._element.querySelector('[data-js-layers-list]') as HTMLElement;
    if (!layersList) return;

    const layers = this._context.Data.getLayers();
    
    if (layers.length === 0) {
      layersList.innerHTML = '<div class="layer-placeholder">No layers yet. Click "Add Layer" to create one.</div>';
      return;
    }

    // Render layers with Flash MX style indicators
    layersList.innerHTML = layers.map((layer: ILayer) => `
      <div class="timeline-layer-item ${layer.isSelected ? 'selected' : ''} ${layer.isLocked ? 'locked' : ''} ${!layer.isVisible ? 'hidden' : ''}" 
           data-layer-id="${layer.id}">
        <div class="layer-indicators">
          <span class="layer-visibility-indicator ${layer.isVisible ? 'visible' : 'hidden'}" 
                title="${layer.isVisible ? 'Layer is visible' : 'Layer is hidden'}">
            ${layer.isVisible ? '●' : '○'}
          </span>
          <span class="layer-lock-indicator ${layer.isLocked ? 'locked' : 'unlocked'}" 
                title="${layer.isLocked ? 'Layer is locked' : 'Layer is unlocked'}">
            ${layer.isLocked ? '🔒' : '🔓'}
          </span>
        </div>
        <div class="layer-name" 
             data-js-layer-name="${layer.id}" 
             contenteditable="false"
             title="Double-click to rename">${layer.name}</div>
      </div>
    `).join('');

    // Add event listeners for layer interactions
    this._addLayerInteractionListeners();
  }

  /**
   * Add event listeners for layer interactions
   */
  private _addLayerInteractionListeners(): void {
    if (!this._context) return;

    const layersList = this._element.querySelector('[data-js-layers-list]') as HTMLElement;
    if (!layersList) return;

    // Layer selection and renaming
    layersList.querySelectorAll('.timeline-layer-item').forEach(item => {
      const layerId = (item as HTMLElement).dataset.layerId!;
      const nameElement = item.querySelector('[data-js-layer-name]') as HTMLElement;

      // Single click for selection
      item.addEventListener('click', (e) => {
        const mouseEvent = e as MouseEvent;
        const multiSelect = mouseEvent.ctrlKey || mouseEvent.metaKey;
        this._context!.Core.eventManager.emit('layer:select', { layerId, multiSelect });
      });

      // Double click on name for renaming
      if (nameElement) {
        nameElement.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this._startLayerRename(layerId, nameElement);
        });
      }

      // Right-click context menu
      item.addEventListener('contextmenu', (e: Event) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;
        this._showLayerContextMenu(mouseEvent, layerId);
      });
    });
  }

  /**
   * Start renaming a layer
   */
  private _startLayerRename(layerId: string, nameElement: HTMLElement): void {
    const currentName = nameElement.textContent || '';
    
    nameElement.setAttribute('contenteditable', 'true');
    nameElement.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(nameElement);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Handle completion
    const finishRename = () => {
      const newName = nameElement.textContent?.trim() || currentName;
      nameElement.setAttribute('contenteditable', 'false');
      
      if (newName !== currentName && newName) {
        this._context!.Core.eventManager.emit('layer:rename-requested', { layerId, name: newName });
      } else {
        nameElement.textContent = currentName; // Revert if invalid
      }
    };

    // Event listeners for rename completion
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishRename();
        nameElement.removeEventListener('keydown', onKeyDown);
        nameElement.removeEventListener('blur', onBlur);
      } else if (e.key === 'Escape') {
        nameElement.textContent = currentName;
        nameElement.setAttribute('contenteditable', 'false');
        nameElement.removeEventListener('keydown', onKeyDown);
        nameElement.removeEventListener('blur', onBlur);
      }
    };

    const onBlur = () => {
      finishRename();
      nameElement.removeEventListener('keydown', onKeyDown);
      nameElement.removeEventListener('blur', onBlur);
    };

    nameElement.addEventListener('keydown', onKeyDown);
    nameElement.addEventListener('blur', onBlur);
  }

  /**
   * Show context menu for layer
   */
  private _showLayerContextMenu(event: MouseEvent, layerId: string): void {
    // For now, emit an event to let the application handle the context menu
    if (this._context) {
      this._context.Core.eventManager.emit('layer:context-menu', { 
        layerId, 
        x: event.clientX, 
        y: event.clientY 
      });
    }
  }
}