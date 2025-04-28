/**
 * SceneSelector component
 * Provides a dropdown for selecting and managing scenes
 */

import { BaseComponent } from './BaseComponent';
import { EventEmitter } from '../core/EventEmitter';
import { DataModel, IScene } from '../core/DataModel';
import { Events, CssClasses } from '../constants/Constants';
import { IEvent } from '../constants/EventTypes';

export interface ISceneSelectorOptions {
    container: HTMLElement;
    dataModel: DataModel;
    eventEmitter: EventEmitter;
}

export class SceneSelector extends BaseComponent {
    private dataModel: DataModel;
    private eventEmitter: EventEmitter;
    private selectElement: HTMLSelectElement | null = null;
    private addButtonElement: HTMLButtonElement | null = null;
    
    /**
     * Constructor for SceneSelector
     * @param options - Configuration options
     */
    constructor(options: ISceneSelectorOptions) {
        super(options.container, CssClasses.SCENE_SELECTOR);
        
        this.dataModel = options.dataModel;
        this.eventEmitter = options.eventEmitter;
    }
      /**
     * Initialize the SceneSelector component
     */
    public initialize(): void {
        // Set up event listeners for scene changes
        this.eventEmitter.on(Events.SCENE_ADDED, this.handleSceneAdded.bind(this));
        this.eventEmitter.on(Events.SCENE_REMOVED, this.handleSceneRemoved.bind(this));
        this.eventEmitter.on(Events.SCENE_RENAMED, this.handleSceneRenamed.bind(this));
        this.eventEmitter.on(Events.SCENE_SELECTED, this.handleSceneSelected.bind(this));
    }
    
    /**
     * Render the SceneSelector component
     * @returns HTML string representation
     */
    public render(): string {
        return `
            <div class="${CssClasses.SCENE_SELECTOR}">
                <label for="scene-select">Scene:</label>
                <select id="scene-select" class="scene-select">
                    ${this.renderSceneOptions()}
                </select>
                <button class="scene-add-button" title="Add New Scene">+</button>
            </div>
        `;
    }
    
    /**
     * Update the SceneSelector component
     */
    public update(): void {
        if (!this.element) return;
        
        // Get references to DOM elements if they don't exist
        if (!this.selectElement) {
            this.selectElement = this.element.querySelector('.scene-select');
            
            // Add change event listener to select element
            if (this.selectElement) {
                this.selectElement.addEventListener('change', this.handleSceneSelectChange.bind(this));
            }
        }
        
        if (!this.addButtonElement) {
            this.addButtonElement = this.element.querySelector('.scene-add-button');
            
            // Add click event listener to add button
            if (this.addButtonElement) {
                this.addButtonElement.addEventListener('click', this.handleAddSceneClick.bind(this));
            }
        }
        
        // Update the select options
        if (this.selectElement) {
            this.selectElement.innerHTML = this.renderSceneOptions();
            
            // Set the current selection
            const currentSceneId = this.dataModel.getCurrentScene()?.id;
            if (currentSceneId) {
                this.selectElement.value = currentSceneId;
            }
        }
    }
      /**
     * Destroy the SceneSelector component and clean up resources
     */
    public destroy(): void {
        // Remove event listeners
        this.eventEmitter.off(Events.SCENE_ADDED, this.handleSceneAdded.bind(this));
        this.eventEmitter.off(Events.SCENE_REMOVED, this.handleSceneRemoved.bind(this));
        this.eventEmitter.off(Events.SCENE_RENAMED, this.handleSceneRenamed.bind(this));
        this.eventEmitter.off(Events.SCENE_SELECTED, this.handleSceneSelected.bind(this));
        
        // Clean up DOM event listeners
        if (this.selectElement) {
            this.selectElement.removeEventListener('change', this.handleSceneSelectChange.bind(this));
        }
        
        if (this.addButtonElement) {
            this.addButtonElement.removeEventListener('click', this.handleAddSceneClick.bind(this));
        }
    }
    
    /**
     * Render scene options for the select element
     * @returns HTML string of options
     */
    private renderSceneOptions(): string {
        const scenes = this.dataModel.getScenes();
        return Object.values(scenes).map(scene => {
            return `<option value="${scene.id}">${scene.name}</option>`;
        }).join('');
    }
    
    /**
     * Handle scene select change event
     * @param e - Change event
     */
    private handleSceneSelectChange(e: Event): void {
        const select = e.target as HTMLSelectElement;
        const sceneId = select.value;
        
        if (sceneId) {
            this.dataModel.setCurrentScene(sceneId);
        }
    }
    
    /**
     * Handle add scene button click
     */
    private handleAddSceneClick(): void {
        const scenes = this.dataModel.getScenes();
        const sceneNumber = Object.keys(scenes).length + 1;
        const newSceneId = `scene-${sceneNumber}`;
        
        // Create a new scene
        this.dataModel.addScene({
            id: newSceneId,
            name: `Scene ${sceneNumber}`,
            layers: {}
        });
          // Select the new scene
        this.dataModel.setCurrentScene(newSceneId);
    }
    
    /**
     * Handle scene added event
     * @param event - Scene added event
     */
    private handleSceneAdded(event: IEvent<IScene>): void {
        this.update();
    }
    
    /**
     * Handle scene removed event
     * @param event - Scene removed event
     */
    private handleSceneRemoved(event: IEvent<IScene>): void {
        this.update();
    }
    
    /**
     * Handle scene renamed event
     * @param event - Scene renamed event
     */
    private handleSceneRenamed(event: IEvent<{ id: string, name: string }>): void {
        this.update();
    }
    
    /**
     * Handle scene selected event
     * @param event - Scene selected event
     */
    private handleSceneSelected(event: IEvent<{ id: string, name: string, previousSceneId: string | null }>): void {
        this.update();
    }
}
