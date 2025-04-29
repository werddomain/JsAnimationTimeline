/**
 * TimeRuler plugin
 * Displays time markers and handles time navigation
 */

import { BaseComponent } from '../components/BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel } from '../core/DataModel';
import { Events, CssClasses, Dimensions } from '../constants/Constants';
import { IExtendedDataModel } from '../utils/ExtendedDataModel';

export interface ITimeRulerOptions {
    container: HTMLElement;
    dataModel: IExtendedDataModel;
    eventEmitter: EventEmitter;
}

export class TimeRuler extends BaseComponent {    private dataModel: IExtendedDataModel;
    private eventEmitter: EventEmitter;
    private rulerContentEl: HTMLElement | null = null;
    private playheadEl: HTMLElement | null = null;
    private isDraggingPlayhead: boolean = false;
    private duration: number;
    private timeScale: number;
    private timeResolution: number;
    
    /**
     * Constructor for TimeRuler
     * @param options - Configuration options
     */
    constructor(options: ITimeRulerOptions) {
        super(options.container, 'timeline-ruler');
        
        this.dataModel = options.dataModel;
        this.eventEmitter = options.eventEmitter;
        
        this.duration = this.dataModel.getDuration();
        this.timeScale = this.dataModel.getTimeScale();
        this.timeResolution = this.dataModel.getTimeResolution();
    }/**
     * Initialize the TimeRuler component
     */
    public initialize(): void {
        if (!this.element) {
            throw new Error('Cannot initialize TimeRuler - element not created. Make sure to call mount() before initialize().');
        }
        
        // Ensure the content element exists by rendering the component first
        if (!this.element.querySelector(`.${CssClasses.RULER_CONTENT}`)) {
            // If content element doesn't exist yet, update the HTML content
            this.element.innerHTML = this.render();
        }
          // Set up event listeners
        this.eventEmitter.on(Events.DURATION_CHANGED, this.handleDurationChanged.bind(this));
        this.eventEmitter.on(Events.SCALE_CHANGED, this.handleScaleChanged.bind(this));
        this.eventEmitter.on(Events.TIME_CHANGED, this.handleTimeChanged.bind(this));
        this.eventEmitter.on(Events.PLAYHEAD_MOVED, this.handlePlayheadMoved.bind(this));
        this.eventEmitter.on(Events.RESOLUTION_CHANGED, this.handleResolutionChanged.bind(this));
        
        // Add click handler for seeking
        this.element.addEventListener('click', this.handleRulerClick.bind(this));
        
        // Get the ruler content element
        this.rulerContentEl = this.element.querySelector(`.${CssClasses.RULER_CONTENT}`);
        if (!this.rulerContentEl) {
            throw new Error('TimeRuler content element not found. Check if the HTML structure is correct.');
        }
        
        // Get the playhead element
        this.playheadEl = this.rulerContentEl.querySelector(`.${CssClasses.PLAYHEAD}`);
        if (!this.playheadEl) {
            throw new Error('Playhead element not found. Check if the HTML structure is correct.');
        }
        
        // Set up playhead dragging
        this.setupPlayheadDrag();
        
        console.log('TimeRuler initialized successfully');
    }
      /**
     * Render the TimeRuler component
     * @returns HTML string representation
     */
    public render(): string {
        const width = this.calculateRulerWidth();
        const currentTime = this.dataModel.getCurrentTime();
        const playheadPosition = currentTime * this.timeScale;
        
        return `
            <div class="${CssClasses.RULER_CONTENT}" style="width: ${width}px">
                ${this.generateTimeMarkers()}
                <div class="${CssClasses.PLAYHEAD}" style="left: ${playheadPosition}px">
                    <div class="${CssClasses.PLAYHEAD_HANDLE}"></div>
                </div>
            </div>
        `;
    }
      /**
     * Update the TimeRuler component
     * @param data - New data for the component
     */
    public update(data?: any): void {
        if (!this.rulerContentEl) return;
        
        const width = this.calculateRulerWidth();
        this.rulerContentEl.style.width = `${width}px`;
        
        // Update time markers
        const markersContent = this.generateTimeMarkers();
        
        // Create a temp container to hold the markers
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = markersContent;
        
        // Clear old markers except the playhead
        if (this.rulerContentEl) {
            const children = Array.from(this.rulerContentEl.children);
            children.forEach(child => {
                if (!child.classList.contains(CssClasses.PLAYHEAD)) {
                    this.rulerContentEl?.removeChild(child);
                }
            });
        }
          // Add new markers before the playhead
        while (tempContainer.firstChild) {
            if (this.playheadEl && tempContainer.firstChild) {
                this.rulerContentEl.insertBefore(tempContainer.firstChild, this.playheadEl);
            } else if (tempContainer.firstChild) {
                this.rulerContentEl.appendChild(tempContainer.firstChild);
            }
        }
        
        // If no playhead exists, create it
        if (!this.playheadEl) {
            const currentTime = this.dataModel.getCurrentTime();
            const playheadPosition = currentTime * this.timeScale;
            
            const playheadEl = document.createElement('div');
            playheadEl.className = CssClasses.PLAYHEAD;
            playheadEl.style.left = `${playheadPosition}px`;
            
            const handleEl = document.createElement('div');
            handleEl.className = CssClasses.PLAYHEAD_HANDLE;
            playheadEl.appendChild(handleEl);
            
            this.rulerContentEl.appendChild(playheadEl);
            this.playheadEl = playheadEl;
            
            // Set up playhead drag functionality
            this.setupPlayheadDrag();
        }
    }
      /**
     * Destroy the TimeRuler component and clean up resources
     */    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.DURATION_CHANGED, this.handleDurationChanged.bind(this));
        this.eventEmitter.off(Events.SCALE_CHANGED, this.handleScaleChanged.bind(this));
        this.eventEmitter.off(Events.TIME_CHANGED, this.handleTimeChanged.bind(this));
        this.eventEmitter.off(Events.PLAYHEAD_MOVED, this.handlePlayheadMoved.bind(this));
        this.eventEmitter.off(Events.RESOLUTION_CHANGED, this.handleResolutionChanged.bind(this));
        
        if (this.element) {
            this.element.removeEventListener('click', this.handleRulerClick.bind(this));
        }
        
        // Clean up playhead event listeners
        if (this.playheadEl) {
            const newPlayhead = this.playheadEl.cloneNode(true);
            if (this.playheadEl.parentNode) {
                this.playheadEl.parentNode.replaceChild(newPlayhead, this.playheadEl);
            }
            this.playheadEl = null;
        }
    }
    
    /**
     * Calculate the width of the ruler based on duration and time scale
     * @returns Width in pixels
     */
    private calculateRulerWidth(): number {
        return Math.max(100, this.duration * this.timeScale);
    }    /**
     * Generate HTML for time markers
     * @returns HTML string for time markers
     */
    private generateTimeMarkers(): string {
        const frameWidth = 20; // Default frame width in pixels (matches --timeline-frame-width CSS var)
        const markers = [];
        
        // Add start marker at grid start (centered in first grid cell)
        markers.push(`
            <div class="${CssClasses.TIME_MARKER} ${CssClasses.TIME_MARKER_MAJOR}" style="left: ${frameWidth/2}px">
                <div class="${CssClasses.TIME_LABEL}">0:00</div>
            </div>
        `);
        
        // Generate markers at center of each grid cell
        // Each grid cell represents one time resolution unit
        const gridPixelWidth = this.timeScale * this.timeResolution; // Width of one grid cell in pixels
        const totalCells = Math.ceil(this.duration / this.timeResolution);
        
        for (let i = 1; i <= totalCells; i++) {
            const time = i * this.timeResolution;
            if (time > this.duration) break;
            
            const isMajor = this.isMajorMarker(time);
            const position = (time * this.timeScale) - (gridPixelWidth / 2); // Center in grid cell
            
            markers.push(`
                <div class="${CssClasses.TIME_MARKER}${isMajor ? ' ' + CssClasses.TIME_MARKER_MAJOR : ''}" 
                     style="left: ${position + frameWidth/2}px">
                    ${isMajor ? `<div class="${CssClasses.TIME_LABEL}">${this.formatTime(time)}</div>` : ''}
                </div>
            `);
        }
        
        return markers.join('');
    }
      /**
     * Get the interval between markers based on time scale and time resolution
     * @returns Interval in seconds
     */
    private getMarkerInterval(): number {
        // Default marker intervals based on zoom level
        let defaultInterval: number;
        if (this.timeScale > 200) defaultInterval = 0.5; // Show markers every 0.5 seconds when zoomed in
        else if (this.timeScale > 100) defaultInterval = 1; // Show markers every second
        else if (this.timeScale > 50) defaultInterval = 2; // Show markers every 2 seconds
        else if (this.timeScale > 20) defaultInterval = 5; // Show markers every 5 seconds
        else defaultInterval = 10; // Show markers every 10 seconds when zoomed out

        // Use time resolution as a base for marker intervals
        // Always make sure we have a reasonable number of markers
        if (this.timeResolution <= 0.001) {
            return Math.max(defaultInterval, this.timeResolution * 10);
        } else if (this.timeResolution <= 0.01) {
            return Math.max(defaultInterval, this.timeResolution * 5);
        } else if (this.timeResolution <= 0.1) {
            return Math.max(defaultInterval, this.timeResolution * 2);
        } else {
            return Math.max(defaultInterval, this.timeResolution);
        }
    }
      /**
     * Determine if a marker is a major marker that should display a time label
     * @param time - Time in seconds
     * @returns True if it's a major marker, false otherwise
     */
    private isMajorMarker(time: number): boolean {
        // Calculate how many time resolution units this time represents
        const timeInResolutionUnits = time / this.timeResolution;
        
        // Check if it's a multiple of 5 units (e.g., every 5 seconds if resolution is 1 second)
        const isOnFiveUnitsMultiple = Math.abs(timeInResolutionUnits % 5) < 0.0001;
        
        return isOnFiveUnitsMultiple;
    }
      /**
     * Format time in minutes:seconds.milliseconds format based on resolution
     * @param time - Time in seconds
     * @returns Formatted time string
     */
    private formatTime(time: number): string {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        
        // Format differently based on resolution
        if (this.timeResolution < 0.01) {
            // For millisecond resolution, show ms with 3 decimal places
            const ms = Math.round((time % 1) * 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        } else if (this.timeResolution < 0.1) {
            // For centisecond resolution, show ms with 2 decimal places
            const cs = Math.round((time % 1) * 100);
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
        } else if (this.timeResolution < 1) {
            // For decisecond resolution, show ms with 1 decimal place
            const ds = Math.round((time % 1) * 10);
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${ds}`;
        } else {
            // For second or longer resolutions, just show minutes:seconds
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
      /**
     * Handle ruler click to seek to a specific time
     * @param event - Click event
     */
    private handleRulerClick(event: MouseEvent): void {
        if (!this.rulerContentEl) return;
        
        // Get the click position relative to the ruler
        const rect = this.rulerContentEl.getBoundingClientRect();
        const scrollLeft = this.element?.parentElement?.scrollLeft || 0;
        const clickX = event.clientX - rect.left + scrollLeft;
        
        // Convert position to time
        let time = clickX / this.timeScale;
        
        // Snap to time resolution if available
        if (typeof (this.dataModel as any).snapToResolution === 'function') {
            time = (this.dataModel as any).snapToResolution(time);
        }
        
        // Seek to the time
        this.dataModel.setCurrentTime(time);
        this.eventEmitter.emit(Events.SEEK, { time }, this);
    }
    
    /**
     * Handle duration changed event
     * @param event - Duration changed event
     */
    private handleDurationChanged(event: any): void {
        this.duration = event.data.duration;
        this.update();
    }
      /**
     * Handle scale changed event
     * @param event - Scale changed event
     */
    private handleScaleChanged(event: any): void {
        this.timeScale = event.data.scale;
        this.update();
    }
    
    /**
     * Handle resolution changed event
     * @param event - Resolution changed event
     */
    private handleResolutionChanged(event: any): void {
        this.timeResolution = event.data.resolution || event.data.newResolution;
        this.update();
    }
    
    /**
     * Handle time changed event
     * @param event - Time changed event
     */
    private handleTimeChanged(event: any): void {
        if (!this.playheadEl || this.isDraggingPlayhead) return;
        
        const time = event.data.time;
        const position = time * this.timeScale;
        this.updatePlayheadPosition(position);
    }
    
    /**
     * Handle playhead moved event
     * @param event - Playhead moved event
     */
    private handlePlayheadMoved(event: any): void {
        if (!this.playheadEl || this.isDraggingPlayhead) return;
        
        const position = event.data.position;
        this.updatePlayheadPosition(position);
    }
    
    /**
     * Update the playhead position
     * @param position - Position in pixels
     */
    private updatePlayheadPosition(position: number): void {
        if (!this.playheadEl) return;
        
        this.playheadEl.style.left = `${position}px`;
    }
    
    /**
     * Set up playhead drag functionality
     */
    private setupPlayheadDrag(): void {
        if (!this.playheadEl) return;
        
        this.playheadEl.addEventListener('mousedown', (event: MouseEvent) => {
            event.preventDefault();
            this.isDraggingPlayhead = true;
            
            const onMouseMove = (moveEvent: MouseEvent) => {
                if (!this.rulerContentEl) return;
                
                const rect = this.rulerContentEl.getBoundingClientRect();
                const scrollLeft = this.element?.parentElement?.scrollLeft || 0;
                const mouseX = moveEvent.clientX - rect.left + scrollLeft;
                  // Constrain to ruler boundaries
                let position = Math.max(0, Math.min(mouseX, this.calculateRulerWidth()));
                
                // Update playhead position
                this.updatePlayheadPosition(position);
                  // Calculate time from position
                let time = position / this.timeScale;
                
                // Snap to time resolution if available
                if (typeof this.dataModel.snapToResolution === 'function') {
                    time = this.dataModel.snapToResolution(time);
                    // Update position to match snapped time
                    position = time * this.timeScale;
                    this.updatePlayheadPosition(position);
                }
                
                // Update the data model
                this.dataModel.setCurrentTime(time);
                this.eventEmitter.emit(Events.SEEK, { time }, this);
            };
            
            const onMouseUp = () => {
                this.isDraggingPlayhead = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
}
