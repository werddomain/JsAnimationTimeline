import { StateManager } from './stateManager';
import { EventManager } from './eventManager';

export class TimelineGrid3D {
  private container: HTMLElement;
  private stateManager: StateManager;
  private eventManager: EventManager;
  private frameCount: number;
  private frameWidth: number = 24;
  private rulerHeight: number = 28;
  private tracksEl: HTMLElement | null = null;
  private rulerEl: HTMLElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private isPlaying: boolean = false;
  private playInterval: any = null;
  private suppressSync: boolean = false;
  private rowHeight = 22;
  private scrollTimeout: any = null;
  private scrollHandler: any = null;
  private mouseMoveHandler: (e: MouseEvent) => void = () => {};
  private mouseUpHandler: () => void = () => {};
  // Virtual scrollbar properties
  private scrollbarEl: HTMLElement | null = null;
  private scrollbarThumbEl: HTMLElement | null = null;
  private isDraggingScrollbar: boolean = false;
  private scrollbarStartX: number = 0;
  private scrollbarStartScrollLeft: number = 0;
  private handleScrollbarDrag: (e: MouseEvent) => void = () => {};
  private handleScrollbarDragEnd: () => void = () => {};
  constructor(container: HTMLElement, stateManager: StateManager, eventManager: EventManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.eventManager = eventManager;
    this.frameCount = 60;
    
    // Subscribe to state changes but avoid unnecessary re-renders
    this.eventManager.subscribe('stateChange', () => {
      if (!this.container.querySelector('.timeline-grid__playhead')) {
        // Only do a full render if the playhead doesn't exist yet
        this.render();
      } else {
        // Just update the playhead position for better performance
        this.updatePlayheadPosition();
      }
    });
    
    // Listen for layer selection changes
    this.eventManager.subscribe('layerSelected', (layerIdx) => {
      this.updateActiveTrackRow(layerIdx);
    });
    
    this.render();
    this.attachScrollHandler();
  }  render() {
    // Remove previous event listeners to prevent duplicates
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);
    document.removeEventListener('mousemove', this.handleScrollbarDrag);
    document.removeEventListener('mouseup', this.handleScrollbarDragEnd);
    
    const state = this.stateManager.getState();
    const playheadFrame = state.playhead ? state.playhead.frame : 1;
    const playheadTime = ((playheadFrame - 1) / state.fps).toFixed(2);
    
    // Calculate total content width based on frame count
    const totalWidth = this.frameCount * this.frameWidth;
    
    this.container.innerHTML = `
      <div class="timeline-grid__scroll-container">
        <div class="timeline-grid__ruler" style="height:27px; width:${totalWidth}px">
          ${this.renderRuler(playheadFrame)}
        </div>
        <div class="timeline-grid__tracks" style="width:${totalWidth}px">
          ${this.renderTracks(playheadFrame)}
        </div>
        <div class="timeline-grid__playhead" style="left:${(playheadFrame-1)*this.frameWidth}px"></div>
      </div>
      <div class="timeline-grid__virtual-scrollbar">
        <div class="timeline-grid__scrollbar-thumb"></div>
      </div>
      <div class="timeline-grid__control-bar">
        <button class="timeline-grid__ctrl-btn" id="play-btn" title="Play/Pause">${this.isPlaying ? '<svg width=16 height=16><rect x=3 y=3 width=3 height=10 fill=black/><rect x=10 y=3 width=3 height=10 fill=black/></svg>' : '<svg width=16 height=16><polygon points="3,3 13,8 3,13" fill="black"/></svg>'}</button>
        <button class="timeline-grid__ctrl-btn" id="stop-btn" title="Stop"><svg width=16 height=16><rect x=3 y=3 width=10 height=10 fill=black/></svg></button>
        <button class="timeline-grid__ctrl-btn" id="step-back-btn" title="Step Back"><svg width=16 height=16><polygon points="11,3 11,13 3,8" fill="black"/></svg></button>
        <button class="timeline-grid__ctrl-btn" id="step-fwd-btn" title="Step Forward"><svg width=16 height=16><polygon points="5,3 5,13 13,8" fill="black"/></svg></button>
        <span class="timeline-grid__ctrl-sep"></span>
        <label for="goto-frame">Frame:</label>
        <input type="number" id="goto-frame" min="1" max="${this.frameCount}" value="${playheadFrame}" class="timeline-grid__goto-input" />
        <label for="goto-time">Time:</label>
        <input type="number" id="goto-time" min="0" step="0.01" value="${playheadTime}" class="timeline-grid__goto-input" />s
        <label for="fps-input">FPS:</label>
        <input type="number" id="fps-input" min="1" max="120" step="0.01" value="${state.fps}" class="timeline-grid__fps-input" />
        <button id="goto-frame-btn" class="timeline-grid__goto-btn">Go</button>
      </div>
    `;
    
