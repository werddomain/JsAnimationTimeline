// src/core/EventTypes.ts
/**
 * Typed Event System for Timeline Control
 */

import { Layer, Keyframe, MotionTween } from './DataModel';
import { TimelineConstants } from './Constants';

const { EVENTS } = TimelineConstants;

// Define event map interface with strongly typed callbacks
export interface TimelineEventMap {
    // Playback events
    [EVENTS.PLAY]: () => void;
    [EVENTS.PAUSE]: () => void;
    [EVENTS.STOP]: () => void;
    [EVENTS.TIME_CHANGE]: (time: number) => void;
    [EVENTS.DURATION_CHANGE]: (duration: number) => void;

    // Layer events
    [EVENTS.LAYER_ADDED]: (layer: Layer) => void;
    [EVENTS.LAYER_UPDATED]: (layer: Layer) => void;
    [EVENTS.LAYER_REMOVED]: (layerId: string) => void;
    [EVENTS.LAYER_SELECTED]: (layerId: string, isMultiSelect: boolean) => void;
    [EVENTS.LAYER_MOVED]: (layerId: string, newIndex: number) => void;
    [EVENTS.LAYER_VISIBILITY_CHANGED]: (layerId: string, visible: boolean) => void;
    [EVENTS.LAYER_LOCK_CHANGED]: (layerId: string, locked: boolean) => void;
    [EVENTS.LAYER_COLOR_CHANGED]: (layerId: string, color: string) => void;
    [EVENTS.LAYER_NAME_CHANGED]: (layerId: string, name: string) => void;
    [EVENTS.LAYER_GROUP_TOOGLE]: (layerId: string, locked: boolean) => void;
    [EVENTS.LAYER_GROUP_REMOVED]: (layerId: string) => void;

    // Keyframe events
    [EVENTS.KEYFRAME_ADDED]: (layerId: string, keyframe: Keyframe) => void;
    [EVENTS.KEYFRAME_UPDATED]: (layerId: string, keyframe: Keyframe) => void;
    [EVENTS.KEYFRAME_REMOVED]: (layerId: string, keyframeId: string) => void;
    [EVENTS.KEYFRAME_SELECTED]: (layerId: string, keyframeId: string, isMultiSelect: boolean) => void;
    [EVENTS.KEYFRAME_MOVED]: (layerId: string, keyframeId: string, newTime: number) => void;
    [EVENTS.KEYFRAME_USER_CREATED]: (layerId: string, time: number) => void;

    // Motion tween events
    [EVENTS.TWEEN_ADDED]: (layerId: string, tween: MotionTween) => void;
    [EVENTS.TWEEN_SELECTED]: (layer: Layer, tween: MotionTween) => void;
    [EVENTS.TWEEN_DESELECTED]: () => void;
    [EVENTS.TWEEN_UPDATED]: (layerId: string, tween: MotionTween) => void;
    [EVENTS.TWEEN_REMOVED]: (layerId: string, tweenId: string) => void;
    [EVENTS.TWEEN_USER_CREATED]: (layerId: string, startKeyframeId: string, endKeyframeId: string) => void;

    // UI events
    [EVENTS.ZOOM_CHANGED]: (scale: number) => void;
    [EVENTS.RESIZE]: (width: number, height: number) => void;
    [EVENTS.DATA_IMPORTED]: () => void;
    [EVENTS.DATA_EXPORTED]: (data: string) => void;
    [EVENTS.SEEK_TO_TIME]: (time: number) => void;
}

// Define a generic event listener type
export type TimelineEventListener<T extends keyof TimelineEventMap> = TimelineEventMap[T];