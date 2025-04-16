import { TimelineControl } from '@core/TimelineControl';
import { TimeRuler } from '@plugins/TimeRuler';
import { LayerManager } from '@plugins/LayerManager';
import { KeyframeManager } from '@plugins/KeyframeManager';
import { GroupManager } from '@plugins/GroupManager';
import { MainToolbar } from '@plugins/MainToolbar';
import { ObjectToolbar } from '@plugins/ObjectToolbar';

/**
 * Initialize a Timeline Animation Editor instance
 * @param container The HTML element to contain the timeline
 * @param options Configuration options for the timeline
 * @returns A TimelineControl instance
 */
export default function createTimeline(container: HTMLElement, options: any = {}): TimelineControl {
    // Validate container
    if (!container) {
        throw new Error('Container element is required');
    }
    
    // Create the timeline control
    const timeline = new TimelineControl({
        container,
        duration: options.duration || 60,
        timeScale: options.timeScale || 1,
        pixelsPerSecond: options.pixelsPerSecond || 50
    });
    
    // Add plugins
    // The order matters here due to dependencies
    
    // Add main toolbar
    const mainToolbar = new MainToolbar({
        container: document.getElementById('timeline-toolbar') as HTMLElement
    });
    timeline.addPlugin(mainToolbar, mainToolbar.metadata);
    
    // Add time ruler
    const timeRuler = new TimeRuler({
        container: document.getElementById('timeline-ruler') as HTMLElement
    });
    timeline.addPlugin(timeRuler, timeRuler.metadata);
    
    // Add layer manager
    const layerManager = new LayerManager({
        container: document.getElementById('timeline-layers-container') as HTMLElement
    });
    timeline.addPlugin(layerManager, layerManager.metadata);
    
    // Add keyframe manager
    const keyframeManager = new KeyframeManager({
        container: document.getElementById('timeline-keyframes-container') as HTMLElement
    });
    timeline.addPlugin(keyframeManager, keyframeManager.metadata);
    
    // Add object toolbar
    const objectToolbar = new ObjectToolbar({
        container: document.getElementById('timeline-object-toolbar') as HTMLElement
    });
    timeline.addPlugin(objectToolbar, objectToolbar.metadata);
    
    // Add group manager
    const groupManager = new GroupManager({
        container: document.body // The group manager doesn't need a visible container
    });
    timeline.addPlugin(groupManager, groupManager.metadata);
    
    // Initialize all plugins
    timeline.initializePlugins();
    
    // Create a default layer if none exists
    if (timeline.getLayers().length === 0 && options.createDefaultLayer !== false) {
        timeline.addLayer({
            id: 'layer-default',
            name: 'Layer 1'
        });
    }
    
    return timeline;
}

// Export classes for advanced usage
export { 
    TimelineControl,
    TimeRuler,
    LayerManager,
    KeyframeManager,
    GroupManager,
    MainToolbar,
    ObjectToolbar
};
