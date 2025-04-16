/**
 * Event constants for timeline events
 */
export enum Events {
    // Time management events
    TIME_CHANGED = 'timeChanged',
    TIME_SCALE_CHANGED = 'timeScaleChanged',
    SEEK = 'seek',
    
    // Layer management events
    LAYER_ADDED = 'layerAdded',
    LAYER_REMOVED = 'layerRemoved',
    LAYER_SELECTED = 'layerSelected',
    LAYER_RENAMED = 'layerRenamed',
    LAYER_REORDERED = 'layerReordered',
    
    // Keyframe management events
    KEYFRAME_ADDED = 'keyframeAdded',
    KEYFRAME_REMOVED = 'keyframeRemoved',
    KEYFRAME_MOVED = 'keyframeMoved',
    KEYFRAME_SELECTED = 'keyframeSelected',
    
    // Group management events
    GROUP_ADDED = 'groupAdded',
    GROUP_REMOVED = 'groupRemoved',
    GROUP_RENAMED = 'groupRenamed',
    
    // UI events
    UI_ZOOM_CHANGED = 'uiZoomChanged',
    UI_SCROLL_HORIZONTAL = 'uiScrollHorizontal',
    UI_SCROLL_VERTICAL = 'uiScrollVertical'
}

/**
 * Layer data interface
 */
export interface LayerData {
    id: string;
    name: string;
    groupId?: string;
    isVisible?: boolean;
    isLocked?: boolean;
}

/**
 * Keyframe data interface
 */
export interface KeyframeData {
    id: string;
    layerId: string;
    time: number;
    value: any;
    easing?: string;
}

/**
 * Group data interface
 */
export interface GroupData {
    id: string;
    name: string;
    isExpanded?: boolean;
}

/**
 * Map of event types to their data types
 */
export interface EventMap {
    [Events.TIME_CHANGED]: { time: number };
    [Events.TIME_SCALE_CHANGED]: { timeScale: number };
    [Events.SEEK]: { time: number };
    
    [Events.LAYER_ADDED]: { layer: LayerData };
    [Events.LAYER_REMOVED]: { layerId: string };
    [Events.LAYER_SELECTED]: { layerId: string };
    [Events.LAYER_RENAMED]: { layerId: string, name: string };
    [Events.LAYER_REORDERED]: { layerId: string, newIndex: number };
    
    [Events.KEYFRAME_ADDED]: { keyframe: KeyframeData };
    [Events.KEYFRAME_REMOVED]: { keyframeId: string, layerId: string };
    [Events.KEYFRAME_MOVED]: { keyframeId: string, layerId: string, newTime: number };
    [Events.KEYFRAME_SELECTED]: { keyframeId: string, layerId: string };
    
    [Events.GROUP_ADDED]: { group: GroupData };
    [Events.GROUP_REMOVED]: { groupId: string };
    [Events.GROUP_RENAMED]: { groupId: string, name: string };
    
    [Events.UI_ZOOM_CHANGED]: { zoomLevel: number };
    [Events.UI_SCROLL_HORIZONTAL]: { scrollLeft: number };
    [Events.UI_SCROLL_VERTICAL]: { scrollTop: number };
}

/**
 * Event handler type definition
 */
export type EventHandler<T> = (sender: any, data: T) => void;
