/**
 * Constants used throughout the timeline animation editor
 */

// Event Types
export const Events = {
    // Timeline events
    TIMELINE_INIT: 'timeline:init',
    TIMELINE_DESTROYED: 'timeline:destroyed',
    TIMELINE_RESIZED: 'timeline:resized',
    
    // Scene events
    SCENE_ADDED: 'scene:added',
    SCENE_REMOVED: 'scene:removed',
    SCENE_SELECTED: 'scene:selected',
    SCENE_RENAMED: 'scene:renamed',
      // Time events
    TIME_CHANGED: 'time:changed',
    DURATION_CHANGED: 'duration:changed',
    SCALE_CHANGED: 'scale:changed',
    RESOLUTION_CHANGED: 'resolution:changed',
    SEEK: 'time:seek',
    PLAYHEAD_MOVED: 'playhead:moved',
    TOGGLE_PLAYBACK: 'playback:toggle',
    STEP_FORWARD: 'playback:step-forward',
    STEP_BACKWARD: 'playback:step-backward',
    
    // Layer events
    LAYER_ADDED: 'layer:added',
    LAYER_REMOVED: 'layer:removed',
    LAYER_UPDATED: 'layer:updated',
    LAYER_SELECTED: 'layer:selected',
    LAYER_DESELECTED: 'layer:deselected',
    LAYER_MOVED: 'layer:moved',
    LAYER_RENAMED: 'layer:renamed',
    
    // Keyframe events
    KEYFRAME_ADDED: 'keyframe:added',
    KEYFRAME_REMOVED: 'keyframe:removed',
    KEYFRAME_UPDATED: 'keyframe:updated',
    KEYFRAME_SELECTED: 'keyframe:selected',
    KEYFRAME_DESELECTED: 'keyframe:deselected',
    KEYFRAME_MOVED: 'keyframe:moved',
      // Tween events
    TWEEN_ADDED: 'tween:added',
    TWEEN_REMOVED: 'tween:removed',
    TWEEN_UPDATED: 'tween:updated',
    TWEEN_CREATED: 'tween:created',
    
    // Keyframes multiple selection event
    KEYFRAMES_DELETED: 'keyframes:deleted',
    
    // Stage events
    STAGE_ELEMENT_SELECTED: 'stage:element-selected',
    
    // Group events
    GROUP_CREATED: 'group:created',
    GROUP_REMOVED: 'group:removed',
    GROUP_EXPANDED: 'group:expanded',
    GROUP_COLLAPSED: 'group:collapsed',
    
    // Scroll events
    SCROLL_HORIZONTAL: 'scroll:horizontal',
    SCROLL_VERTICAL: 'scroll:vertical',
};

// CSS Classes
export const CssClasses = {
    // Main containers
    TIMELINE_CONTROL: 'timeline-control',
    TIMELINE_TOOLBAR: 'timeline-toolbar',
    SCENE_SELECTOR: 'timeline-scene-selector',
    ADD_KEYFRAME_BUTTON: 'timeline-add-keyframe-button',
    TIME_RESOLUTION_CONTROL: 'timeline-time-resolution-control',
    TIMELINE_CONTENT: 'timeline-content',
    TIMELINE_CONTENT_CONTAINER: 'timeline-content-container',
    TIMELINE_LAYERS_CONTAINER: 'timeline-layers-container',
    TIMELINE_LAYERS_HEADER: 'timeline-layers-header',
    TIMELINE_LAYERS_TOOLBAR: 'timeline-layers-toolbar',
    TIMELINE_KEYFRAMES_AREA: 'timeline-keyframes-area',
    TIMELINE_RULER: 'timeline-ruler',
    TIMELINE_KEYFRAMES_CONTAINER: 'timeline-keyframes-container',
    TIMELINE_PLAYBACK_TOOLBAR: 'timeline-playback-toolbar',
    TIMELINE_OBJECT_TOOLBAR: 'timeline-object-toolbar',
      // Layer classes
    LAYER_LIST: 'timeline-layer-list',
    LAYER: 'timeline-layer',
    LAYER_ROW: 'timeline-layer-row',
    LAYER_SELECTED: 'selected',
    LAYER_VISIBLE: 'visible',
    LAYER_LOCKED: 'locked',
    LAYER_NAME: 'layer-name',
    LAYER_ICON: 'layer-icon',
    LAYER_CONTROLS: 'layer-controls',
      // Keyframe classes
    KEYFRAME_ROW: 'timeline-keyframe-row',
    KEYFRAME: 'timeline-keyframe',
    KEYFRAME_SELECTED: 'selected',
    KEYFRAME_SOLID: 'solid',
    KEYFRAME_HOLLOW: 'hollow',
    FRAME_STANDARD: 'standard-frame',
    FRAME_EMPTY: 'empty-frame',
    TWEEN: 'timeline-tween',
    TWEEN_MOTION: 'motion',
    TWEEN_SHAPE: 'shape',
    FRAME_GRID: 'timeline-frame-grid',
    PLAYHEAD: 'timeline-playhead',
    PLAYHEAD_HANDLE: 'timeline-playhead-handle',
    
    // Ruler classes
    RULER_CONTENT: 'timeline-ruler-content',
    TIME_MARKER: 'time-marker',
    TIME_MARKER_MAJOR: 'major',
    TIME_LABEL: 'time-label',
};

// Dimensions and units
export const Dimensions = {
    DEFAULT_TIME_SCALE: 100, // pixels per second
    MIN_TIME_SCALE: 10,
    MAX_TIME_SCALE: 500,
    DEFAULT_DURATION: 10, // seconds
    MIN_DURATION: 1,
    MAX_DURATION: 3600,
    LAYER_HEIGHT: 30, // pixels
    RULER_HEIGHT: 30, // pixels
    TOOLBAR_HEIGHT: 40, // pixels
    OBJECT_TOOLBAR_HEIGHT: 30, // pixels
    KEYFRAME_SIZE: 10, // pixels
};

// Plugin IDs
export const PluginIds = {
    TIME_RULER: 'timeRuler',
    LAYER_MANAGER: 'layerManager',
    KEYFRAME_MANAGER: 'keyframeManager',
    GROUP_MANAGER: 'groupManager',
};

// Time Resolution presets in seconds
export const TimeResolutions = {
    MILLISECOND: 0.001,   // 1/1000 second
    CENTISECOND: 0.01,    // 1/100 second
    DECISECOND: 0.1,      // 1/10 second
    SECOND: 1,            // 1 second
    FIVE_SECONDS: 5,      // 5 seconds
    TEN_SECONDS: 10,      // 10 seconds
    THIRTY_SECONDS: 30,   // 30 seconds
    MINUTE: 60,           // 1 minute
};

// Plugin Dependencies
export const PluginDependencies = {
    [PluginIds.KEYFRAME_MANAGER]: [PluginIds.TIME_RULER, PluginIds.LAYER_MANAGER],
    [PluginIds.GROUP_MANAGER]: [PluginIds.LAYER_MANAGER],
};
