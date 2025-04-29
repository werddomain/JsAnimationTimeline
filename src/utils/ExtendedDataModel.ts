/**
 * Extended DataModel interface
 * Includes time resolution methods and other extensions
 */

import { DataModel, ILayer, IKeyframe, ITween, ITimelineState } from '../core/DataModel';

// Extended DataModel interface with time resolution methods
export interface IExtendedDataModel extends DataModel {
    // Time resolution extension methods
    getTimeResolution(): number;
    setTimeResolution(resolution: number): void;
    snapToResolution(time: number): number;
    isOnResolutionBoundary(time: number): boolean;
    
    // All the DataModel methods are inherited automatically
}
