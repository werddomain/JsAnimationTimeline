// src/core/Constants.ts
/**
 * Timeline Control Constants
 * Shared constants for the timeline control
 */

export const TimelineConstants = {
    // DOM Class Names
    CSS_CLASSES: {
        TIMELINE: 'timeline-control',
        TOOLBAR: 'timeline-toolbar',
        CONTENT: 'timeline-content',
        RULER: 'timeline-ruler',
        LAYERS: 'timeline-layers-container',
        KEYFRAMES: 'timeline-keyframes-container',
        OBJECT_TOOLBAR: 'timeline-object-toolbar',
        CURSOR: 'timeline-cursor',
        LAYER: 'timeline-layer',
        KEYFRAME: 'timeline-keyframe',
        MOTION_TWEEN: 'timeline-motion-tween',
        SELECTED: 'selected',
        LOCKED: 'locked',
        HIDDEN: 'hidden',
        BTN: 'timeline-btn',
        DROPDOWN: 'timeline-dropdown',
        PANEL: 'timeline-panel'
    },

    // Default Dimensions
    DIMENSIONS: {
        LAYER_HEIGHT: 30,
        KEYFRAME_SIZE: 12,
        LEFT_PANEL_WIDTH: 200,
        TOOLBAR_HEIGHT: 40,
        TIME_RULER_HEIGHT: 25,
        OBJECT_TOOLBAR_HEIGHT: 30,
        PIXELS_PER_SECOND: 10
    },

    // Time Configuration
    TIME: {
        DEFAULT_DURATION: 600, // 10 minutes in seconds
        DEFAULT_TIME_SCALE: 1,
        MIN_TIME_SCALE: 0.1,
        MAX_TIME_SCALE: 10
    },

    // Default Colors
    COLORS: {
        LAYER_DEFAULTS: [
            '#FF5252', // Red
            '#FFAB40', // Orange
            '#FFEB3B', // Yellow
            '#66BB6A', // Green
            '#42A5F5', // Blue
            '#7E57C2', // Purple
            '#EC407A', // Pink
            '#26A69A'  // Teal
        ],
        KEYFRAME: '#FFFFFF',
        KEYFRAME_SELECTED: '#FFEB3B',
        TWEEN_LINE: '#AAAAAA',
        TIME_CURSOR: '#FF0000'
    },

    // Event Names
    EVENTS: {
        // Playback events
        PLAY: 'playback:play',
        PAUSE: 'playback:pause',
        STOP: 'playback:stop',
        TIME_CHANGE: 'time:changed',
        DURATION_CHANGE: 'duration:changed',

        // Layer events
        LAYER_ADDED: 'layer:added',
        LAYER_UPDATED: 'layer:updated',
        LAYER_REMOVED: 'layer:removed',
        LAYER_SELECTED: 'layer:selected',
        LAYER_MOVED: 'layer:moved',
        LAYER_VISIBILITY_CHANGED: 'layer:visibility:changed',
        LAYER_LOCK_CHANGED: 'layer:lock:changed',
        LAYER_COLOR_CHANGED: 'layer:color:changed',
        LAYER_NAME_CHANGED: 'layer:name:changed',

        // Keyframe events
        KEYFRAME_ADDED: 'keyframe:added',
        KEYFRAME_UPDATED: 'keyframe:updated',
        KEYFRAME_REMOVED: 'keyframe:removed',
        KEYFRAME_SELECTED: 'keyframe:selected',
        KEYFRAME_MOVED: 'keyframe:moved',
        KEYFRAME_USER_CREATED: 'keyframe:user:created',

        // Motion tween events
        TWEEN_ADDED: 'motiontween:added',
        TWEEN_UPDATED: 'motiontween:updated',
        TWEEN_REMOVED: 'motiontween:removed',
        TWEEN_USER_CREATED: 'motiontween:user:created',

        // UI events
        ZOOM_CHANGED: 'zoom:changed',
        RESIZE: 'resize',
        DATA_IMPORTED: 'data:imported',
        DATA_EXPORTED: 'data:exported',
        SEEK_TO_TIME: 'seek:to:time'
    },

    // Default ease functions for motion tweens
    EASE_FUNCTIONS: [
        'linear',
        'easeInQuad',
        'easeOutQuad',
        'easeInOutQuad',
        'easeInCubic',
        'easeOutCubic',
        'easeInOutCubic',
        'easeInQuart',
        'easeOutQuart',
        'easeInOutQuart',
        'easeInQuint',
        'easeOutQuint',
        'easeInOutQuint'
    ]
};