// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\utils\Constants.ts

export const CSS_CLASSES = {
    // Main container classes
    TIMELINE_CONTROL: 'timeline-control',
    TIMELINE_TOOLBAR: 'timeline-toolbar',
    TIMELINE_CONTENT: 'timeline-content',
    TIMELINE_CONTENT_CONTAINER: 'timeline-content-container',
    TIMELINE_LAYERS_CONTAINER: 'timeline-layers-container',
    TIMELINE_KEYFRAMES_AREA: 'timeline-keyframes-area',
    TIMELINE_RULER: 'timeline-ruler',
    TIMELINE_KEYFRAMES_CONTAINER: 'timeline-keyframes-container',
    TIMELINE_OBJECT_TOOLBAR: 'timeline-object-toolbar',
    
    // Time ruler classes
    TIMELINE_RULER_CONTENT: 'timeline-ruler-content',
    TIME_MARKER: 'time-marker',
    TIME_MARKER_MAJOR: 'time-marker-major',
    TIME_MARKER_MINOR: 'time-marker-minor',
    TIME_MARKER_LABEL: 'time-marker-label',
    
    // Layer classes
    LAYER_ITEM: 'layer-item',
    LAYER_SELECTED: 'selected',
    LAYER_NAME: 'layer-name',
    LAYER_CONTROLS: 'layer-controls',
    
    // Keyframe classes
    KEYFRAME: 'keyframe',
    KEYFRAME_SELECTED: 'selected',
    
    // Group classes
    GROUP_ITEM: 'group-item',
    GROUP_HEADER: 'group-header',
    GROUP_EXPANDED: 'expanded',
    GROUP_COLLAPSED: 'collapsed'
};

export const DIMENSIONS = {
    TIME_RULER_HEIGHT: '30px',
    LAYER_ITEM_HEIGHT: '40px',
    KEYFRAME_SIZE: '12px',
};

export const DEFAULT_VALUES = {
    PIXELS_PER_SECOND: 100,
    DEFAULT_DURATION: 60, // seconds
    DEFAULT_TIME_SCALE: 1,
    MIN_TIME_SCALE: 0.1,
    MAX_TIME_SCALE: 10
};

export const PLUGIN_NAMES = {
    TIME_RULER: 'timeRuler',
    LAYER_MANAGER: 'layerManager',
    KEYFRAME_MANAGER: 'keyframeManager',
    GROUP_MANAGER: 'groupManager',
    MAIN_TOOLBAR: 'mainToolbar',
    OBJECT_TOOLBAR: 'objectToolbar'
};
