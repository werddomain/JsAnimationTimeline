import { BaseComponent } from '@core/BaseComponent';
import { DataModel } from '@core/DataModel';
import { EventEmitter } from '@core/EventEmitter';
import { Events } from '@utils/EventTypes';

/**
 * Options for initializing the MainToolbar
 */
export interface MainToolbarOptions {
    container: HTMLElement;
    id?: string;
}

/**
 * MainToolbar plugin that provides the main controls for the timeline
 */
export class MainToolbar extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    
    // Plugin metadata
    public metadata = {
        name: 'MainToolbar',
        version: '1.0.0'
    };

    /**
     * Constructor for MainToolbar
     * @param options Options for initializing the main toolbar
     */
    constructor(options: MainToolbarOptions) {
        super(options.container, options.id || 'timeline-toolbar');
        this.dataModel = DataModel.getInstance();
        this.eventEmitter = EventEmitter.getInstance();
    }

    /**
     * Initialize the main toolbar
     */
    public initialize(): void {
        if (!this.element) {
            console.error('MainToolbar element not found');
            return;
        }

        // Add event listeners for buttons
        const zoomInBtn = this.element.querySelector('#timeline-zoom-in');
        const zoomOutBtn = this.element.querySelector('#timeline-zoom-out');
        const addLayerBtn = this.element.querySelector('#timeline-add-layer');
        const addGroupBtn = this.element.querySelector('#timeline-add-group');
        const playBtn = this.element.querySelector('#timeline-play');
        const stopBtn = this.element.querySelector('#timeline-stop');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', this.handleZoomIn);
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', this.handleZoomOut);
        }
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', this.handleAddLayer);
        }
        
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', this.handleAddGroup);
        }
        
        if (playBtn) {
            playBtn.addEventListener('click', this.handlePlay);
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', this.handleStop);
        }
    }

    /**
     * Render the main toolbar
     * @returns HTML string for the main toolbar
     */
    public render(): string {
        return `
            <div id="${this.id}" class="timeline-toolbar">
                <button id="timeline-add-layer" class="timeline-button">Add Layer</button>
                <button id="timeline-add-group" class="timeline-button">Add Group</button>
                <span class="timeline-toolbar-separator"></span>
                <button id="timeline-play" class="timeline-button">Play</button>
                <button id="timeline-stop" class="timeline-button">Stop</button>
                <span class="timeline-toolbar-separator"></span>
                <button id="timeline-zoom-in" class="timeline-button">Zoom In</button>
                <button id="timeline-zoom-out" class="timeline-button">Zoom Out</button>
                <span class="timeline-toolbar-separator"></span>
                <div class="timeline-time-display">00:00.000</div>
            </div>
        `;
    }

    /**
     * Update the main toolbar with new data
     * @param data The data to update with
     */
    public update(data: any): void {
        this.updateTimeDisplay();
    }

    /**
     * Clean up the main toolbar
     */
    public destroy(): void {
        if (!this.element) {
            return;
        }

        // Remove event listeners
        const zoomInBtn = this.element.querySelector('#timeline-zoom-in');
        const zoomOutBtn = this.element.querySelector('#timeline-zoom-out');
        const addLayerBtn = this.element.querySelector('#timeline-add-layer');
        const addGroupBtn = this.element.querySelector('#timeline-add-group');
        const playBtn = this.element.querySelector('#timeline-play');
        const stopBtn = this.element.querySelector('#timeline-stop');
        
        if (zoomInBtn) {
            zoomInBtn.removeEventListener('click', this.handleZoomIn);
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.removeEventListener('click', this.handleZoomOut);
        }
        
        if (addLayerBtn) {
            addLayerBtn.removeEventListener('click', this.handleAddLayer);
        }
        
        if (addGroupBtn) {
            addGroupBtn.removeEventListener('click', this.handleAddGroup);
        }
        
        if (playBtn) {
            playBtn.removeEventListener('click', this.handlePlay);
        }
        
        if (stopBtn) {
            stopBtn.removeEventListener('click', this.handleStop);
        }
    }

    /**
     * Handle zoom in button click
     */
    private handleZoomIn = (): void => {
        const currentScale = this.dataModel.getTimeScale();
        this.dataModel.setTimeScale(currentScale * 1.25, this);
    };

    /**
     * Handle zoom out button click
     */
    private handleZoomOut = (): void => {
        const currentScale = this.dataModel.getTimeScale();
        this.dataModel.setTimeScale(currentScale / 1.25, this);
    };

    /**
     * Handle add layer button click
     */
    private handleAddLayer = (): void => {
        const layerCount = this.dataModel.getLayers().length;
        const layerId = `layer-${Date.now()}`;
        
        this.dataModel.addLayer({
            id: layerId,
            name: `Layer ${layerCount + 1}`
        }, this);
    };

    /**
     * Handle add group button click
     */
    private handleAddGroup = (): void => {
        const groupCount = this.dataModel.getGroups().length;
        const groupId = `group-${Date.now()}`;
        
        this.dataModel.addGroup({
            id: groupId,
            name: `Group ${groupCount + 1}`,
            isExpanded: true
        }, this);
    };

    /**
     * Handle play button click
     */
    private handlePlay = (): void => {
        // In a real implementation, this would start playback
        console.log('Play clicked');
    };

    /**
     * Handle stop button click
     */
    private handleStop = (): void => {
        // In a real implementation, this would stop playback
        console.log('Stop clicked');
    };

    /**
     * Update the time display
     */
    private updateTimeDisplay(): void {
        if (!this.element) {
            return;
        }

        const timeDisplay = this.element.querySelector('.timeline-time-display');
        if (timeDisplay) {
            const currentTime = this.dataModel.getCurrentTime();
            
            // Format time as MM:SS.mmm
            const minutes = Math.floor(currentTime / 60);
            const seconds = Math.floor(currentTime % 60);
            const milliseconds = Math.floor((currentTime % 1) * 1000);
            
            timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        }
    }
}
