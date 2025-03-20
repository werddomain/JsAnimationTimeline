/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/plugins/toolbar/MainToolbar.ts
/**
 * Main Toolbar
 * Manages the main timeline toolbar UI
 */

import { EventEmitter } from '../../core/EventEmitter';
import { TimelineConstants } from '../../core/Constants';
import { Component } from '../../core/BaseComponent';

const { EVENTS, CSS_CLASSES, TIME } = TimelineConstants;

export interface MainToolbarOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onAddKeyframe: () => void;
    onCreateMotionTween: () => void;
    onDeleteKeyframe: () => void;
    onEditKeyframe: () => void;
    onZoomChange: (scale: number) => void;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onGoToTime?: (time: number) => void;
}

export interface MainToolbarData {
    isPlaying?: boolean;
    zoomLevel?: number;
}

export class MainToolbar extends Component {
    private eventEmitter: EventEmitter;
    private options: MainToolbarOptions;
    private isPlaying: boolean = false;
    private zoomLevel: number = TIME.DEFAULT_TIME_SCALE;

    constructor(options: MainToolbarOptions) {
        super(options.container, 'timeline-main-toolbar');
        this.eventEmitter = options.eventEmitter;
        this.options = options;

        this.init();
    }

    /**
     * Initialize the toolbar
     */
    private init(): void {
        this.initialize();
    }

    /**
     * Initialize event listeners
     */
    public initialize(): void {
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
    public render(): string {
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
    public update(data: MainToolbarData): void {
        if (data.isPlaying !== undefined) {
            this.isPlaying = data.isPlaying;
        }

        if (data.zoomLevel !== undefined) {
            this.zoomLevel = data.zoomLevel;
        }

        const element = this.getElement();
        if (!element) return;

        // Update play/pause buttons
        const playBtn = element.querySelector('[data-action="play"]') as HTMLButtonElement;
        const pauseBtn = element.querySelector('[data-action="pause"]') as HTMLButtonElement;

        if (playBtn && pauseBtn) {
            playBtn.disabled = this.isPlaying;
            pauseBtn.disabled = !this.isPlaying;
        }

        // Update zoom slider
        const zoomSlider = element.querySelector('#timeline-zoom') as HTMLInputElement;
        const zoomValue = element.querySelector('.timeline-zoom-value') as HTMLElement;

        if (zoomSlider && zoomValue) {
            zoomSlider.value = this.zoomLevel.toString();
            zoomValue.textContent = `${this.zoomLevel.toFixed(1)}x`;
        }
    }

    /**
     * Handle toolbar button clicks
     * @param e Click event
     */
    private handleClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        const button = target.closest('.timeline-btn') as HTMLButtonElement;

        if (!button) return;

        const action = button.getAttribute('data-action');
        if (!action) return;

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
    private handleKeydown(e: KeyboardEvent): void {
        const target = e.target as HTMLElement;

        // Handle Enter key in go-to time input
        if (target.id === 'timeline-goto' && e.key === 'Enter') {
            this.handleGoToTime();
        }
    }

    /**
     * Handle input events (for zoom slider)
     * @param e Input event
     */
    private handleInput(e: Event): void {
        const target = e.target as HTMLElement;

        if (target.id === 'timeline-zoom') {
            const zoomSlider = target as HTMLInputElement;
            const scale = parseFloat(zoomSlider.value);

            // Update the display
            const element = this.getElement();
            if (element) {
                const zoomValue = element.querySelector('.timeline-zoom-value') as HTMLElement;
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
    private handleGoToTime(): void {
        const element = this.getElement();
        if (!element) return;

        const input = element.querySelector('#timeline-goto') as HTMLInputElement;
        if (!input) return;

        const timeStr = input.value.trim();
        if (!timeStr) return;

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
    private parseTimeString(timeStr: string): number | null {
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
    public setZoomLevel(scale: number): void {
        this.update({ zoomLevel: scale });
    }

    /**
     * Clean up event listeners
     */
    public destroy(): void {
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