// src/index.ts
/**
 * Timeline Control
 * Main export file
 */

import { TimelineControl, TimelineOptions } from './core/TimelineControl';
import { TimelineDataModel, Layer, Keyframe, MotionTween } from './core/DataModel';
import { TimelineConstants } from './core/Constants';

// Export main classes
export {
    TimelineControl,
    TimelineDataModel,
    TimelineConstants
};

// Export interfaces
export type {
    TimelineOptions,
    Layer,
    Keyframe,
    MotionTween
};

// Default export
export default TimelineControl;