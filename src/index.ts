/**
 * Main entry point for the Animation Timeline Editor
 */
import './styles/main.less';
import { TimelineControl, ITimelineControlOptions } from './core/TimelineControl';
import { KeyframeType } from './core/DataModel';
import { TimeRuler } from './plugins/TimeRuler';
import { LayerManager } from './plugins/LayerManager';
import { KeyframeManager } from './plugins/KeyframeManager';
import { GroupManager } from './plugins/GroupManager';
import { PluginIds, CssClasses } from './constants/Constants';

// Initialize the timeline when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Animation Timeline Editor initializing...');
    
    // Get the container element
    const container = document.getElementById('timeline-container');
    if (!container) {
        console.error('Timeline container not found');
        return;
    }
    
    // Create the timeline control with options
    const timelineControl = new TimelineControl({
        container,
        timeline: {
            duration: 30, // 30 seconds
            timeScale: 100, // 100 pixels per second
            startTime: 0,
            fps: 30
        }
    });
    
    // Initialize timeline to create DOM structure
    timelineControl.initialize();
    
    // Get references to necessary models
    const dataModel = timelineControl.getDataModel();
    const eventEmitter = timelineControl.getEventEmitter();
    const pluginManager = timelineControl.getPluginManager();
    
    // Get containers for plugins - use CssClasses constants instead of string literals
    const timeRulerContainer = timelineControl.getDomElement(CssClasses.TIMELINE_RULER);
    const layersContainer = timelineControl.getDomElement(CssClasses.TIMELINE_LAYERS_CONTAINER);
    const keyframesContainer = timelineControl.getDomElement(CssClasses.TIMELINE_KEYFRAMES_CONTAINER);
    
    if (!timeRulerContainer || !layersContainer || !keyframesContainer) {
        console.error('Required DOM elements not found');
        return;
    }
    
    // Create and register plugins
    
    // Create TimeRuler plugin
    const timeRuler = new TimeRuler({
        container: timeRulerContainer,
        dataModel,
        eventEmitter
    });
      // Get the layer list container (the actual container for layers, not the wrapper)
    const layerListContainer = timelineControl.getDomElement(CssClasses.LAYER_LIST);
    if (!layerListContainer) {
        console.error('Layer list container not found');
        return;
    }
      // Create LayerManager plugin - attach to layer list instead of layers container
    const layerManager = new LayerManager({
        container: layerListContainer, // Attach to the layer list element
        dataModel,
        eventEmitter,
        timelineControl // Pass the timelineControl reference
    });
      // Create KeyframeManager plugin
    const keyframeManager = new KeyframeManager({
        container: keyframesContainer,
        dataModel,
        eventEmitter,
        timelineControl // Pass the timelineControl reference
    });      // Create GroupManager plugin - also attach to the layer list
    const groupManager = new GroupManager({
        container: layerListContainer, // Use same container as LayerManager
        dataModel,
        eventEmitter,
        timelineControl // Pass the timelineControl reference
    });
      // First mount all plugins to create their DOM structure
    console.log('Mounting plugins...');
    try {
        timeRuler.mount();
        console.log('TimeRuler mounted');
        
        layerManager.mount();
        console.log('LayerManager mounted');
        
        keyframeManager.mount();
        console.log('KeyframeManager mounted');
        
        groupManager.mount();
        console.log('GroupManager mounted');
    } catch (error) {
        console.error('Error mounting plugins:', error);
        return;
    }
    
    // Then register them with the plugin manager
    console.log('Registering plugins...');
    pluginManager.register(PluginIds.TIME_RULER, timeRuler);
    pluginManager.register(PluginIds.LAYER_MANAGER, layerManager);
    pluginManager.register(
        PluginIds.KEYFRAME_MANAGER, 
        keyframeManager, 
        [PluginIds.TIME_RULER, PluginIds.LAYER_MANAGER]
    );
    pluginManager.register(
        PluginIds.GROUP_MANAGER, 
        groupManager, 
        [PluginIds.LAYER_MANAGER]
    );
      // Let the plugin manager initialize all plugins in the correct dependency order
    console.log('Initializing plugins through plugin manager...');
    try {        pluginManager.initializeAll();
        console.log('All plugins initialized successfully');
        
        // Now that plugins are initialized, ensure default layer again
        // This ensures the LayerManager gets updated properly
        console.log('Ensuring default layer after plugin initialization...');
        timelineControl.ensureDefaultLayer();
    } catch (error) {
        console.error('Error initializing plugins:', error);
    }
    
    // Create some test layers
    const layer1 = {
        id: 'layer-1',
        name: 'Layer 1',
        visible: true,
        locked: false,
        order: 0,
        keyframes: {
            'keyframe-1': {
                id: 'keyframe-1',
                time: 1,
                value: { x: 0, y: 0 },
                type: 'solid' as KeyframeType
            },
            'keyframe-2': {
                id: 'keyframe-2',
                time: 5,
                value: { x: 100, y: 50 },
                type: 'solid' as KeyframeType
            }
        }
    };
    
    const layer2 = {
        id: 'layer-2',
        name: 'Layer 2',
        visible: true,
        locked: false,
        order: 1,
        keyframes: {
            'keyframe-3': {
                id: 'keyframe-3',
                time: 2,
                value: { rotation: 0 },
                type: 'solid' as KeyframeType
            },
            'keyframe-4': {
                id: 'keyframe-4',
                time: 8,
                value: { rotation: 180 },
                type: 'solid' as KeyframeType
            }
        }
    };
      // Add test layers
    console.log('Adding test layers via timelineControl...');
    timelineControl.addLayer(layer1);
    timelineControl.addLayer(layer2);
    
    console.log('Animation Timeline Editor initialized');
});
