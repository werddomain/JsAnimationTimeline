import { EventHandler, EventMap } from '@utils/EventTypes';

/**
 * Strongly-typed event emitter for inter-component communication
 */
export class EventEmitter {
    private static instance: EventEmitter;
    private listeners: Map<string, Map<Function, { handler: Function, context: any }>> = new Map();

    /**
     * Get the singleton instance of EventEmitter
     * @returns The EventEmitter instance
     */
    public static getInstance(): EventEmitter {
        if (!EventEmitter.instance) {
            EventEmitter.instance = new EventEmitter();
        }
        return EventEmitter.instance;
    }

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {}

    /**
     * Register an event listener
     * @param eventName The name of the event to listen for
     * @param handler The handler function to call when the event is emitted
     * @param context The context (this) to use when calling the handler
     * @returns A function that can be called to remove the event listener
     */
    public on<K extends keyof EventMap>(
        eventName: K,
        handler: EventHandler<EventMap[K]>,
        context: any
    ): () => void {
        // If this is a new event name, create a new map for it
        if (!this.listeners.has(eventName as string)) {
            this.listeners.set(eventName as string, new Map());
        }

        // First remove any existing handler to prevent duplicates
        this.off(eventName, handler);

        // Get the map of handlers for this event
        const handlersMap = this.listeners.get(eventName as string)!;
        
        // Store the handler with its context
        const boundHandler = handler.bind(context);
        handlersMap.set(handler, { handler: boundHandler, context });

        // Return a function that can be called to remove this listener
        return () => this.off(eventName, handler);
    }

    /**
     * Remove an event listener
     * @param eventName The name of the event to stop listening for
     * @param handler The handler function to remove
     */
    public off<K extends keyof EventMap>(
        eventName: K,
        handler: EventHandler<EventMap[K]>
    ): void {
        const handlersMap = this.listeners.get(eventName as string);
        if (handlersMap) {
            handlersMap.delete(handler);
        }
    }

    /**
     * Emit an event
     * @param eventName The name of the event to emit
     * @param sender The object that is emitting the event
     * @param data The data to pass to the event handlers
     */
    public emit<K extends keyof EventMap>(
        eventName: K,
        sender: any,
        data: EventMap[K]
    ): void {
        const handlersMap = this.listeners.get(eventName as string);
        if (handlersMap) {
            // Call each handler with the sender and data
            handlersMap.forEach(({ handler }) => {
                handler(sender, data);
            });
        }
    }

    /**
     * Remove all event listeners
     */
    public clearAll(): void {
        this.listeners.clear();
    }

    /**
     * Remove all listeners for a specific event
     * @param eventName The name of the event to clear listeners for
     */
    public clearEvent<K extends keyof EventMap>(eventName: K): void {
        this.listeners.delete(eventName as string);
    }
}
