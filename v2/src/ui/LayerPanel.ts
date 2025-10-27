import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer } from '../data/ITimeLineData';

export class LayerPanel {
  private context: IJsTimeLineContext;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
  }

  /**
   * Render the layer panel with all layers
   */
  public render(): void {
    const data = this.context.Data.getData();
    const container = this.context.UI.layerPanelContent;

    // Clear existing content
    container.innerHTML = '';

    // Render all layers recursively
    this.renderLayers(data.layers, container, 0);
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

      // If this is a folder with children, recursively render them
      if (layer.type === 'folder' && layer.children && layer.children.length > 0) {
        this.renderLayers(layer.children, container, depth + 1);
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

    // Apply indentation for nested layers
    if (depth > 0) {
      row.style.paddingLeft = `${depth * 20}px`;
    }

    // Create layer controls container (left side)
    const controls = document.createElement('div');
    controls.className = 'layer-controls';

    // Folder icon or expand/collapse button
    if (layer.type === 'folder') {
      const folderIcon = document.createElement('span');
      folderIcon.className = 'layer-icon layer-icon-folder';
      folderIcon.textContent = '▶'; // Could use actual icon
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
    controls.appendChild(visibilityBtn);

    // Lock toggle
    const lockBtn = document.createElement('button');
    lockBtn.className = 'layer-btn layer-btn-lock';
    lockBtn.setAttribute('title', 'Toggle lock');
    lockBtn.textContent = layer.locked ? '🔒' : '🔓';
    controls.appendChild(lockBtn);

    // Create layer name container (right side)
    const nameContainer = document.createElement('div');
    nameContainer.className = 'layer-name';
    nameContainer.textContent = layer.name;

    // Assemble the row
    row.appendChild(controls);
    row.appendChild(nameContainer);

    return row;
  }
}
