import { TimelineControl } from './components/TimelineControl';
import { PluginManager } from './core/PluginManager';
import { DataModel } from './core/DataModel';
import { EventEmitter } from './core/EventEmitter';
import { EVENT_TYPES } from './utils/EventTypes';

// Import CSS
import './styles/timeline.css';
import './styles/components.css';

export class App {
    private timelineControl: TimelineControl;
    private eventEmitter: EventEmitter<string>;
    private dataModel: DataModel;
    
    constructor() {
        // Initialize the event emitter
        this.eventEmitter = new EventEmitter<string>();
        
        // Initialize the data model
        this.dataModel = new DataModel(this.eventEmitter);
        
        // Initialize the timeline control
        this.timelineControl = new TimelineControl('timeline-control');
        
        // Load initial data
        this.loadInitialData();
    }
    
    private loadInitialData(): void {
        // Add some test layers
        this.addTestLayer('Background');
        this.addTestLayer('Character');
        this.addTestLayer('Foreground');
    }
    
    private addTestLayer(name: string): void {
        const layerId = 'layer_' + Date.now() + Math.floor(Math.random() * 1000);
        
        this.eventEmitter.emit(EVENT_TYPES.LAYER_ADDED, {
            layer: {
                id: layerId,
                name: name,
                keyframes: [
                    {
                        id: 'keyframe_' + Date.now() + Math.floor(Math.random() * 1000),
                        time: 1.0,
                        value: { x: 10, y: 20 }
                    },
                    {
                        id: 'keyframe_' + Date.now() + Math.floor(Math.random() * 1000),
                        time: 2.5,
                        value: { x: 50, y: 80 }
                    }
                ]
            }
        });
    }
}