    this.scrollContainer = this.container.querySelector('.timeline-grid__scroll-container');
    this.rulerEl = this.container.querySelector('.timeline-grid__ruler');
    this.tracksEl = this.container.querySelector('.timeline-grid__tracks');
    this.scrollbarEl = this.container.querySelector('.timeline-grid__virtual-scrollbar');
    this.scrollbarThumbEl = this.container.querySelector('.timeline-grid__scrollbar-thumb');
    
    // Ensure frameX is visible in scroll area
    if (this.scrollContainer) {
      this.ensureFrameVisible(playheadFrame);
    }
    
    this.syncRulerAndTracks();
    this.attachScrollHandler();
    this.attachScrollbarHandlers();
    this.attachFrameSelection();
    this.attachGotoFrame();
    this.attachFpsInput();
    this.attachGotoTimeSync();
    this.attachPlaybackControls();
    this.attachPlayheadDrag();
    
    // Initialize the virtual scrollbar
    this.updateVirtualScrollbar();
  }
  syncRulerAndTracks() {
    if (!this.scrollContainer || !this.rulerEl || !this.tracksEl) return;
    
    // Create a named scroll handler function
    const handleScroll = () => {
      if (!this.rulerEl || !this.tracksEl || !this.scrollContainer) return;
      this.rulerEl.scrollLeft = this.scrollContainer.scrollLeft;
      this.tracksEl.scrollLeft = this.scrollContainer.scrollLeft;
      
      // Update the virtual scrollbar when scrolling
      this.updateVirtualScrollbar();
    };
    
    // Attach the scroll handler
    this.scrollContainer.addEventListener('scroll', handleScroll);
  }

  renderRuler(playheadFrame: number): string {
    let html = '';
    for (let i = 1; i <= this.frameCount; i++) {
      const isCurrent = i === playheadFrame;
      html += `
        <div class="timeline-grid__ruler-frame${isCurrent ? ' current' : ''}" style="left:${(i-1)*this.frameWidth}px;width:${this.frameWidth}px">
          <span class="timeline-grid__ruler-label">${i}</span>
        </div>
      `;
    }
    return html;
  }

  renderTracks(playheadFrame: number): string {
    const state = this.stateManager.getState();
    return state.layers.map((layer, idx) => {
      const isActive = state.playhead && state.playhead.layerIdx === idx;
      return `
        <div class="timeline-grid__track-row${isActive ? ' active' : ''}" data-layer="${layer.name}" style="top:${idx*this.rowHeight}px">
          <span class="timeline-grid__track-color-dot" style="background:${layer.color}"></span>
          ${this.renderTrackFrames(idx)}
        </div>
      `;
    }).join('');
  }

  renderTrackFrames(layerIdx: number): string {
    const state = this.stateManager.getState();
    let html = '';
    const keyframes = state.keyframes[layerIdx] || new Set();
    for (let i = 1; i <= this.frameCount; i++) {
      const selected = state.playhead && state.playhead.layerIdx === layerIdx && state.playhead.frame === i;
      const isKeyframe = keyframes.has(i);
      html += `<div class="timeline-grid__frame-cell${selected ? ' selected' : ''}${isKeyframe ? ' keyframe' : ''}" data-frame="${i}" data-layer-idx="${layerIdx}" style="left:${(i-1)*this.frameWidth}px;width:${this.frameWidth}px">
        ${isKeyframe ? '<span class=\'timeline-grid__keyframe-dot\'></span>' : ''}
      </div>`;
    }
    return html;
  }

  attachScrollHandler() {
    if (!this.scrollContainer) return;
    if (this.scrollHandler) this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
    this.scrollHandler = () => {
      if (!this.scrollContainer) return;
      if (this.isPlaying) return;
      if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer!;
        if (scrollLeft + clientWidth > scrollWidth - 200) {
          const rightVisibleFrame = Math.ceil((scrollLeft + clientWidth) / this.frameWidth);
          this.extendFramesAndRestoreScroll(rightVisibleFrame, clientWidth);
        }
      }, 150);
    };
    this.scrollContainer.addEventListener('scroll', this.scrollHandler);
  }
  extendFramesAndRestoreScroll(rightVisibleFrame: number, clientWidth: number) {
    // Calculate the offset from the right edge
    const offsetFromRight = clientWidth - ((rightVisibleFrame) * this.frameWidth - (this.scrollContainer ? this.scrollContainer.scrollLeft : 0));
    
    // Store the old frame count before extending
    const oldFrameCount = this.frameCount;
    
    // Add more frames
    this.frameCount += 30;
    
    // Render with new frame count
    this.render();
    
    // After render, restore scroll so the rightmost visible frame is still at the same position
    if (this.scrollContainer) {
      // Set scroll position with slight delay to ensure DOM is updated
      setTimeout(() => {
        if (this.scrollContainer) {
          this.scrollContainer.scrollLeft = rightVisibleFrame * this.frameWidth - clientWidth + offsetFromRight;
          console.log('Extended frames:', oldFrameCount, 'to', this.frameCount, 'Scroll position:', this.scrollContainer.scrollLeft);
        }
      }, 0);
    }
  }
  attachFrameSelection() {
    if (!this.tracksEl) return;
    
    // Remove any existing click handlers before attaching a new one
    const newTracksEl = this.tracksEl.cloneNode(true) as HTMLElement;
    if (this.tracksEl.parentNode) {
      this.tracksEl.parentNode.replaceChild(newTracksEl, this.tracksEl);
    }
    this.tracksEl = newTracksEl;
    
    this.tracksEl.addEventListener('click', (e) => {
      console.log('Frame cell clicked:', e.target);
      const target = e.target as HTMLElement;
      
      // Check for clicks directly on frame cells or their children
      const frameCell = target.closest('.timeline-grid__frame-cell');
      if (frameCell) {
        const frame = parseInt(frameCell.getAttribute('data-frame') || '0', 10);
        const layerIdx = parseInt(frameCell.getAttribute('data-layer-idx') || '0', 10);
        
        console.log('Frame cell handler - Frame:', frame, 'Layer:', layerIdx);
          if (e.shiftKey) {
          // Toggle keyframe
          this.toggleKeyframe(layerIdx, frame);
        } else {          // First, remove 'selected' class from all frame cells
          if (this.tracksEl) {
            const allFrames = this.tracksEl.querySelectorAll('.timeline-grid__frame-cell');
            Array.from(allFrames).forEach((frame) => frame.classList.remove('selected'));
            
            // Add 'selected' class to the clicked frame immediately
            frameCell.classList.add('selected');
          }
            // Active track row is now handled by updateActiveTrackRow through the layerSelected event
          
          // Now update the state
          this.stateManager.updatePlayhead({ layerIdx, frame });
        }
      }
    });
  }

  toggleKeyframe(layerIdx: number, frame: number) {
    const state = this.stateManager.getState();
    const keyframes = { ...state.keyframes };
    if (!keyframes[layerIdx]) keyframes[layerIdx] = new Set();
    if (keyframes[layerIdx].has(frame)) {
      keyframes[layerIdx].delete(frame);
      this.eventManager.emit('keyframeChange', { type: 'removed', layerIdx, frame });
    } else {
      keyframes[layerIdx].add(frame);
      this.eventManager.emit('keyframeChange', { type: 'added', layerIdx, frame });
    }
    this.stateManager.updateKeyframes(keyframes);
  }

  extendFrames(count: number) {
    this.frameCount += count;
    this.render();
    this.attachScrollHandler();
  }

  attachGotoFrame() {
    const frameInput = this.container.querySelector('#goto-frame') as HTMLInputElement;
    const btn = this.container.querySelector('#goto-frame-btn') as HTMLButtonElement;
    if (frameInput && btn) {
      btn.onclick = () => {
        const frame = Math.max(1, Math.min(this.frameCount, parseInt(frameInput.value, 10)));
        this.seekToFrame(frame);
      };
      frameInput.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          const frame = Math.max(1, Math.min(this.frameCount, parseInt(frameInput.value, 10)));
          this.seekToFrame(frame);
        }
      };
    }
  }

  attachGotoTimeSync() {
    const frameInput = this.container.querySelector('#goto-frame') as HTMLInputElement;
    const timeInput = this.container.querySelector('#goto-time') as HTMLInputElement;
    if (!frameInput || !timeInput) return;
    frameInput.oninput = () => {
      if (this.suppressSync) return;
      this.suppressSync = true;
      const frame = Math.max(1, Math.min(this.frameCount, parseInt(frameInput.value, 10)));
      const state = this.stateManager.getState();
      timeInput.value = ((frame - 1) / state.fps).toFixed(2);
      this.suppressSync = false;
    };
    timeInput.oninput = () => {
      if (this.suppressSync) return;
      this.suppressSync = true;
      const time = Math.max(0, parseFloat(timeInput.value));
      const state = this.stateManager.getState();
      const frame = Math.round(time * state.fps) + 1;
      frameInput.value = String(Math.max(1, Math.min(this.frameCount, frame)));
      this.suppressSync = false;
    };
  }

  attachFpsInput() {
    const fpsInput = this.container.querySelector('#fps-input') as HTMLInputElement;
    if (fpsInput) {
      fpsInput.onchange = () => {
        const newFps = Math.max(1, Math.min(120, parseFloat(fpsInput.value)));
        this.stateManager.updateFps(newFps);
      };
    }
  }

  attachPlaybackControls() {
    const playBtn = this.container.querySelector('#play-btn') as HTMLButtonElement;
    const stopBtn = this.container.querySelector('#stop-btn') as HTMLButtonElement;
    const stepBackBtn = this.container.querySelector('#step-back-btn') as HTMLButtonElement;
    const stepFwdBtn = this.container.querySelector('#step-fwd-btn') as HTMLButtonElement;
    if (playBtn) playBtn.onclick = () => this.togglePlay();
    if (stopBtn) stopBtn.onclick = () => this.stopPlayback();
    if (stepBackBtn) stepBackBtn.onclick = () => this.stepFrame(-1);
    if (stepFwdBtn) stepFwdBtn.onclick = () => this.stepFrame(1);
  }

  togglePlay() {
    const state = this.stateManager.getState();
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.isPlaying = true;
      this.render();
      this.playInterval = setInterval(() => {
        const state = this.stateManager.getState();
        if (!state.playhead) {
          this.stopPlayback();
          return;
        }
        if (state.playhead.frame < this.frameCount) {
          this.stateManager.updatePlayhead({ layerIdx: state.playhead.layerIdx, frame: state.playhead.frame + 1 });
        } else {
          this.stopPlayback();
        }
      }, 1000 / state.fps);
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.playInterval) clearInterval(this.playInterval);
    this.playInterval = null;
    const state = this.stateManager.getState();
    this.stateManager.updatePlayhead({ layerIdx: state.playhead ? state.playhead.layerIdx : 0, frame: 1 });
  }

  stepFrame(dir: number) {
    const state = this.stateManager.getState();
    if (!state.playhead) {
      this.stateManager.updatePlayhead({ layerIdx: 0, frame: 1 });
    } else {
      let newFrame = state.playhead.frame + dir;
      newFrame = Math.max(1, Math.min(this.frameCount, newFrame));
      this.stateManager.updatePlayhead({ layerIdx: state.playhead.layerIdx, frame: newFrame });
    }
  }

  // Updated seekToFrame method that handles scrolling properly
  seekToFrame(frame: number) {
    const state = this.stateManager.getState();
    const layerIdx = state.playhead ? state.playhead.layerIdx : 0;
    
    // Update the state
    this.stateManager.updatePlayhead({ layerIdx, frame });
    
    // Ensure the frame is visible in the scroll view
    this.ensureFrameVisible(frame);
    
    // Emit event for external listeners
    this.eventManager.emit('playheadMove', { layerIdx, frame });
  }
  attachPlayheadDrag() {
    // Clean up any existing event listeners
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);

    const playhead = this.container.querySelector('.timeline-grid__playhead') as HTMLElement;
    if (!playhead) return;
    
    // Remove existing listeners from the playhead
    const newPlayhead = playhead.cloneNode(true) as HTMLElement;
    if (playhead.parentNode) {
      playhead.parentNode.replaceChild(newPlayhead, playhead);
    }
    
    // Make playhead narrower so it doesn't interfere with frame clicks
    newPlayhead.classList.add('draggable');
    
    // State variables for drag operation
    let isDragging = false;
    let startX = 0;
    let startFrame = 1;
    
    // Simplified mousedown handler with focused hit area
    newPlayhead.addEventListener('mousedown', (e: MouseEvent) => {
      // Make this a simple flag that we check during frame click handling
      console.log('Playhead mousedown detected');
      
      isDragging = true;
      startX = e.clientX;
      
      const state = this.stateManager.getState();
      startFrame = state.playhead ? state.playhead.frame : 1;
      
      // Visual feedback
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
      newPlayhead.classList.add('dragging');
      
      // Prevent default to stop text selection, but DO NOT stop propagation
      e.preventDefault();
    });
    
    // Mouse move handler for dragging
    this.mouseMoveHandler = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // Simple delta calculation based on mouse movement
      const dx = e.clientX - startX;
      const frameDelta = Math.round(dx / this.frameWidth);
      const newFrame = Math.max(1, Math.min(this.frameCount, startFrame + frameDelta));
      
      // Update the model
      const state = this.stateManager.getState();
      this.stateManager.updatePlayhead({
        layerIdx: state.playhead ? state.playhead.layerIdx : 0,
        frame: newFrame
      });
      
      // Auto-scroll if needed
      this.ensureFrameVisible(newFrame);
    };
    
    // Mouse up handler
    this.mouseUpHandler = () => {
      if (!isDragging) return;
      
      isDragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      if (newPlayhead) {
        newPlayhead.classList.remove('dragging');
      }
    };
    
    // Attach global event listeners
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }
  
  // Helper method to ensure a frame is visible in the scrolling area
  ensureFrameVisible(frame: number) {
    if (!this.scrollContainer) return;
    
    const frameX = (frame - 1) * this.frameWidth;
    const scrollLeft = this.scrollContainer.scrollLeft;
    const containerWidth = this.scrollContainer.clientWidth;
    
    // If the frame is outside the visible area, scroll to make it visible
    if (frameX < scrollLeft || frameX > scrollLeft + containerWidth - this.frameWidth) {
      // If near left edge, align to left with some padding
      if (frameX < scrollLeft + containerWidth / 4) {
        this.scrollContainer.scrollLeft = Math.max(0, frameX - this.frameWidth * 2);
      } 
      // If near right edge, align to right with some padding
      else if (frameX > scrollLeft + containerWidth * 3/4) {
        this.scrollContainer.scrollLeft = frameX - containerWidth + this.frameWidth * 3;
      }
    }
  }  // Update just the playhead position element without full rerender
  updatePlayheadPosition() {
    const state = this.stateManager.getState();
    const playheadFrame = state.playhead ? state.playhead.frame : 1;
    const playheadLayer = state.playhead ? state.playhead.layerIdx : 0;
    const playhead = this.container.querySelector('.timeline-grid__playhead') as HTMLElement;
    
    if (playhead) {
      // Update position and ensure it's visible
      playhead.style.left = `${(playheadFrame - 1) * this.frameWidth}px`;
        // Update selected frame cell and active track row
      if (this.tracksEl) {
        // Clear all selected states first
        const allFrames = this.tracksEl.querySelectorAll('.timeline-grid__frame-cell.selected');
        Array.from(allFrames).forEach((frame) => frame.classList.remove('selected'));
        
        const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row.active');
        Array.from(allTracks).forEach((track) => track.classList.remove('active'));
        
        // Find and select the current frame
        const currentFrame = this.tracksEl.querySelector(
          `.timeline-grid__frame-cell[data-frame="${playheadFrame}"][data-layer-idx="${playheadLayer}"]`
        );
        
        if (currentFrame) {
          currentFrame.classList.add('selected');
          
          // Select the track row too
          const trackRow = currentFrame.closest('.timeline-grid__track-row');
          if (trackRow) {
            trackRow.classList.add('active');
          }
        }
      }
      
      // If playing or dragging, ensure it stays in view
      if (this.isPlaying || document.body.style.cursor === 'ew-resize') {
        this.ensureFrameVisible(playheadFrame);
      }
      
      // Also update frame counter in UI
      const frameInput = this.container.querySelector('#goto-frame') as HTMLInputElement;
      const timeInput = this.container.querySelector('#goto-time') as HTMLInputElement;
      
      if (frameInput) {
        frameInput.value = playheadFrame.toString();
      }
      
      if (timeInput && !this.suppressSync) {
        this.suppressSync = true;
        timeInput.value = ((playheadFrame - 1) / state.fps).toFixed(2);
        this.suppressSync = false;
      }
    }
  }

  // Helper method to update the active track row without full re-render
  updateActiveTrackRow(layerIdx: number) {
    if (!this.tracksEl) return;
    
    // Update active class on track rows
    const allTracks = this.tracksEl.querySelectorAll('.timeline-grid__track-row');
    allTracks.forEach((track, idx) => {
      if (idx === layerIdx) {
        track.classList.add('active');
      } else {
        track.classList.remove('active');
      }
    });
  }

  updateVirtualScrollbar() {
    if (!this.scrollContainer || !this.scrollbarEl || !this.scrollbarThumbEl) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
    
    // Calculate the thumb size and position
    const thumbWidth = Math.max(20, (clientWidth / scrollWidth) * this.scrollbarEl.offsetWidth);
    const thumbLeft = (scrollLeft / (scrollWidth - clientWidth)) * (this.scrollbarEl.offsetWidth - thumbWidth);
    
    // Update the thumb element
    this.scrollbarThumbEl.style.width = `${thumbWidth}px`;
    this.scrollbarThumbEl.style.left = `${thumbLeft}px`;
    
    // Show/hide the scrollbar based on whether scrolling is possible
    if (scrollWidth <= clientWidth) {
      this.scrollbarEl.style.display = 'none';
    } else {
      this.scrollbarEl.style.display = 'block';
    }
  }

  attachScrollbarHandlers() {
    if (!this.scrollbarEl || !this.scrollbarThumbEl || !this.scrollContainer) return;

    // Click on the scrollbar track to jump to that position
    this.scrollbarEl.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.scrollbarThumbEl) return; // Don't handle clicks on the thumb
      
      const scrollbarRect = this.scrollbarEl!.getBoundingClientRect();
      const clickPosition = e.clientX - scrollbarRect.left;
      const scrollbarWidth = scrollbarRect.width;
      
      // Calculate scroll position based on click position
      if (this.scrollContainer) {
        const { scrollWidth, clientWidth } = this.scrollContainer;
        const scrollMax = scrollWidth - clientWidth;
        const scrollPos = (clickPosition / scrollbarWidth) * scrollMax;
        
        this.scrollContainer.scrollLeft = scrollPos;
      }
    });

    // Create and assign the drag handlers
    const handleThumbDrag = (e: MouseEvent): void => {
      if (!this.isDraggingScrollbar || !this.scrollContainer || !this.scrollbarEl) return;
      
      const dx = e.clientX - this.scrollbarStartX;
      const { scrollWidth, clientWidth } = this.scrollContainer;
      const scrollMax = scrollWidth - clientWidth;
      
      // Calculate the scroll movement ratio
      const ratio = scrollMax / (this.scrollbarEl.offsetWidth - this.scrollbarThumbEl!.offsetWidth);
      const newScrollLeft = this.scrollbarStartScrollLeft + dx * ratio;
      
      // Update the scroll position
      this.scrollContainer.scrollLeft = Math.max(0, Math.min(scrollMax, newScrollLeft));
    };
    
    const handleThumbDragEnd = (): void => {
      if (this.isDraggingScrollbar) {
        this.isDraggingScrollbar = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };

    // Handle thumb dragging
    this.scrollbarThumbEl.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.scrollContainer) return;
      
      this.isDraggingScrollbar = true;
      this.scrollbarStartX = e.clientX;
      this.scrollbarStartScrollLeft = this.scrollContainer.scrollLeft;
      
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      
      // Prevent event from bubbling to the scrollbar track
      e.stopPropagation();
    });
    
    // Attach global event listeners
    document.addEventListener('mousemove', handleThumbDrag);
    document.addEventListener('mouseup', handleThumbDragEnd);
    
    // Store references to the handlers so we can remove them later
    this.handleScrollbarDrag = handleThumbDrag;
    this.handleScrollbarDragEnd = handleThumbDragEnd;
  }
}
