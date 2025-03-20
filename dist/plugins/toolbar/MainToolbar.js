/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/plugins/toolbar/MainToolbar.ts
/**
 * Main Toolbar
 * Manages the main timeline toolbar UI
 */
import { TimelineConstants } from '../../core/Constants';
import { Component } from '../../core/BaseComponent';
const { EVENTS, CSS_CLASSES, TIME } = TimelineConstants;
export class MainToolbar extends Component {
    constructor(options) {
        super(options.container, 'timeline-main-toolbar');
        this.isPlaying = false;
        this.zoomLevel = TIME.DEFAULT_TIME_SCALE;
        this.eventEmitter = options.eventEmitter;
        this.options = options;
        this.init();
    }
    /**
     * Initialize the toolbar
     */
    init() {
        this.initialize();
    }
    /**
     * Initialize event listeners
     */
    initialize() {
        const element = this.getElement();
        if (element) {
            element.addEventListener('click', this.handleClick.bind(this));
            element.addEventListener('keydown', this.handleKeydown.bind(this));
            element.addEventListener('input', this.handleInput.bind(this));
        }
        // Listen for playback events
        this.eventEmitter.on(EVENTS.PLAY, () => {
            this.isPlaying = true;
            this.update({ isPlaying: true });
        });
        this.eventEmitter.on(EVENTS.PAUSE, () => {
            this.isPlaying = false;
            this.update({ isPlaying: false });
        });
        this.eventEmitter.on(EVENTS.STOP, () => {
            this.isPlaying = false;
            this.update({ isPlaying: false });
        });
    }
    /**
     * Render the toolbar
     */
    render() {
        return `
      <div id="${this.elementId}" class="${CSS_CLASSES.TOOLBAR}">
        <div class="timeline-toolbar-section">
          <button class="timeline-btn" data-action="play" title="Play" ${this.isPlaying ? 'disabled' : ''}>▶️</button>
          <button class="timeline-btn" data-action="pause" title="Pause" ${!this.isPlaying ? 'disabled' : ''}>⏸️</button>
          <button class="timeline-btn" data-action="stop" title="Stop">⏹️</button>
        </div>
        
        <div class="timeline-toolbar-divider"></div>
        
        <div class="timeline-toolbar-section">
          <button class="timeline-btn" data-action="add-keyframe" title="Add Keyframe">
            <span class="timeline-icon">+⬤</span>
          </button>
          <button class="timeline-btn" data-action="create-tween" title="Create Motion Tween">
            <span class="timeline-icon">↔️</span>
          </button>
          <button class="timeline-btn" data-action="delete-keyframe" title="Delete Keyframe">
            <span class="timeline-icon">🗑️</span>
          </button>
          <button class="timeline-btn" data-action="edit-keyframe" title="Edit Keyframe">
            <span class="timeline-icon">✏️</span>
          </button>
        </div>
        
        <div class="timeline-toolbar-divider"></div>
        
        <div class="timeline-toolbar-section timeline-toolbar-zoom">
          <label for="timeline-zoom">Zoom:</label>
          <input 
            type="range" 
            id="timeline-zoom" 
            min="${TIME.MIN_TIME_SCALE}" 
            max="${TIME.MAX_TIME_SCALE}" 
            step="0.1" 
            value="${this.zoomLevel}"
          >
          <span class="timeline-zoom-value">${this.zoomLevel.toFixed(1)}x</span>
        </div>
        
        <div class="timeline-toolbar-divider"></div>
        
        <div class="timeline-toolbar-section timeline-toolbar-goto">
          <label for="timeline-goto">Go to Time:</label>
          <input 
            type="text" 
            id="timeline-goto" 
            class="timeline-time-input" 
            placeholder="MM:SS.ms"
          >
          <button class="timeline-btn" data-action="goto-time" title="Go to Time">Go</button>
        </div>
      </div>
    `;
    }
    /**
     * Update the toolbar state
     * @param data The data to update
     */
    update(data) {
        if (data.isPlaying !== undefined) {
            this.isPlaying = data.isPlaying;
        }
        if (data.zoomLevel !== undefined) {
            this.zoomLevel = data.zoomLevel;
        }
        const element = this.getElement();
        if (!element)
            return;
        // Update play/pause buttons
        const playBtn = element.querySelector('[data-action="play"]');
        const pauseBtn = element.querySelector('[data-action="pause"]');
        if (playBtn && pauseBtn) {
            playBtn.disabled = this.isPlaying;
            pauseBtn.disabled = !this.isPlaying;
        }
        // Update zoom slider
        const zoomSlider = element.querySelector('#timeline-zoom');
        const zoomValue = element.querySelector('.timeline-zoom-value');
        if (zoomSlider && zoomValue) {
            zoomSlider.value = this.zoomLevel.toString();
            zoomValue.textContent = `${this.zoomLevel.toFixed(1)}x`;
        }
    }
    /**
     * Handle toolbar button clicks
     * @param e Click event
     */
    handleClick(e) {
        const target = e.target;
        const button = target.closest('.timeline-btn');
        if (!button)
            return;
        const action = button.getAttribute('data-action');
        if (!action)
            return;
        switch (action) {
            case 'play':
                this.options.onPlay();
                break;
            case 'pause':
                this.options.onPause();
                break;
            case 'stop':
                this.options.onStop();
                break;
            case 'add-keyframe':
                this.options.onAddKeyframe();
                break;
            case 'create-tween':
                this.options.onCreateMotionTween();
                break;
            case 'delete-keyframe':
                this.options.onDeleteKeyframe();
                break;
            case 'edit-keyframe':
                this.options.onEditKeyframe();
                break;
            case 'goto-time':
                this.handleGoToTime();
                break;
        }
    }
    /**
     * Handle keyboard events
     * @param e Keyboard event
     */
    handleKeydown(e) {
        const target = e.target;
        // Handle Enter key in go-to time input
        if (target.id === 'timeline-goto' && e.key === 'Enter') {
            this.handleGoToTime();
        }
    }
    /**
     * Handle input events (for zoom slider)
     * @param e Input event
     */
    handleInput(e) {
        const target = e.target;
        if (target.id === 'timeline-zoom') {
            const zoomSlider = target;
            const scale = parseFloat(zoomSlider.value);
            // Update the display
            const element = this.getElement();
            if (element) {
                const zoomValue = element.querySelector('.timeline-zoom-value');
                if (zoomValue) {
                    zoomValue.textContent = `${scale.toFixed(1)}x`;
                }
            }
            // Notify of zoom change
            this.options.onZoomChange(scale);
        }
    }
    /**
     * Handle Go To Time button click
     */
    handleGoToTime() {
        const element = this.getElement();
        if (!element)
            return;
        const input = element.querySelector('#timeline-goto');
        if (!input)
            return;
        const timeStr = input.value.trim();
        if (!timeStr)
            return;
        // Parse time string (MM:SS.ms)
        const time = this.parseTimeString(timeStr);
        if (time !== null) {
            this.eventEmitter.emitSeekToTime(time);
            // Clear the input after seeking
            input.value = '';
        }
    }
    /**
     * Parse time string in format MM:SS.ms or SS.ms
     * @param timeStr Time string
     * @returns Time in seconds or null if invalid
     */
    parseTimeString(timeStr) {
        // Try MM:SS.ms format
        const mmssRegex = /^(\d+):(\d+)(?:\.(\d+))?$/;
        const mmssMatch = timeStr.match(mmssRegex);
        if (mmssMatch) {
            const minutes = parseInt(mmssMatch[1], 10);
            const seconds = parseInt(mmssMatch[2], 10);
            const milliseconds = mmssMatch[3] ? parseInt(mmssMatch[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
            return minutes * 60 + seconds + milliseconds;
        }
        // Try SS.ms format
        const ssRegex = /^(\d+)(?:\.(\d+))?$/;
        const ssMatch = timeStr.match(ssRegex);
        if (ssMatch) {
            const seconds = parseInt(ssMatch[1], 10);
            const milliseconds = ssMatch[2] ? parseInt(ssMatch[2].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
            return seconds + milliseconds;
        }
        return null;
    }
    /**
     * Set the current zoom level on the slider
     * @param scale Zoom scale
     */
    setZoomLevel(scale) {
        this.update({ zoomLevel: scale });
    }
    /**
     * Clean up event listeners
     */
    destroy() {
        const element = this.getElement();
        if (element) {
            element.removeEventListener('click', this.handleClick.bind(this));
            element.removeEventListener('keydown', this.handleKeydown.bind(this));
            element.removeEventListener('input', this.handleInput.bind(this));
        }
        // Remove event listeners from the event emitter
        // Note: ideally we would store the unsubscribe functions when registering
    }
}
//# sourceMappingURL=MainToolbar.js.map