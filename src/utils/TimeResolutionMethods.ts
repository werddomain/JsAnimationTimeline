/**
 * TimeResolutionMethods for DataModel
 * Extension methods to handle time resolution functionality
 */

import { DataModel } from '../core/DataModel';
import { Events, TimeResolutions } from '../constants/Constants';

/**
 * Extend the DataModel class with time resolution methods
 * This adds the time resolution methods to the DataModel prototype and instance
 */
export function extendDataModelWithTimeResolution(dataModel: DataModel): void {
    // Define methods first so we can reference them
    const getTimeResolutionMethod = function(this: DataModel): number {
        return (this as any).state.timeResolution || TimeResolutions.SECOND;
    };
    
    const setTimeResolutionMethod = function(this: DataModel, resolution: number): void {
        const oldResolution = (this as any).state.timeResolution;
        (this as any).state.timeResolution = resolution;
        
        // Emit resolution changed event
        this.emit(Events.RESOLUTION_CHANGED, { 
            oldResolution, 
            newResolution: resolution 
        });
    };
    
    const snapToResolutionMethod = function(this: DataModel, time: number): number {
        // Safe access to getTimeResolution using 'as any'
        const resolution = (this as any).getTimeResolution();
        return Math.round(time / resolution) * resolution;
    };
    
    const isOnResolutionBoundaryMethod = function(this: DataModel, time: number): boolean {
        // Safe access to methods using 'as any'
        const resolution = (this as any).getTimeResolution();
        const snappedTime = (this as any).snapToResolution(time);
        return Math.abs(time - snappedTime) < 0.0001; // Small epsilon for floating point comparison
    };

    // Add methods to prototype if they don't exist
    if (!('getTimeResolution' in DataModel.prototype)) {
        Object.defineProperty(DataModel.prototype, 'getTimeResolution', {
            value: getTimeResolutionMethod,
            writable: false,
            configurable: true
        });
    }
    
    if (!('setTimeResolution' in DataModel.prototype)) {
        Object.defineProperty(DataModel.prototype, 'setTimeResolution', {
            value: setTimeResolutionMethod,
            writable: false,
            configurable: true
        });
    }
    
    if (!('snapToResolution' in DataModel.prototype)) {
        Object.defineProperty(DataModel.prototype, 'snapToResolution', {
            value: snapToResolutionMethod,
            writable: false,
            configurable: true
        });
    }
    
    if (!('isOnResolutionBoundary' in DataModel.prototype)) {
        Object.defineProperty(DataModel.prototype, 'isOnResolutionBoundary', {
            value: isOnResolutionBoundaryMethod,
            writable: false,
            configurable: true
        });
    }
    
    // Initialize the instance methods if needed
    if (!('getTimeResolution' in dataModel)) {
        Object.defineProperties(dataModel, {
            getTimeResolution: {
                value: getTimeResolutionMethod,
                writable: false,
                configurable: true
            },
            setTimeResolution: {
                value: setTimeResolutionMethod,
                writable: false,
                configurable: true
            },
            snapToResolution: {
                value: snapToResolutionMethod,
                writable: false,
                configurable: true
            },
            isOnResolutionBoundary: {
                value: isOnResolutionBoundaryMethod,
                writable: false,
                configurable: true
            }
        });
    }
}
