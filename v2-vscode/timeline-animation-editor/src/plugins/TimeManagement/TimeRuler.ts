// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\plugins\TimeManagement\TimeRuler.ts
import { BaseComponent } from '../../components/base/BaseComponent';
import { EventEmitter } from '../../core/EventEmitter';
import { CSS_CLASSES } from '../../utils/Constants';
import { EVENT_TYPES } from '../../utils/EventTypes';

interface TimeRulerOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter<string>;
    duration?: number;
    timeScale?: number;
}

export class TimeRuler extends BaseComponent {
    private eventEmitter: EventEmitter<string>;
    private duration: number;
    private timeScale: number;
    private pixelsPerSecond: number = 100;
    public dependencies: Array<{ name: string; optional: boolean }> = [];
    public name = 'timeRuler';

    constructor(options: TimeRulerOptions) {
        super(options.container, 'time-ruler');
        this.eventEmitter = options.eventEmitter;
        this.duration = options.duration || 60; // Default 60 seconds
        this.timeScale = options.timeScale || 1;
    }

public initialize(): void {
        this.render();
        this.setupEventListeners();
        
        // Listen for zoom change events
        this.eventEmitter.on(EVENT_TYPES.ZOOM_CHANGED, this, this.onZoomChange);
    }
    private onZoomChange(scale: number): void {
        this.timeScale = scale;
        this.render();
    }
    public render(): string {
        const html = `
            <div class="${CSS_CLASSES.TIMELINE_RULER_CONTENT}">
                ${this.generateTimeMarkers()}
            </div>
        `;
        this.container.innerHTML = html;
        return html;
    }

    private generateTimeMarkers(): string {
        let markers = '';
        const totalWidth = this.duration * this.timeScale * this.pixelsPerSecond;
        
        // Determine marker interval based on zoom level
        let interval = 1; // 1-second interval by default
        if (this.timeScale < 0.5) interval = 5;
        if (this.timeScale < 0.2) interval = 10;
        if (this.timeScale < 0.1) interval = 30;
        
        const minorInterval = interval / 5; // For minor tick marks
        
        // Major markers (with time labels)
        for (let i = 0; i <= this.duration; i += interval) {
            const position = i * this.timeScale * this.pixelsPerSecond;
            markers += `
                <div class="time-marker major" style="left: ${position}px;">
                    <div class="time-marker-label">${this.formatTime(i)}</div>
                </div>
            `;
        }
        
        // Minor markers (tick marks only)
        for (let i = 0; i <= this.duration; i += minorInterval) {
            // Skip major markers which are already added
            if (i % interval === 0) continue;
            
            const position = i * this.timeScale * this.pixelsPerSecond;
            markers += `
                <div class="time-marker minor" style="left: ${position}px;"></div>
            `;
        }
        
        // Set the width of the ruler content
        setTimeout(() => {
            const rulerContent = this.container.querySelector('.' + CSS_CLASSES.TIMELINE_RULER_CONTENT);
            if (rulerContent) {
                (rulerContent as HTMLElement).style.width = `${totalWidth}px`;
            }
        }, 0);
        
        return markers;
    }
    
    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    public update(scrollPosition: number): void {
        const rulerContent = this.container.querySelector('.' + CSS_CLASSES.TIMELINE_RULER_CONTENT);
        if (rulerContent) {
            (rulerContent as HTMLElement).style.transform = `translateX(-${scrollPosition}px)`;
        }
    }

    public updateDuration(duration: number): void {
        this.duration = duration;
        this.render();
    }
    
    public updateTimeScale(scale: number): void {
        this.timeScale = scale;
        this.render();
    }

    private setupEventListeners(): void {
        this.container.addEventListener('click', this.handleClick.bind(this));
    }

    private handleClick(event: MouseEvent): void {
        // Get the click position relative to the ruler
        const rulerRect = this.container.getBoundingClientRect();
        const clickX = event.clientX - rulerRect.left;
        
        // Calculate the time based on the click position, taking into account scroll position
        const rulerContent = this.container.querySelector('.' + CSS_CLASSES.TIMELINE_RULER_CONTENT);
        let scrollOffset = 0;
        
        if (rulerContent) {
            const transform = (rulerContent as HTMLElement).style.transform;
            const match = transform.match(/translateX\(-(\d+)px\)/);
            if (match) {
                scrollOffset = parseInt(match[1], 10);
            }
        }
        
        const actualPosition = clickX + scrollOffset;
        const time = actualPosition / (this.timeScale * this.pixelsPerSecond);
        
        // Emit an event for time update
        this.eventEmitter.emit(EVENT_TYPES.TIME_UPDATED, { time });
    }     
    
    public destroy(): void {
        this.container.removeEventListener('click', this.handleClick.bind(this));
        
        // Clean up event listeners from EventEmitter
        this.eventEmitter.off(EVENT_TYPES.ZOOM_CHANGED, this.onZoomChange);
    }
}
