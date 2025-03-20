/**
 * Timeline Control Constants
 * Shared constants for the timeline control
 */
export declare const TimelineConstants: {
    CSS_CLASSES: {
        TIMELINE: string;
        TOOLBAR: string;
        CONTENT: string;
        RULER: string;
        LAYERS: string;
        LAYER_NAME: string;
        KEYFRAMES: string;
        OBJECT_TOOLBAR: string;
        CURSOR: string;
        LAYER: string;
        KEYFRAME: string;
        MOTION_TWEEN: string;
        SELECTED: string;
        LOCKED: string;
        HIDDEN: string;
        BTN: string;
        DROPDOWN: string;
        PANEL: string;
    };
    DIMENSIONS: {
        LAYER_HEIGHT: number;
        KEYFRAME_SIZE: number;
        LEFT_PANEL_WIDTH: number;
        TOOLBAR_HEIGHT: number;
        TIME_RULER_HEIGHT: number;
        OBJECT_TOOLBAR_HEIGHT: number;
        PIXELS_PER_SECOND: number;
    };
    TIME: {
        DEFAULT_DURATION: number;
        DEFAULT_TIME_SCALE: number;
        MIN_TIME_SCALE: number;
        MAX_TIME_SCALE: number;
    };
    COLORS: {
        LAYER_DEFAULTS: string[];
        KEYFRAME: string;
        KEYFRAME_SELECTED: string;
        TWEEN_LINE: string;
        TIME_CURSOR: string;
    };
    EVENTS: {
        PLAY: string;
        PAUSE: string;
        STOP: string;
        TIME_CHANGE: string;
        DURATION_CHANGE: string;
        LAYER_ADDED: string;
        LAYER_UPDATED: string;
        LAYER_REMOVED: string;
        LAYER_SELECTED: string;
        LAYER_MOVED: string;
        LAYER_VISIBILITY_CHANGED: string;
        LAYER_LOCK_CHANGED: string;
        LAYER_COLOR_CHANGED: string;
        LAYER_NAME_CHANGED: string;
        LAYER_GROUP_TOGGLE: string;
        LAYER_GROUP_REMOVED: string;
        KEYFRAME_ADDED: string;
        KEYFRAME_UPDATED: string;
        KEYFRAME_REMOVED: string;
        KEYFRAME_SELECTED: string;
        KEYFRAME_MOVED: string;
        KEYFRAME_USER_CREATED: string;
        TWEEN_ADDED: string;
        TWEEN_UPDATED: string;
        TWEEN_REMOVED: string;
        TWEEN_USER_CREATED: string;
        TWEEN_SELECTED: string;
        TWEEN_DESELECTED: string;
        ZOOM_CHANGED: string;
        RESIZE: string;
        DATA_IMPORTED: string;
        DATA_EXPORTED: string;
        SEEK_TO_TIME: string;
        PANEL_ELEMENT_SELECTED: string;
        PANEL_ELEMENT_DESELECTED: string;
        PANEL_ELEMENT_UPDATED: string;
        PROPERTY_CHANGED: string;
        EDIT_MODE_CHANGED: string;
        SELECTION_CHANGED: string;
        UNDO: string;
        REDO: string;
        GROUP_CREATED: string;
        GROUP_DELETED: string;
        GROUP_UPDATED: string;
        STATE_SAVED: string;
        STATE_LOADED: string;
        ERROR: string;
        NOTIFICATION: string;
    };
    EASE_FUNCTIONS: string[];
};
