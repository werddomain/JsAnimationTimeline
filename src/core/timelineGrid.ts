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

  constructor(container: HTMLElement, stateManager: StateManager, eventManager: EventManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.eventManager = eventManager;
    this.frameCount = 60;
    this.eventManager.subscribe('stateChange', () => this.render());
    this.render();
    this.attachScrollHandler();
  }

  render() {
    const state = this.stateManager.getState();
    const playheadFrame = state.playhead ? state.playhead.frame : 1;
    const playheadTime = ((playheadFrame - 1) / state.fps).toFixed(2);
    this.container.innerHTML = `
      <div class="timeline-grid__scroll-container">
        <div class="timeline-grid__ruler" style="height:27px">
          ${this.renderRuler(playheadFrame)}
        </div>
        <div class="timeline-grid__tracks">
          ${this.renderTracks(playheadFrame)}
        </div>
        <div class="timeline-grid__playhead" style="left:${(playheadFrame-1)*this.frameWidth}px" draggable="true"></div>
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
    this.syncRulerAndTracks();
    this.attachFrameSelection();
    this.attachGotoFrame();
    this.attachFpsInput();
    this.attachGotoTimeSync();
    this.attachPlaybackControls();
    this.attachPlayheadDrag();
  }

  syncRulerAndTracks() {
    if (!this.scrollContainer || !this.rulerEl || !this.tracksEl) return;
    this.scrollContainer.addEventListener('scroll', () => {
      if (!this.rulerEl || !this.tracksEl || !this.scrollContainer) return;
      this.rulerEl.scrollLeft = this.scrollContainer.scrollLeft;
      this.tracksEl.scrollLeft = this.scrollContainer.scrollLeft;
    });
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
    this.scrollContainer.addEventListener('scroll', () => {
      if (!this.scrollContainer) return;
      if (this.isPlaying) return; // Prevent extension in play mode
      const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
      if (scrollLeft + clientWidth > scrollWidth - 200) {
        this.extendFrames(30);
      }
    });
  }

  attachFrameSelection() {
    if (!this.tracksEl) return;
    this.tracksEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('timeline-grid__frame-cell')) {
        const frame = parseInt(target.getAttribute('data-frame') || '0', 10);
        const layerIdx = parseInt(target.getAttribute('data-layer-idx') || '0', 10);
        if (e.shiftKey) {
          // Toggle keyframe
          this.toggleKeyframe(layerIdx, frame);
        } else {
          this.stateManager.updatePlayhead({ layerIdx, frame });
          this.eventManager.emit('playheadMove', { layerIdx, frame });
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

  seekToFrame(frame: number) {
    const state = this.stateManager.getState();
    this.stateManager.updatePlayhead({ layerIdx: state.playhead ? state.playhead.layerIdx : 0, frame });
    // Optionally, scroll to make playhead visible
    if (this.scrollContainer) {
      const left = (frame - 1) * this.frameWidth;
      const right = left + this.frameWidth;
      if (left < this.scrollContainer.scrollLeft || right > this.scrollContainer.scrollLeft + this.scrollContainer.clientWidth) {
        this.scrollContainer.scrollLeft = left - this.scrollContainer.clientWidth / 2 + this.frameWidth / 2;
      }
    }
  }

  attachPlayheadDrag() {
    const playhead = this.container.querySelector('.timeline-grid__playhead') as HTMLElement;
    if (!playhead || !this.scrollContainer) return;
    let isDragging = false;
    let startX = 0;
    let startFrame = 1;
    playhead.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX;
      const state = this.stateManager.getState();
      startFrame = state.playhead ? state.playhead.frame : 1;
      document.body.style.userSelect = 'none';
    };
    window.onmousemove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const frameDelta = Math.round(dx / this.frameWidth);
      let newFrame = Math.max(1, Math.min(this.frameCount, startFrame + frameDelta));
      const state = this.stateManager.getState();
      this.stateManager.updatePlayhead({ layerIdx: state.playhead ? state.playhead.layerIdx : 0, frame: newFrame });
      this.eventManager.emit('playheadMove', { layerIdx: state.playhead ? state.playhead.layerIdx : 0, frame: newFrame });
    };
    window.onmouseup = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
        // Optionally emit playhead move event
      }
    };
  }
}
