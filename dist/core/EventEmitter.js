/* eslint-disable @typescript-eslint/ban-types */
// src/core/EventEmitter.ts
/**
 * Event Emitter with Strongly-Typed Events
 * Provides individual, typed methods for each event in the TimelineEventMap
 */
import { TimelineConstants } from './Constants';
const { EVENTS } = TimelineConstants;
export class EventEmitter {
    constructor() {
        this.events = new Map();
    }
    /**
     * Base method to subscribe to an event with type-safe callback
     * @param eventName Name of the event
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        const callbacks = this.events.get(eventName);
        callbacks.push(callback);
        // Return unsubscribe function
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        };
    }
    /**
     * Subscribe to an event once with type-safe callback
     * @param eventName Name of the event
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    once(eventName, callback) {
        const unsubscribe = this.on(eventName, ((...args) => {
            unsubscribe();
            callback(...args);
        }));
        return unsubscribe;
    }
    /**
     * Base method to emit an event (internal use only)
     * @param eventName Name of the event
     * @param args Arguments to pass to the callbacks
     */
    emitBase(eventName, ...args) {
        const callbacks = this.events.get(eventName);
        if (!callbacks)
            return;
        // Create a copy to avoid issues if callbacks modify the array
        [...callbacks].forEach(callback => {
            try {
                callback(...args);
            }
            catch (error) {
                console.error(`Error in ${eventName} event handler:`, error);
            }
        });
    }
    /**
     * Remove all event listeners
     * @param eventName Optional event name to remove listeners for
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this.events.delete(eventName);
        }
        else {
            this.events.clear();
        }
    }
    /**
     * Get the number of listeners for an event
     * @param eventName Name of the event
     * @returns Number of listeners
     */
    listenerCount(eventName) {
        const callbacks = this.events.get(eventName);
        return callbacks ? callbacks.length : 0;
    }
    // Individual, strongly-typed emit methods for each event
    // Playback events
    emitPlay() {
        this.emitBase(EVENTS.PLAY);
    }
    emitPause() {
        this.emitBase(EVENTS.PAUSE);
    }
    emitStop() {
        this.emitBase(EVENTS.STOP);
    }
    emitTimeChange(time) {
        this.emitBase(EVENTS.TIME_CHANGE, time);
    }
    emitDurationChange(duration) {
        this.emitBase(EVENTS.DURATION_CHANGE, duration);
    }
    // Layer events
    emitLayerAdded(layer) {
        this.emitBase(EVENTS.LAYER_ADDED, layer);
    }
    emitLayerUpdated(layer) {
        this.emitBase(EVENTS.LAYER_UPDATED, layer);
    }
    emitLayerRemoved(layerId) {
        this.emitBase(EVENTS.LAYER_REMOVED, layerId);
    }
    emitLayerSelected(layerId, isMultiSelect) {
        this.emitBase(EVENTS.LAYER_SELECTED, layerId, isMultiSelect);
    }
    emitLayerMoved(layerId, newIndex) {
        this.emitBase(EVENTS.LAYER_MOVED, layerId, newIndex);
    }
    emitLayerVisibilityChanged(layerId, visible) {
        this.emitBase(EVENTS.LAYER_VISIBILITY_CHANGED, layerId, visible);
    }
    emitLayerGroupToggle(layerId, isExpanded) {
        this.emitBase(EVENTS.LAYER_GROUP_TOGGLE, layerId, isExpanded);
    }
    emitLayerGroupRemoved(layerId) {
        this.emitBase(EVENTS.LAYER_GROUP_REMOVED, layerId);
    }
    emitLayerLockChanged(layerId, locked) {
        this.emitBase(EVENTS.LAYER_LOCK_CHANGED, layerId, locked);
    }
    emitLayerColorChanged(layerId, color) {
        this.emitBase(EVENTS.LAYER_COLOR_CHANGED, layerId, color);
    }
    emitLayerNameChanged(layerId, name) {
        this.emitBase(EVENTS.LAYER_NAME_CHANGED, layerId, name);
    }
    // Keyframe events
    emitKeyframeAdded(layerId, keyframe) {
        this.emitBase(EVENTS.KEYFRAME_ADDED, layerId, keyframe);
    }
    emitKeyframeUpdated(layerId, keyframe) {
        this.emitBase(EVENTS.KEYFRAME_UPDATED, layerId, keyframe);
    }
    emitKeyframeRemoved(layerId, keyframeId) {
        this.emitBase(EVENTS.KEYFRAME_REMOVED, layerId, keyframeId);
    }
    emitKeyframeSelected(layerId, keyframeId, isMultiSelect) {
        this.emitBase(EVENTS.KEYFRAME_SELECTED, layerId, keyframeId, isMultiSelect);
    }
    emitKeyframeMoved(layerId, keyframeId, newTime) {
        this.emitBase(EVENTS.KEYFRAME_MOVED, layerId, keyframeId, newTime);
    }
    emitKeyframeUserCreated(layerId, time) {
        this.emitBase(EVENTS.KEYFRAME_USER_CREATED, layerId, time);
    }
    // Motion tween events
    emitTweenAdded(layerId, tween) {
        this.emitBase(EVENTS.TWEEN_ADDED, layerId, tween);
    }
    emitTweenUpdated(layerId, tween) {
        this.emitBase(EVENTS.TWEEN_UPDATED, layerId, tween);
    }
    emitTweenRemoved(layerId, tweenId) {
        this.emitBase(EVENTS.TWEEN_REMOVED, layerId, tweenId);
    }
    emitTweenSelected(layer, tweenId) {
        this.emitBase(EVENTS.TWEEN_SELECTED, layer, tweenId);
    }
    emitTweenDeselected() {
        this.emitBase(EVENTS.TWEEN_DESELECTED);
    }
    emitTweenUserCreated(layerId, startKeyframeId, endKeyframeId) {
        this.emitBase(EVENTS.TWEEN_USER_CREATED, layerId, startKeyframeId, endKeyframeId);
    }
    // UI events
    emitZoomChanged(scale) {
        this.emitBase(EVENTS.ZOOM_CHANGED, scale);
    }
    emitResize(width, height) {
        this.emitBase(EVENTS.RESIZE, width, height);
    }
    emitDataImported() {
        this.emitBase(EVENTS.DATA_IMPORTED);
    }
    emitDataExported(data) {
        this.emitBase(EVENTS.DATA_EXPORTED, data);
    }
    emitSeekToTime(time) {
        this.emitBase(EVENTS.SEEK_TO_TIME, time);
    }
    // Panel events
    emitPanelElementSelected(element) {
        this.emitBase(EVENTS.PANEL_ELEMENT_SELECTED, element);
    }
    emitPanelElementDeselected() {
        this.emitBase(EVENTS.PANEL_ELEMENT_DESELECTED);
    }
    emitPanelElementUpdated(element, time, keyframeProperties) {
        this.emitBase(EVENTS.PANEL_ELEMENT_UPDATED, element, time, keyframeProperties);
    }
    // Property events
    emitPropertyChanged(elementId, propertyName, value) {
        this.emitBase(EVENTS.PROPERTY_CHANGED, elementId, propertyName, value);
    }
    // Timeline editor events
    emitEditModeChanged(mode) {
        this.emitBase(EVENTS.EDIT_MODE_CHANGED, mode);
    }
    emitSelectionChanged(selectedItems) {
        this.emitBase(EVENTS.SELECTION_CHANGED, selectedItems);
    }
    emitUndo() {
        this.emitBase(EVENTS.UNDO);
    }
    emitRedo() {
        this.emitBase(EVENTS.REDO);
    }
    // Group events
    emitGroupCreated(groupId, childIds) {
        this.emitBase(EVENTS.GROUP_CREATED, groupId, childIds);
    }
    emitGroupDeleted(groupId, preserveChildren) {
        this.emitBase(EVENTS.GROUP_DELETED, groupId, preserveChildren);
    }
    emitGroupUpdated(groupId, properties) {
        this.emitBase(EVENTS.GROUP_UPDATED, groupId, properties);
    }
    emitGroupToggle(groupId, isExpanded) {
        this.emitBase(EVENTS.LAYER_GROUP_TOGGLE, groupId, isExpanded);
    }
    // Timeline state events
    emitStateSaved(stateId) {
        this.emitBase(EVENTS.STATE_SAVED, stateId);
    }
    emitStateLoaded(stateId) {
        this.emitBase(EVENTS.STATE_LOADED, stateId);
    }
    // Error and notification events
    emitError(error, source) {
        this.emitBase(EVENTS.ERROR, error, source);
    }
    emitNotification(message, type = 'info') {
        this.emitBase(EVENTS.NOTIFICATION, message, type);
    }
}
//# sourceMappingURL=EventEmitter.js.map