// filepath: c:\Users\BenoitRobin\JsTimeline\v2-vscode\timeline-animation-editor\src\utils\EventTypes.ts

export const EVENT_TYPES = {
    // Time-related events
    TIME_UPDATED: 'timeUpdated',
    DURATION_CHANGED: 'durationChanged',
    ZOOM_CHANGED: 'zoomChanged',
    
    // Layer events
    LAYER_ADDED: 'layerAdded',
    LAYER_REMOVED: 'layerRemoved',
    LAYER_RENAMED: 'layerRenamed',
    LAYER_SELECTED: 'layerSelected',
    LAYER_MOVED: 'layerMoved',
    LAYER_VISIBILITY_CHANGED: 'layerVisibilityChanged',
    LAYER_LOCKED: 'layerLocked',
    LAYER_UNLOCKED: 'layerUnlocked',
    
    // Keyframe events
    KEYFRAME_ADDED: 'keyframeAdded',
    KEYFRAME_REMOVED: 'keyframeRemoved',
    KEYFRAME_MOVED: 'keyframeMoved',
    KEYFRAME_SELECTED: 'keyframeSelected',
    KEYFRAME_VALUE_CHANGED: 'keyframeValueChanged',
    
    // Group events
    GROUP_CREATED: 'groupCreated',
    GROUP_REMOVED: 'groupRemoved',
    GROUP_RENAMED: 'groupRenamed',
    GROUP_EXPANDED: 'groupExpanded',
    GROUP_COLLAPSED: 'groupCollapsed',
    LAYER_ADDED_TO_GROUP: 'layerAddedToGroup',
    LAYER_REMOVED_FROM_GROUP: 'layerRemovedFromGroup',
      // UI events
    UI_REDRAW_REQUIRED: 'uiRedrawRequired',
    SCROLL_SYNC_REQUIRED: 'scrollSyncRequired',
    
    // Playback events
    PLAYBACK_STARTED: 'playbackStarted',
    PLAYBACK_STOPPED: 'playbackStopped',
    
    // Data events
    DATA_LOADED: 'dataLoaded',
    DATA_SAVED: 'dataSaved',
    DATA_CHANGED: 'dataChanged',
    DATA_RESET: 'dataReset'
};
