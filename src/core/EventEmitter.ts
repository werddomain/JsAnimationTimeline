/**
 * EventEmitter class
 * Strongly-typed event system for communication between components
 */

import { IEvent, EventHandler } from '../constants/EventTypes';

export class EventEmitter {
    private eventListeners: Map<string, Set<EventHandler<any>>> = new Map();
    
    /**
     * Register an event handler for a specific event type
     * @param eventType - Type of event to listen for
     * @param handler - Function to handle the event
     * @returns The EventEmitter instance for chaining
     */
    public on<T extends IEvent>(eventType: string, handler: EventHandler<T>): EventEmitter {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        
        // Auto-bind the handler to its original context if it's a method
        const boundHandler = handler.bind(handler.prototype);
        
        this.eventListeners.get(eventType)!.add(boundHandler);
        return this;
    }
    
    /**
     * Unregister an event handler for a specific event type
     * @param eventType - Type of event to stop listening for
     * @param handler - Function that was handling the event
     * @returns The EventEmitter instance for chaining
     */
    public off<T extends IEvent>(eventType: string, handler: EventHandler<T>): EventEmitter {
        const handlers = this.eventListeners.get(eventType);
        
        if (handlers) {
            handlers.delete(handler);
            
            if (handlers.size === 0) {
                this.eventListeners.delete(eventType);
            }
        }
        
        return this;
    }
    
    /**
     * Emit an event to all registered handlers
     * @param eventType - Type of event to emit
     * @param data - Data to send with the event
     * @param sender - The object that emitted the event
     * @returns The EventEmitter instance for chaining
     */
    public emit<T extends IEvent>(eventType: string, data: any, sender: any = this): EventEmitter {
        const handlers = this.eventListeners.get(eventType);
        
        if (handlers) {
            const event: IEvent = {
                type: eventType,
                data,
                sender
            };
            
            // Use Array.from to avoid issues if handlers are modified during iteration
            Array.from(handlers).forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    console.error(`Error in event handler for ${eventType}:`, error);
                }
            });
        }
        
        return this;
    }
    
    /**
     * Check if the emitter has any handlers for a specific event type
     * @param eventType - Type of event to check
     * @returns True if there are handlers, false otherwise
     */
    public hasListeners(eventType: string): boolean {
        const handlers = this.eventListeners.get(eventType);
        return !!handlers && handlers.size > 0;
    }
    
    /**
     * Get the count of handlers for a specific event type
     * @param eventType - Type of event to count handlers for
     * @returns The number of handlers
     */
    public listenerCount(eventType: string): number {
        const handlers = this.eventListeners.get(eventType);
        return handlers ? handlers.size : 0;
    }
    
    /**
     * Clear all event handlers for all event types
     * @returns The EventEmitter instance for chaining
     */
    public clear(): EventEmitter {
        this.eventListeners.clear();
        return this;
    }
}
