import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ILayer, IKeyframe, ITween } from '../data/ITimeLineData';
import { IMenuItem } from './ContextMenu';

/**
 * TimelineGrid Component
 * Renders the main timeline grid with frames, keyframes, and tweens for each layer
 */
export class TimelineGrid {
  private context: IJsTimeLineContext;
  private gridContent: HTMLElement;
  private collapsedFolders: Set<string> = new Set();
  private draggedFrames: string[] = [];
  private dropIndicator: HTMLElement | null = null;
  private contextMenuTrigger: HTMLElement | null = null;
  private isTouchDevice: boolean = false;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
    this.gridContent = context.UI.gridContent;
    this.isTouchDevice = this.detectTouchDevice();
    this.restoreCollapsedState();
    this.createDropIndicator();
    this.setupContextMenu();
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

    // Listen to selection changes
    const selectionManager = this.context.Core.selectionManager;
    const eventManager = this.context.Core.eventManager;
    
    if (!selectionManager || !eventManager) return;

    // Listen for selection changes
    eventManager.on('onSelectionChange', () => {
      this.updateContextMenuTrigger();
    });
  }

  /**
   * Update context menu trigger position based on selection
   */
  private updateContextMenuTrigger(): void {
    const selectionManager = this.context.Core.selectionManager;
    if (!selectionManager) return;

    const selectedFrames = selectionManager.getSelectedFrames();
    
    // Remove existing trigger
    if (this.contextMenuTrigger) {
      this.contextMenuTrigger.remove();
      this.contextMenuTrigger = null;
    }

    // Only show trigger if exactly one frame is selected
    if (selectedFrames.length !== 1) return;

    const frameId = selectedFrames[0];
    const frameElement = this.gridContent.querySelector(`[data-frame-id="${frameId}"]`) as HTMLElement;
    
    if (!frameElement) return;

    // Create trigger icon
    this.contextMenuTrigger = document.createElement('div');
    this.contextMenuTrigger.className = 'context-menu-trigger';
    this.contextMenuTrigger.innerHTML = '⋮'; // Three dots

    // Position relative to frame
    const frameRect = frameElement.getBoundingClientRect();
    const gridRect = this.gridContent.getBoundingClientRect();
    
    this.contextMenuTrigger.style.position = 'absolute';
    this.contextMenuTrigger.style.left = `${frameRect.right - gridRect.left - 40}px`;
    this.contextMenuTrigger.style.top = `${frameRect.top - gridRect.top + 4}px`;

    // Add click handler
    this.contextMenuTrigger.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Simulate right-click on the frame element
      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: frameRect.left + frameRect.width / 2,
        clientY: frameRect.top + frameRect.height / 2
      });
      frameElement.dispatchEvent(contextMenuEvent);
    });

    this.gridContent.appendChild(this.contextMenuTrigger);
  }

  /**
   * Setup context menu for frame and keyframe operations
   */
  private setupContextMenu(): void {
    this.gridContent.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();

      const target = e.target as HTMLElement;
      const frameId = target.dataset.frameId;

      if (!frameId) return;

      const selectionManager = this.context.Core.selectionManager;
      const tweenManager = this.context.Core.tweenManager;
      const keyframeManager = this.context.Core.keyframeManager;
      const contextMenu = this.context.UI.contextMenu;
      
      if (!selectionManager || !tweenManager || !keyframeManager || !contextMenu) return;

      const [layerId, frameStr] = frameId.split(':');
      const frame = parseInt(frameStr, 10);
      const data = this.context.Data.getData();
      const layer = this.findLayerById(data.layers, layerId);
      
      if (!layer) return;

      // Check context of the click
      const hasKeyframe = layer.keyframes?.some(kf => kf.frame === frame);
      const isInTween = tweenManager.isFrameInTween(layerId, frame);
      const selectedFrames = selectionManager.getSelectedFrames();
      const hasSelection = selectedFrames.length > 0;

      const menuItems: IMenuItem[] = [];

      // Check for 2 selected keyframes for tween creation
      if (selectedFrames.length === 2) {
        const [layerId1, frame1Str] = selectedFrames[0].split(':');
        const [layerId2, frame2Str] = selectedFrames[1].split(':');

        if (layerId1 === layerId2) {
          const frame1 = parseInt(frame1Str, 10);
          const frame2 = parseInt(frame2Str, 10);
          const startFrame = Math.min(frame1, frame2);
          const endFrame = Math.max(frame1, frame2);

          const layer1 = this.findLayerById(data.layers, layerId1);
          if (layer1 && layer1.keyframes) {
            const hasStartKf = layer1.keyframes.some(kf => kf.frame === startFrame);
            const hasEndKf = layer1.keyframes.some(kf => kf.frame === endFrame);

            if (hasStartKf && hasEndKf) {
              menuItems.push({
                label: 'Create Motion Tween',
                action: () => {
                  tweenManager.createMotionTween(layerId1, startFrame, endFrame);
                }
              });
              menuItems.push({ separator: true });
            }
          }
        }
      }

      // Check if clicking on a tween
      if (isInTween) {
        const tween = tweenManager.getTweenAtFrame(layerId, frame);
        if (tween) {
          menuItems.push({
            label: 'Tween Properties...',
            action: () => {
              const dialog = this.context.UI.tweenPropertiesDialog;
              if (dialog) {
                dialog.show(layerId, tween, (updatedTween: any) => {
                  tweenManager.updateTween(layerId, tween, updatedTween);
                });
              }
            }
          });
          menuItems.push({
            label: 'Remove Motion Tween',
            action: () => {
              tweenManager.removeTween(layerId, tween.startFrame, tween.endFrame);
            }
          });
          menuItems.push({ separator: true });
        }
      }

      // Common frame operations
      if (hasKeyframe) {
        // Keyframe-specific operations
        menuItems.push({
          label: 'Insert Frame',
          action: () => {
            keyframeManager.insertFrame(layerId, frame);
          }
        });
        menuItems.push({
          label: 'Delete Frames',
          action: () => {
            if (hasSelection) {
              // Delete selected frames - convert to layer-specific ranges
              // For simplicity, delete current frame
              keyframeManager.deleteFrames(layerId, frame, frame);
            } else {
              keyframeManager.deleteFrames(layerId, frame, frame);
            }
          }
        });
        menuItems.push({ separator: true });
        menuItems.push({
          label: 'Insert Keyframe',
          action: () => {
            keyframeManager.insertKeyframe(layerId, frame);
          }
        });
        menuItems.push({
          label: 'Insert Blank Keyframe',
          action: () => {
            keyframeManager.insertBlankKeyframe(layerId, frame);
          }
        });
        menuItems.push({
          label: 'Clear Keyframe',
          action: () => {
            keyframeManager.deleteKeyframe(layerId, frame);
          }
        });
      } else {
        // Empty frame operations
        menuItems.push({
          label: 'Insert Frame',
          action: () => {
            keyframeManager.insertFrame(layerId, frame);
          }
        });
        menuItems.push({
          label: 'Insert Keyframe',
          action: () => {
            keyframeManager.insertKeyframe(layerId, frame);
          }
        });
        menuItems.push({
          label: 'Insert Blank Keyframe',
          action: () => {
            keyframeManager.insertBlankKeyframe(layerId, frame);
          }
        });
      }

      // Copy/Paste operations
      menuItems.push({ separator: true });
      menuItems.push({
        label: 'Copy Frames',
        enabled: hasSelection || hasKeyframe,
        action: () => {
          if (hasSelection) {
            keyframeManager.copyKeyframes(selectedFrames);
          } else {
            keyframeManager.copyKeyframes([frameId]);
          }
        }
      });

      const clipboard = this.context.Core.stateManager?.get('clipboard_keyframes');
      const hasClipboard = clipboard && Array.isArray(clipboard) && clipboard.length > 0;
      
      menuItems.push({
        label: 'Paste Frames',
        enabled: hasClipboard,
        action: () => {
          keyframeManager.pasteKeyframes(layerId, frame);
        }
      });

      // Show menu if we have any items
      if (menuItems.length > 0) {
        contextMenu.show(e.clientX, e.clientY, menuItems);
      }
    });
  }

  /**
   * Find a layer by ID
   */
  private findLayerById(layers: readonly ILayer[], layerId: string): ILayer | null {
    for (const layer of layers) {
      if (layer.id === layerId) {
        return layer as ILayer;
      }
      if (layer.children) {
        const found = this.findLayerById(layer.children, layerId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Create a drop indicator for visual feedback during drag
   */
  private createDropIndicator(): void {
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'grid-drop-indicator';
    this.dropIndicator.style.display = 'none';
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
   * Update collapsed folders from current state
   * Called when folder collapse state changes
   */
  public updateCollapsedState(): void {
    this.restoreCollapsedState();
  }

  /**
   * Main render method - clears and rebuilds the entire grid
   */
  public render(): void {
    // Clear existing content
    this.gridContent.innerHTML = '';

    // Get data from context
    const data = this.context.Data.getData();
    if (!data) {
      console.warn('No timeline data available to render');
      return;
    }

    const { settings, layers } = data;
    const totalFrames = settings.totalFrames;
    const frameWidth = settings.frameWidth ?? 15;
    const rowHeight = settings.rowHeight ?? 30;

    // Set grid content dimensions based on total frames and layers
    const totalRows = this.countLayers(layers);
    const gridWidth = totalFrames * frameWidth;
    const gridHeight = totalRows * rowHeight;

    this.gridContent.style.width = `${gridWidth}px`;
    this.gridContent.style.height = `${gridHeight}px`;

    // Remove temporary test background
    this.gridContent.style.background = 'none';

    // Render all layers recursively
    let rowIndex = 0;
    this.renderLayers(layers, 0, rowIndex, totalFrames, frameWidth, rowHeight);
  }

  /**
   * Count total number of layers (including nested layers in folders)
   * Only counts visible layers (respecting collapsed folders)
   */
  private countLayers(layers: readonly ILayer[]): number {
    let count = 0;
    for (const layer of layers) {
      count++;
      if (layer.type === 'folder' && layer.children && !this.collapsedFolders.has(layer.id)) {
        count += this.countLayers(layer.children);
      }
    }
    return count;
  }

  /**
   * Render layers recursively, handling both regular layers and folders
   * Only renders visible layers (respecting collapsed folders)
   */
  private renderLayers(layers: readonly ILayer[], depth: number, startRow: number, totalFrames: number, frameWidth: number, rowHeight: number): number {
    let currentRow = startRow;

    for (const layer of layers) {
      // Create row container for this layer
      this.renderLayerRow(layer, currentRow, totalFrames, frameWidth, rowHeight);
      currentRow++;

      // If this is a folder, recursively render children only if not collapsed
      if (layer.type === 'folder' && layer.children && !this.collapsedFolders.has(layer.id)) {
        currentRow = this.renderLayers(layer.children, depth + 1, currentRow, totalFrames, frameWidth, rowHeight);
      }
    }

    return currentRow;
  }

  /**
   * Render a single layer row with all its frames
   */
  private renderLayerRow(layer: ILayer, rowIndex: number, totalFrames: number, frameWidth: number, rowHeight: number): void {
    // Create row container
    const rowElement = document.createElement('div');
    rowElement.className = 'grid-row';
    rowElement.style.position = 'absolute';
    rowElement.style.left = '0';
    rowElement.style.top = `${rowIndex * rowHeight}px`;
    rowElement.style.width = `${totalFrames * frameWidth}px`;
    rowElement.style.height = `${rowHeight}px`;
    rowElement.dataset.layerId = layer.id;

    // For folders, just render empty frames
    if (layer.type === 'folder') {
      this.renderEmptyFrames(rowElement, totalFrames, frameWidth, rowHeight);
      this.gridContent.appendChild(rowElement);
      return;
    }

    // For regular layers, render frames based on keyframes and tweens
    this.renderFrames(rowElement, layer, frameWidth, rowHeight, totalFrames);
    this.gridContent.appendChild(rowElement);
  }

  /**
   * Render empty frames for folder rows
   */
  private renderEmptyFrames(container: HTMLElement, totalFrames: number, frameWidth: number, rowHeight: number): void {
    for (let frame = 1; frame <= totalFrames; frame++) {
      const frameElement = document.createElement('div');
      frameElement.className = 'grid-frame';
      frameElement.style.position = 'absolute';
      frameElement.style.left = `${(frame - 1) * frameWidth}px`;
      frameElement.style.top = '0';
      frameElement.style.width = `${frameWidth}px`;
      frameElement.style.height = `${rowHeight}px`;
      container.appendChild(frameElement);
    }
  }

  /**
   * Render frames for a regular layer, determining frame type contextually
   */
  private renderFrames(container: HTMLElement, layer: ILayer, frameWidth: number, rowHeight: number, totalFrames: number): void {
    const keyframes = layer.keyframes || [];
    const tweens = layer.tweens || [];

    // Sort keyframes by frame number
    const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

    // Track the last keyframe to determine standard frames
    let lastKeyframe: IKeyframe | null = null;

    for (let frame = 1; frame <= totalFrames; frame++) {
      // Check if this frame is a keyframe
      const keyframe = sortedKeyframes.find(kf => kf.frame === frame);
      
      if (keyframe) {
        // This is a keyframe
        const isEmpty = keyframe.isEmpty ?? false;
        this.renderKeyframe(container, frame, isEmpty, frameWidth, rowHeight, layer.id);
        lastKeyframe = keyframe;
      } else {
        // Check if this frame is part of a tween
        const tween = tweens.find(tw => frame > tw.startFrame && frame <= tw.endFrame);
        
        if (tween) {
          // This is part of a tween sequence
          this.renderTweenFrame(container, frame, tween, frameWidth, rowHeight, layer.id);
        } else if (lastKeyframe && !lastKeyframe.isEmpty) {
          // This is a standard frame (content persists from last keyframe)
          this.renderStandardFrame(container, frame, frameWidth, rowHeight, layer.id);
        } else {
          // This is an empty frame
          this.renderEmptyFrame(container, frame, frameWidth, rowHeight, layer.id);
        }
      }
    }

    // Render tween overlays (arrows and backgrounds)
    this.renderTweens(container, tweens, frameWidth, rowHeight);
  }

  /**
   * Render a keyframe (solid or hollow circle)
   */
  private renderKeyframe(container: HTMLElement, frame: number, isEmpty: boolean, frameWidth: number, rowHeight: number, layerId: string): void {
    const frameElement = document.createElement('div');
    frameElement.className = isEmpty ? 'grid-keyframe-empty' : 'grid-keyframe';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    frameElement.dataset.layerId = layerId;
    frameElement.dataset.frameId = `${layerId}:${frame}`;
    frameElement.setAttribute('draggable', 'true');
    frameElement.setAttribute('role', 'gridcell');
    frameElement.setAttribute('aria-label', `${isEmpty ? 'Empty keyframe' : 'Keyframe'} at frame ${frame}`);
    frameElement.setAttribute('tabindex', '-1');
    this.addFrameClickHandler(frameElement);
    this.addFrameDragHandlers(frameElement);
    container.appendChild(frameElement);
  }

  /**
   * Render a standard frame (content persists from previous keyframe)
   */
  private renderStandardFrame(container: HTMLElement, frame: number, frameWidth: number, rowHeight: number, layerId: string): void {
    const frameElement = document.createElement('div');
    frameElement.className = 'grid-frame-standard';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    frameElement.dataset.layerId = layerId;
    frameElement.dataset.frameId = `${layerId}:${frame}`;
    frameElement.setAttribute('role', 'gridcell');
    frameElement.setAttribute('aria-label', `Standard frame at frame ${frame}`);
    frameElement.setAttribute('tabindex', '-1');
    this.addFrameClickHandler(frameElement);
    this.addFrameDropTarget(frameElement);
    container.appendChild(frameElement);
  }

  /**
   * Render an empty frame
   */
  private renderEmptyFrame(container: HTMLElement, frame: number, frameWidth: number, rowHeight: number, layerId: string): void {
    const frameElement = document.createElement('div');
    frameElement.className = 'grid-frame';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    frameElement.dataset.layerId = layerId;
    frameElement.dataset.frameId = `${layerId}:${frame}`;
    frameElement.setAttribute('role', 'gridcell');
    frameElement.setAttribute('aria-label', `Empty frame at frame ${frame}`);
    frameElement.setAttribute('tabindex', '-1');
    this.addFrameClickHandler(frameElement);
    this.addFrameDropTarget(frameElement);
    container.appendChild(frameElement);
  }

  /**
   * Render a frame that is part of a tween sequence
   */
  private renderTweenFrame(container: HTMLElement, frame: number, tween: ITween, frameWidth: number, rowHeight: number, layerId: string): void {
    const frameElement = document.createElement('div');
    frameElement.className = 'grid-frame-tween';
    frameElement.style.position = 'absolute';
    frameElement.style.left = `${(frame - 1) * frameWidth}px`;
    frameElement.style.top = '0';
    frameElement.style.width = `${frameWidth}px`;
    frameElement.style.height = `${rowHeight}px`;
    frameElement.dataset.frame = frame.toString();
    frameElement.dataset.layerId = layerId;
    frameElement.dataset.frameId = `${layerId}:${frame}`;
    frameElement.setAttribute('role', 'gridcell');
    frameElement.setAttribute('aria-label', `Tween frame at frame ${frame}, ${tween.type || 'motion'} tween`);
    frameElement.setAttribute('tabindex', '-1');
    this.addFrameClickHandler(frameElement);
    container.appendChild(frameElement);
  }

  /**
   * Render tween overlays (backgrounds and arrows)
   */
  private renderTweens(container: HTMLElement, tweens: readonly ITween[], frameWidth: number, rowHeight: number): void {
    for (const tween of tweens) {
      const tweenElement = document.createElement('div');
      tweenElement.className = 'grid-tween';
      tweenElement.style.position = 'absolute';
      tweenElement.style.left = `${tween.startFrame * frameWidth}px`;
      tweenElement.style.top = '0';
      tweenElement.style.width = `${(tween.endFrame - tween.startFrame) * frameWidth}px`;
      tweenElement.style.height = `${rowHeight}px`;
      tweenElement.dataset.tweenType = tween.type ?? 'linear';
      tweenElement.dataset.startFrame = tween.startFrame.toString();
      tweenElement.dataset.endFrame = tween.endFrame.toString();
      
      // Add double-click handler to open tween properties dialog
      tweenElement.addEventListener('dblclick', (e: MouseEvent) => {
        e.stopPropagation();
        const dialog = this.context.UI.tweenPropertiesDialog;
        const tweenManager = this.context.Core.tweenManager;
        
        // Find the layer ID from the parent container
        const layerRow = tweenElement.closest('.grid-row');
        const layerId = layerRow?.getAttribute('data-layer-id');
        
        if (dialog && tweenManager && layerId) {
          dialog.show(layerId, tween, (updatedTween: any) => {
            tweenManager.updateTween(layerId, tween, updatedTween);
          });
        }
      });
      
      container.appendChild(tweenElement);
    }
  }

  /**
   * Add click handler to a frame element for selection
   */
  private addFrameClickHandler(frameElement: HTMLElement): void {
    frameElement.addEventListener('click', (e: MouseEvent) => {
      const frameId = frameElement.dataset.frameId;
      if (!frameId) return;

      const selectionManager = this.context.Core.selectionManager;
      if (!selectionManager) return;

      // Handle different click modes
      if (e.ctrlKey || e.metaKey) {
        // CTRL/CMD + click: Toggle selection
        selectionManager.toggleSelection(frameId);
      } else if (e.shiftKey) {
        // Shift + click: Range selection
        const lastSelected = selectionManager.getLastSelectedFrame();
        if (lastSelected) {
          selectionManager.selectRange(lastSelected, frameId);
        } else {
          selectionManager.selectFrame(frameId);
        }
      } else {
        // Normal click: Single selection
        selectionManager.selectFrame(frameId);
      }

      // Update visual feedback
      this.updateSelectionVisuals();
    });
  }

  /**
   * Update visual feedback for selected frames
   */
  private updateSelectionVisuals(): void {
    const selectionManager = this.context.Core.selectionManager;
    if (!selectionManager) return;

    // Remove all existing selection classes
    const allFrames = this.gridContent.querySelectorAll('[data-frame-id]');
    allFrames.forEach(frame => {
      frame.classList.remove('selected');
    });

    // Add selection class to selected frames
    const selectedFrames = selectionManager.getSelectedFrames();
    selectedFrames.forEach(frameId => {
      const frameElement = this.gridContent.querySelector(`[data-frame-id="${frameId}"]`);
      if (frameElement) {
        frameElement.classList.add('selected');
      }
    });
  }

  /**
   * Add drag-and-drop handlers to a frame element
   */
  private addFrameDragHandlers(frameElement: HTMLElement): void {
    // Dragstart: Store dragged frame IDs
    frameElement.addEventListener('dragstart', (e: DragEvent) => {
      const frameId = frameElement.dataset.frameId;
      if (!frameId) return;

      const selectionManager = this.context.Core.selectionManager;
      if (!selectionManager) return;

      // If dragging a selected frame, drag all selected frames
      if (selectionManager.isSelected(frameId)) {
        this.draggedFrames = selectionManager.getSelectedFrames();
      } else {
        // If dragging a non-selected frame, drag only this frame
        this.draggedFrames = [frameId];
        selectionManager.selectFrame(frameId);
        this.updateSelectionVisuals();
      }

      // Set drag data
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedFrames));
      }

      // Add dragging class
      frameElement.classList.add('dragging');
    });

    // Dragend: Clean up
    frameElement.addEventListener('dragend', (e: DragEvent) => {
      frameElement.classList.remove('dragging');
      this.hideDropIndicator();
      this.draggedFrames = [];
    });
  }

  /**
   * Add drop target handlers to a frame element
   */
  private addFrameDropTarget(frameElement: HTMLElement): void {
    // Dragover: Show drop indicator
    frameElement.addEventListener('dragover', (e: DragEvent) => {
      if (this.draggedFrames.length === 0) return;
      
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const targetFrameId = frameElement.dataset.frameId;
      if (targetFrameId) {
        this.showDropIndicator(targetFrameId);
      }
    });

    // Drop: Move keyframes
    frameElement.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      
      const targetFrameId = frameElement.dataset.frameId;
      if (!targetFrameId || this.draggedFrames.length === 0) return;

      const [targetLayerId, targetFrameStr] = targetFrameId.split(':');
      const targetFrame = parseInt(targetFrameStr, 10);

      const keyframeManager = this.context.Core.keyframeManager;
      if (keyframeManager) {
        const success = keyframeManager.moveKeyframes(this.draggedFrames, targetLayerId, targetFrame);
        if (success) {
          // Update selection to new positions
          const [sourceLayerId, sourceFrameStr] = this.draggedFrames[0].split(':');
          const sourceFrame = parseInt(sourceFrameStr, 10);
          const frameOffset = targetFrame - sourceFrame;

          const selectionManager = this.context.Core.selectionManager;
          if (selectionManager) {
            selectionManager.clearSelection();
            this.draggedFrames.forEach(frameId => {
              const [layerId, frameStr] = frameId.split(':');
              const frame = parseInt(frameStr, 10);
              const newFrameId = `${targetLayerId}:${frame + frameOffset}`;
              selectionManager.toggleSelection(newFrameId);
            });
          }
        }
      }

      this.hideDropIndicator();
      this.draggedFrames = [];
    });
  }

  /**
   * Show drop indicator at target position
   */
  private showDropIndicator(targetFrameId: string): void {
    if (!this.dropIndicator) return;

    const targetElement = this.gridContent.querySelector(`[data-frame-id="${targetFrameId}"]`) as HTMLElement;
    if (!targetElement) return;

    // Position the drop indicator
    this.dropIndicator.style.display = 'block';
    this.dropIndicator.style.left = targetElement.style.left;
    this.dropIndicator.style.top = targetElement.offsetTop + 'px';
    this.dropIndicator.style.width = targetElement.style.width;
    this.dropIndicator.style.height = targetElement.style.height;

    // Append to grid if not already there
    if (!this.dropIndicator.parentElement) {
      this.gridContent.appendChild(this.dropIndicator);
    }
  }

  /**
   * Hide drop indicator
   */
  private hideDropIndicator(): void {
    if (this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
    }
  }
}
