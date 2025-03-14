// src/core/EventEmitter.ts
/**
 * Event Emitter
 * Strongly-typed custom event system for the timeline control
 */

import { TimelineEventMap, TimelineEventListener } from './EventTypes';

export class EventEmitter {
    private events: Map<string, Function[]> = new Map();

    /**
     * Subscribe to an event with type-safe callback
     * @param eventName Name of the event
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    public on<T extends keyof TimelineEventMap>(
        eventName: T,
        callback: TimelineEventListener<T>
    ): () => void {
        if (!this.events.has(eventName as string)) {
            this.events.set(eventName as string, []);
        }

        const callbacks = this.events.get(eventName as string)!;
        callbacks.push(callback as Function);

        // Return unsubscribe function
        return () => {
            const index = callbacks.indexOf(callback as Function);
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
    public once<T extends keyof TimelineEventMap>(
        eventName: T,
        callback: TimelineEventListener<T>
    ): () => void {
        const unsubscribe = this.on(eventName, ((...args: any[]) => {
            unsubscribe();
            (callback as Function)(...args);
        }) as TimelineEventListener<T>);

        return unsubscribe;
    }

    /**
     * Emit an event with type-safe arguments
     * @param eventName Name of the event
     * @param args Arguments to pass to the callbacks
     */
    public emit<T extends keyof TimelineEventMap>(
        eventName: T,
        ...args: Parameters<TimelineEventMap[T]>
    ): void {
        const callbacks = this.events.get(eventName as string);
        if (!callbacks) return;

        // Create a copy to avoid issues if callbacks modify the array
        [...callbacks].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in ${String(eventName)} event handler:`, error);
            }
        });
    }

    /**
     * Remove all event listeners
     * @param eventName Optional event name to remove listeners for
     */
    public removeAllListeners(eventName?: keyof TimelineEventMap): void {
        if (eventName) {
            this.events.delete(eventName as string);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get the number of listeners for an event
     * @param eventName Name of the event
     * @returns Number of listeners
     */
    public listenerCount(eventName: keyof TimelineEventMap): number {
        const callbacks = this.events.get(eventName as string);
        return callbacks ? callbacks.length : 0;
    }
}