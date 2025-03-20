/**
 * Object Toolbar
 * Manages the object manipulation toolbar
 */
import { EventEmitter } from '../../core/EventEmitter';
import { Component } from '../../core/BaseComponent';
export interface ObjectToolbarOptions {
    container: HTMLElement;
    eventEmitter: EventEmitter;
    onNewObject: () => void;
    onCreateGroup: () => void;
    onDeleteObject: () => void;
}
export interface ObjectToolbarData {
    hasSelection: boolean;
}
export declare class ObjectToolbar extends Component {
    private eventEmitter;
    private options;
    private hasSelection;
    constructor(options: ObjectToolbarOptions);
    /**
     * Initialize the toolbar
     */
    private init;
    /**
     * Initialize event listeners
     */
    initialize(): void;
    /**
     * Render the toolbar
     */
    render(): string;
    /**
     * Update the toolbar state
     * @param data The data to update
     */
    update(data: ObjectToolbarData): void;
    /**
     * Handle toolbar button clicks
     * @param e Click event
     */
    private handleClick;
    /**
     * Enable or disable buttons based on selection
     * @param hasSelection Whether any objects are selected
     */
    updateButtonState(hasSelection: boolean): void;
}
