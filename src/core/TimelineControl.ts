/* eslint-disable @typescript-eslint/no-inferrable-types */
// src/core/TimelineControl.ts
/**
 * Timeline Control
 * Main control class for the timeline
 */

import { EventEmitter } from './EventEmitter';
import { TimelineDataModel, Layer, Keyframe, MotionTween } from './DataModel';
import { TimelineConstants } from './Constants';
import { TimelineEventMap, TimelineEventListener } from './EventTypes';
import { PluginManager } from './PluginManager';
import { LayerManager } from '../plugins/layers/LayerManager';
import { KeyframeManager } from '../plugins/keyframes/KeyframeManager';
import { MainToolbar } from '../plugins/toolbar/MainToolbar';
import { ObjectToolbar } from '../plugins/toolbar/ObjectToolbar';
import { TimeRuler } from '../plugins/time/TimeRuler';
import { GroupManager } from '../plugins/layers/GroupManager';
import { Components } from './Components';

// Timeline initialization options
export interface TimelineOptions {
    container: HTMLElement;
    width?: number;
    height?: number;
    duration?: number;
    initialLayers?: Layer[];
}

export class TimelineControl {
    private container: HTMLElement;
    private dataModel: TimelineDataModel;
    private eventEmitter: EventEmitter;
    private isPlaying: boolean;
    private animationFrameId: number | null = null;
    private lastFrameTime: number;

    // DOM Elements
    private timelineEl: HTMLElement;
    private layersContainerEl: HTMLElement;
    private keyframesContainerEl: HTMLElement;
    private timeRulerEl: HTMLElement;
    private toolbarEl: HTMLElement;
    private objectToolbarEl: HTMLElement;
    private timeCursorEl: HTMLElement;

    // Component instances
    private layerManager: LayerManager;
    private keyframeManager: KeyframeManager;
    private mainToolbar: MainToolbar;
    private objectToolbar: ObjectToolbar;
    private timeRuler: TimeRuler;
    private groupManager: GroupManager;
    // Plugin manager
    public pluginManager: PluginManager;

    // Dimensions
    private width: number;
    private height: number;
    private layerHeight: number;
    private leftPanelWidth: number;

    private components: Components;

    constructor(options: TimelineOptions) {
        this.lastFrameTime = 0;
        this.isPlaying = false;
        this.layerHeight = TimelineConstants.DIMENSIONS.LAYER_HEIGHT;
        this.leftPanelWidth = TimelineConstants.DIMENSIONS.LEFT_PANEL_WIDTH;
        this.container = options.container;
        this.width = options.width || this.container.clientWidth;
        this.height = options.height || this.container.clientHeight;

        // Initialize the data model
        this.dataModel = new TimelineDataModel();
        if (options.duration) {
            this.dataModel.setDuration(options.duration);
        }

        // Initialize event emitter
        this.eventEmitter = new EventEmitter();

        // Create DOM structure
        this.createDOMStructure();

        // Initialize with provided layers if any
        if (options.initialLayers) {
            this.importLayers(options.initialLayers);
        }

        // Initialize event listeners
        this.initEventListeners();
        /**
         * Render all components
         */
        this.initializeComponents();
    }

    /**
   * Handle deletion of selected objects
   */
    private handleDeleteObject(): void {
        const selectedLayers = this.dataModel.getLayers().filter(l => l.isSelected);
        if (selectedLayers.length === 0) return;

        // Delete each selected layer
        selectedLayers.forEach(layer => {
            this.handleLayerDelete(layer.id);
        });
    }  /**
   * Update the display of layers
   */
    private updateLayerDisplay(): void {
        const layers = this.dataModel.getLayers();
        this.layerManager.update(layers);

        // Update object toolbar button states based on selection
        const hasSelection = layers.some(l => l.isSelected);
        this.objectToolbar.updateButtonState(hasSelection);
    }

    /**
     * Update the display of keyframes
     */
    private updateKeyframeDisplay(): void {
        const layers = this.dataModel.getLayers();
        const timeScale = this.dataModel.getTimeScale();
        this.keyframeManager.update({ layers: layers, timeScale: timeScale });
    }

    ///**
    // * Render all components
    // */
    //private renderAll(): void {
    //    this.timeRuler.update(this.dataModel.getDuration(), this.dataModel.getTimeScale());
    //    this.updateLayerDisplay();
    //    this.updateKeyframeDisplay();
    //    this.updateTimeCursor();
    //}

    ///**
    // * Update the time cursor position
    // */
    //private updateTimeCursor(): void {
    //    const currentTime = this.dataModel.getCurrentTime();
    //    const timeScale = this.dataModel.getTimeScale();
    //    const position = currentTime * timeScale * TimelineConstants.DIMENSIONS.PIXELS_PER_SECOND;

    //    this.timeCursorEl.style.left = `${position}px`;
    //    this.timeRuler.updateTimeCursor(currentTime);
    //}

    ///**
    // * Render the time ruler
    // */
    //private renderTimeRuler(): void {
    //    this.timeRuler.update(this.dataModel.getDuration(), this.dataModel.getTimeScale());
    //}  // Keyframe operation handlers

    /**
     * Handle keyframe selection
     */
    private handleKeyframeSelect(layerId: string, keyframeId: string, multiSelect: boolean): void {
        this.dataModel.selectKeyframe(layerId, keyframeId, multiSelect);
        this.updateKeyframeDisplay();
        this.eventEmitter.emitKeyframeSelected(layerId, keyframeId, multiSelect);
        //this.emit(TimelineConstants.EVENTS.KEYFRAME_SELECTED, layerId, keyframeId, multiSelect);
    }

    /**
     * Handle keyframe movement
     */
    private handleKeyframeMove(layerId: string, keyframeId: string, newTime: number): void {
        const layer = this.dataModel.getLayers().find(l => l.id === layerId);
        if (!layer) return;

        const keyframe = layer.keyframes.find(k => k.id === keyframeId);
        if (!keyframe) return;

        // Check if we need to extend duration
        this.dataModel.extendDurationIfNeeded(newTime);

        // Update keyframe time
        this.dataModel.updateKeyframe(layerId, keyframeId, { time: newTime });
        this.updateKeyframeDisplay();
        this.eventEmitter.emitKeyframeMoved(layerId, keyframeId, newTime);
        //this.emit(TimelineConstants.EVENTS.KEYFRAME_MOVED, layerId, keyframeId, newTime);
    }

    /**
     * Handle keyframe deletion
     */
    private handleKeyframeDelete(layerId: string, keyframeId: string): void {
        // First, check if this keyframe is part of a motion tween
        const layer = this.dataModel.getLayers().find(l => l.id === layerId);
        if (!layer) return;

        // Remove any motion tweens that use this keyframe
        const tweensToRemove = layer.motionTweens.filter(
            t => t.startKeyframeId === keyframeId || t.endKeyframeId === keyframeId
        );

        tweensToRemove.forEach(tween => {
            this.handleMotionTweenDelete(layerId, tween.id);
        });

        // Remove the keyframe
        this.dataModel.removeKeyframe(layerId, keyframeId);
        this.updateKeyframeDisplay();
        this.eventEmitter.emitKeyframeRemoved(layerId, keyframeId);
        //this.emit(TimelineConstants.EVENTS.KEYFRAME_REMOVED, layerId, keyframeId);
    }

    /**
     * Handle user creation of keyframe in the timeline
     */
    private handleKeyframeUserCreate(layerId: string, time: number): void {
        // Check if we need to extend duration
        this.dataModel.extendDurationIfNeeded(time);

        // Create keyframe with empty properties
        const newKeyframe = this.dataModel.addKeyframe(layerId, {
            time,
            properties: {},
            isSelected: false
        });

        if (newKeyframe) {
            this.updateKeyframeDisplay();

            // Select the new keyframe
            this.handleKeyframeSelect(layerId, newKeyframe.id, false);

            // Emit user created event
            this.eventEmitter.emitKeyframeUserCreated(layerId, time);
            //this.emit(TimelineConstants.EVENTS.KEYFRAME_USER_CREATED, layerId, time);

            // Also emit normal keyframe added event
            this.eventEmitter.emitKeyframeAdded(layerId, newKeyframe);
            //this.emit(TimelineConstants.EVENTS.KEYFRAME_ADDED, layerId, newKeyframe);
        }
    }

    /**
     * Handle adding a keyframe from toolbar
     */
    private handleAddKeyframe(): void {
        // Get selected layer
        const selectedLayers = this.dataModel.getLayers().filter(l => l.isSelected);
        if (selectedLayers.length !== 1) return;

        const selectedLayer = selectedLayers[0];
        const currentTime = this.dataModel.getCurrentTime();

        // Check if keyframe already exists at current time
        const existingKeyframe = selectedLayer.keyframes.find(
            k => Math.abs(k.time - currentTime) < 0.01
        );

        if (existingKeyframe) {
            // Select the existing keyframe
            this.handleKeyframeSelect(selectedLayer.id, existingKeyframe.id, false);
        } else {
            // Create a new keyframe
            this.handleKeyframeUserCreate(selectedLayer.id, currentTime);
        }
    }

    /**
     * Handle editing a keyframe
     */
    private handleEditKeyframe(): void {
        // Get selected keyframe(s)
        let selectedKeyframe: Keyframe | null = null;
        let layerId: string | null = null;

        this.dataModel.getLayers().forEach(layer => {
            layer.keyframes.forEach(keyframe => {
                if (keyframe.isSelected) {
                    selectedKeyframe = keyframe;
                    layerId = layer.id;
                }
            });
        });

        if (!selectedKeyframe || !layerId) return;

        // In a real implementation, this would open a keyframe properties dialog
        // For now, we'll just log the keyframe data
        console.log('Edit keyframe:', selectedKeyframe);

        // TODO: Implement a keyframe editor dialog
        // this.openKeyframeEditor(layerId, selectedKeyframe.id);
    }

    /**
     * Handle motion tween creation by user
     */
    private handleMotionTweenUserCreate(layerId: string, startKeyframeId: string, endKeyframeId: string): void {
        // Create the motion tween
        const newTween = this.dataModel.addMotionTween(layerId, {
            startKeyframeId,
            endKeyframeId,
            easingFunction: 'linear',
            properties: {}
        });

        if (newTween) {
            this.updateKeyframeDisplay();

            // Emit user created event
            this.eventEmitter.emitTweenUserCreated(layerId, startKeyframeId, endKeyframeId);
            //this.emit(TimelineConstants.EVENTS.TWEEN_USER_CREATED, layerId, startKeyframeId, endKeyframeId);

            // Also emit normal tween added event
            this.eventEmitter.emitTweenAdded(layerId, newTween);
            //this.emit(TimelineConstants.EVENTS.TWEEN_ADDED, layerId, newTween);
        }
    }

    /**
     * Handle creating a motion tween from toolbar
     */
    private handleCreateMotionTween(): void {
        // Let the keyframe manager handle this since it knows about selected keyframes
        const success = this.keyframeManager.createMotionTween();

        if (!success) {
            console.log('Cannot create motion tween. Select exactly 2 keyframes on the same layer.');
            // TODO: Display error message to user
        }
    }

    /**
     * Handle motion tween deletion
     */
    private handleMotionTweenDelete(layerId: string, tweenId: string): void {
        this.dataModel.removeMotionTween(layerId, tweenId);
        this.updateKeyframeDisplay();
        this.eventEmitter.emitTweenRemoved(layerId, tweenId);
        //this.emit(TimelineConstants.EVENTS.TWEEN_REMOVED, layerId, tweenId);
    }

    /**
     * Handle deleting keyframes from toolbar
     */
    private handleDeleteKeyframe(): void {
        // Let the keyframe manager handle this since it knows about selected keyframes
        const count = this.keyframeManager.deleteSelectedKeyframes();

        if (count === 0) {
            console.log('No keyframes selected for deletion.');
            // TODO: Display message to user
        }
    }  // Layer operation handlers

    /**
     * Handle layer selection
     */
    private handleLayerSelect(layerId: string, multiSelect: boolean): void {
        this.dataModel.selectLayer(layerId, multiSelect);
        this.updateLayerDisplay();
        this.eventEmitter.emitLayerSelected(layerId, multiSelect);
        //this.emit(TimelineConstants.EVENTS.LAYER_SELECTED, layerId, multiSelect);
    }

    /**
     * Handle layer movement (reordering)
     */
    private handleLayerMove(layerId: string, targetIndex: number): void {
        // Get current layers
        const layers = this.dataModel.getLayers();

        // Find current index
        const currentIndex = layers.findIndex(l => l.id === layerId);
        if (currentIndex === -1) return;

        // Create new layer order
        const newLayers = [...layers];
        const [movedLayer] = newLayers.splice(currentIndex, 1);
        newLayers.splice(targetIndex, 0, movedLayer);

        // Set the new order in the data model (by recreating layers)
        newLayers.forEach((layer, index) => {
            this.dataModel.updateLayer(layer.id, { index });
        });

        this.updateLayerDisplay();
        this.eventEmitter.emitLayerMoved(layerId, targetIndex);
        //this.emit(TimelineConstants.EVENTS.LAYER_MOVED, layerId, targetIndex);
    }

    /**
     * Handle layer name change
     */
    private handleLayerNameChange(layerId: string, newName: string): void {
        this.dataModel.updateLayer(layerId, { name: newName });
        this.updateLayerDisplay();
        this.eventEmitter.emitLayerNameChanged(layerId, newName);
        //this.emit(TimelineConstants.EVENTS.LAYER_NAME_CHANGED, layerId, newName);
    }

    /**
     * Handle layer visibility toggle
     */
    private handleLayerVisibilityToggle(layerId: string): void {
        const layer = this.dataModel.getLayers().find(l => l.id === layerId);
        if (!layer) return;

        const newVisibility = !layer.visible;
        this.dataModel.updateLayer(layerId, { visible: newVisibility });
        this.updateLayerDisplay();
        this.eventEmitter.emitLayerVisibilityChanged(layerId, newVisibility);
        //this.emit(TimelineConstants.EVENTS.LAYER_VISIBILITY_CHANGED, layerId, newVisibility);
    }

    /**
     * Handle layer lock toggle
     */
    private handleLayerLockToggle(layerId: string): void {
        const layer = this.dataModel.getLayers().find(l => l.id === layerId);
        if (!layer) return;

        const newLockState = !layer.locked;
        this.dataModel.updateLayer(layerId, { locked: newLockState });
        this.updateLayerDisplay();

        this.eventEmitter.emitLayerLockChanged(layerId, newLockState);
        //this.emit(TimelineConstants.EVENTS.LAYER_LOCK_CHANGED, layerId, newLockState);
    }

    /**
     * Handle layer color change
     */
    private handleLayerColorChange(layerId: string, newColor: string): void {
        this.dataModel.updateLayer(layerId, { color: newColor });
        this.updateLayerDisplay();
        this.eventEmitter.emitLayerColorChanged(layerId, newColor);
        //this.emit(TimelineConstants.EVENTS.LAYER_COLOR_CHANGED, layerId, newColor);
    }

    /**
     * Handle layer deletion
     */
    private handleLayerDelete(layerId: string): void {
        // Check if layer has children and handle them first
        const layer = this.dataModel.getLayers().find(l => l.id === layerId);
        if (!layer) return;

        // If this is a group, we need to handle children
        const childLayers = this.dataModel.getLayers().filter(l => l.parentId === layerId);

        // If we're deleting a group with children, decide what to do with children
        // Option 1: Delete all children
        childLayers.forEach(child => {
            this.handleLayerDelete(child.id);
        });

        // Option 2: Move children up a level (uncomment this and comment out option 1 if preferred)
        // childLayers.forEach(child => {
        //   this.dataModel.updateLayer(child.id, { parentId: layer.parentId });
        // });

        // Delete the layer itself
        this.dataModel.removeLayer(layerId);
        this.updateLayerDisplay();
        this.updateKeyframeDisplay();
        this.eventEmitter.emitLayerRemoved(layerId);
        //this.emit(TimelineConstants.EVENTS.LAYER_REMOVED, layerId);
    }

    /**
     * Handle creation of a new object/layer
     */
    private handleNewObject(): void {
        const layerCount = this.dataModel.getLayers().length;
        const newLayer = this.dataModel.addLayer({
            name: `Layer ${layerCount + 1}`,
            visible: true,
            locked: false,
            color: TimelineConstants.COLORS.LAYER_DEFAULTS[layerCount % TimelineConstants.COLORS.LAYER_DEFAULTS.length],
            keyframes: [],
            motionTweens: [],
            isSelected: false
        });

        this.updateLayerDisplay();
        this.eventEmitter.emitLayerAdded(newLayer);

        //this.emit(TimelineConstants.EVENTS.LAYER_ADDED, newLayer);
    }

    /**
     * Handle creation of a layer group
     */

    private handleCreateGroup(name: string, selectedLayerIds: string[]): void {
        

        // Use the GroupManager to create the group
        this.groupManager.createGroup(name || 'Group', selectedLayerIds);
    }

    //private handleCreateGroup(): void {
    //    // Get selected layers
    //    const selectedLayers = this.dataModel.getLayers().filter(l => l.isSelected);
    //    if (selectedLayers.length === 0) return;

    //    // Create a new group layer
    //    const groupLayer = this.dataModel.addLayer({
    //        name: 'Group',
    //        visible: true,
    //        locked: false,
    //        color: TimelineConstants.COLORS.LAYER_DEFAULTS[0],
    //        keyframes: [],
    //        motionTweens: [],
    //        isSelected: false,
    //        isExpanded: true,
    //        children: []
    //    });

    //    // Move selected layers to be children of the group
    //    selectedLayers.forEach(layer => {
    //        this.dataModel.updateLayer(layer.id, { parentId: groupLayer.id });
    //    });

    //    this.updateLayerDisplay();
    //    this.eventEmitter.emitLayerAdded(groupLayer);
    //    //this.emit(TimelineConstants.EVENTS.LAYER_ADDED, groupLayer);
    //}

 //   /**
 //* Handle creating a group from selected layers
 //*/
 //   private handleCreateGroup(name: string, selectedLayerIds: string[]): void {
 //       // Create a new group layer
 //       const groupLayer = this.dataModel.addLayer({
 //           name: name || 'Group',
 //           visible: true,
 //           locked: false,
 //           color: TimelineConstants.COLORS.LAYER_DEFAULTS[0],
 //           keyframes: [],
 //           motionTweens: [],
 //           isSelected: false,
 //           isExpanded: true
 //       });

 //       // Move selected layers to be children of the group
 //       selectedLayerIds.forEach(layerId => {
 //           this.dataModel.updateLayer(layerId, { parentId: groupLayer.id });
 //       });

 //       this.updateLayerDisplay();
 //       this.eventEmitter.emitLayerAdded(groupLayer);
 //   }

    /**
     * Handle deleting a group
     */
    private handleDeleteGroup(groupId: string, preserveChildren: boolean): void {
        // Get all child layers
        const childLayers = this.dataModel.getLayers().filter(l => l.parentId === groupId);

        if (preserveChildren) {
            // Move children up a level
            const group = this.dataModel.getLayers().find(l => l.id === groupId);
            const parentGroupId = group?.parentId;

            childLayers.forEach(child => {
                this.dataModel.updateLayer(child.id, { parentId: parentGroupId });
            });
        } else {
            // Delete all children
            childLayers.forEach(child => {
                this.handleLayerDelete(child.id);
            });
        }

        // Delete the group itself
        this.handleLayerDelete(groupId);
    }

    /**
     * Handle toggling group expanded/collapsed state
     */
    private handleToggleGroupExpanded(groupId: string): void {
        const layer = this.dataModel.getLayers().find(l => l.id === groupId);
        if (!layer) return;

        // Toggle the expanded state
        this.dataModel.updateLayer(groupId, { isExpanded: !layer.isExpanded });
        this.updateLayerDisplay();
    }

    /**
     * Handle adding a layer to a group
     */
    private handleAddLayerToGroup(layerId: string, groupId: string): void {
        this.dataModel.updateLayer(layerId, { parentId: groupId });
        this.updateLayerDisplay();
    }

    /**
     * Handle removing a layer from its group
     */
    private handleRemoveLayerFromGroup(layerId: string): void {
        this.dataModel.updateLayer(layerId, { parentId: undefined });
        this.updateLayerDisplay();
    }
    /**
   * Initialize all component instances
   */
    private initializeComponents(): void {
        this.pluginManager = new PluginManager(this.container, this.eventEmitter);
        // Initialize MainToolbar
        this.mainToolbar = new MainToolbar({
            container: this.toolbarEl,
            eventEmitter: this.eventEmitter,
            onAddKeyframe: () => this.handleAddKeyframe(),
            onCreateMotionTween: () => this.handleCreateMotionTween(),
            onDeleteKeyframe: () => this.handleDeleteKeyframe(),
            onEditKeyframe: () => this.handleEditKeyframe(),
            onZoomChange: (scale) => this.setTimeScale(scale),
            onPlay: () => this.play(),
            onPause: () => this.pause(),
            onStop: () => this.stop()
        });

        // Initialize ObjectToolbar
        this.objectToolbar = new ObjectToolbar({
            container: this.objectToolbarEl,
            eventEmitter: this.eventEmitter,
            onNewObject: () => this.handleNewObject(),
            onCreateGroup: () => this.createGroup(),
            onDeleteObject: () => this.handleDeleteObject()
        });

        // Initialize TimeRuler
        this.timeRuler = new TimeRuler({
            container: this.timeRulerEl,
            eventEmitter: this.eventEmitter,
            onTimeClick: (time) => this.setCurrentTime(time)
        });

        // Initialize LayerManager
        this.layerManager = new LayerManager({
            container: this.layersContainerEl,
            eventEmitter: this.eventEmitter,
            onLayerSelect: (layerId, multiSelect) => this.handleLayerSelect(layerId, multiSelect),
            onLayerMove: (layerId, targetIndex) => this.handleLayerMove(layerId, targetIndex),
            onLayerNameChange: (layerId, newName) => this.handleLayerNameChange(layerId, newName),
            onLayerVisibilityToggle: (layerId) => this.handleLayerVisibilityToggle(layerId),
            onLayerLockToggle: (layerId) => this.handleLayerLockToggle(layerId),
            onLayerColorChange: (layerId, newColor) => this.handleLayerColorChange(layerId, newColor),
            onLayerDelete: (layerId) => this.handleLayerDelete(layerId)
        });

        // Initialize KeyframeManager
        this.keyframeManager = new KeyframeManager({
            container: this.keyframesContainerEl,
            eventEmitter: this.eventEmitter,
            onKeyframeSelect: (layerId, keyframeId, multiSelect) =>
                this.handleKeyframeSelect(layerId, keyframeId, multiSelect),
            onKeyframeMove: (layerId, keyframeId, newTime) =>
                this.handleKeyframeMove(layerId, keyframeId, newTime),
            onKeyframeAdd: (layerId, time) =>
                this.handleKeyframeUserCreate(layerId, time),
            onKeyframeDelete: (layerId, keyframeId) =>
                this.handleKeyframeDelete(layerId, keyframeId),
            onMotionTweenAdd: (layerId, startKeyframeId, endKeyframeId) =>
                this.handleMotionTweenUserCreate(layerId, startKeyframeId, endKeyframeId),
            onMotionTweenDelete: (layerId, tweenId) =>
                this.handleMotionTweenDelete(layerId, tweenId)
        });
        this.groupManager = new GroupManager(this.layersContainerEl, {
            eventEmitter: this.eventEmitter,
            onCreateGroup: (name, selectedLayerIds) => this.handleCreateGroup(name, selectedLayerIds),
            onDeleteGroup: (groupId, preserveChildren) => this.handleDeleteGroup(groupId, preserveChildren),
            onRenameGroup: (groupId, newName) => this.handleLayerNameChange(groupId, newName),
            onToggleGroupExpanded: (groupId) => this.handleToggleGroupExpanded(groupId),
            onAddLayerToGroup: (layerId, groupId) => this.handleAddLayerToGroup(layerId, groupId),
            onRemoveLayerFromGroup: (layerId) => this.handleRemoveLayerFromGroup(layerId)
        });
        
        this.components = {
            GroupManager: this.groupManager,
            LayerManager: this.layerManager,
            KeyframeManager: this.keyframeManager,
            MainToolbar: this.mainToolbar,
            ObjectToolbar: this.objectToolbar,
            TimeRuler: this.timeRuler,
            PluginManager: this.pluginManager

        };
        this.pluginManager.registerComponents(this, this.components);

        // Initial render of all components
        this.renderAll();
    }
    createGroup(): void {
        // Get selected layers
        const selectedLayers = this.dataModel.getLayers().filter(l => l.isSelected);
        if (selectedLayers.length === 0) return;

        // Extract the IDs of the selected layers
        const selectedLayerIds = selectedLayers.map(layer => layer.id);

        // Use the GroupManager to create the group and move selected layers
        this.groupManager.createGroup('Group', selectedLayerIds);

        // Update the display
        this.updateLayerDisplay();
    }

    // Public API Methods

    /**
     * Get the timeline data model
     * @returns Current data model
     */
    public getDataModel(): TimelineDataModel {
        return this.dataModel;
    }

    /**
     * Add a layer to the timeline
     * @param layer Layer data
     * @returns The created layer
     */
    public addLayer(layer: Omit<Layer, 'id'>): Layer | null {
        const newLayer = this.dataModel.addLayer(layer);
        if (newLayer) {
            this.renderLayers();
            this.eventEmitter.emitLayerAdded(newLayer);
            //this.emit('layer:added', newLayer);
            return newLayer;
        }
        return null;
    }

    /**
     * Add a keyframe to a layer
     * @param layerId Layer ID
     * @param keyframe Keyframe data
     * @returns The created keyframe
     */
    public addKeyframe(layerId: string, keyframe: Omit<Keyframe, 'id'>): Keyframe | null {
        const newKeyframe = this.dataModel.addKeyframe(layerId, keyframe);
        if (newKeyframe) {
            this.renderKeyframes();
            this.eventEmitter.emitKeyframeAdded(layerId, newKeyframe);
            //this.emit('keyframe:added', layerId, newKeyframe);
            return newKeyframe;
        }
        return null;
    }

    /**
     * Add a motion tween between keyframes
     * @param layerId Layer ID
     * @param tween Motion tween data
     * @returns The created motion tween
     */
    public addMotionTween(layerId: string, tween: Omit<MotionTween, 'id'>): MotionTween | null {
        const newTween = this.dataModel.addMotionTween(layerId, tween);
        if (newTween) {
            this.renderKeyframes(); // Rerender to show the tween
            this.eventEmitter.emitTweenAdded(layerId, newTween);
            //this.emit('motiontween:added', layerId, newTween);
            return newTween;
        }
        return null;
    }

    /**
     * Set the current playback time
     * @param time Time in seconds
     * @param extendDuration Whether to automatically extend duration if needed
     */
    public setCurrentTime(time: number, extendDuration: boolean = true): void {
        // Check if we need to extend the timeline duration
        if (extendDuration) {
            const wasExtended = this.dataModel.extendDurationIfNeeded(time);
            if (wasExtended) {
                const newDuration = this.dataModel.getDuration();
                this.renderTimeRuler();
                this.renderKeyframes();
                this.eventEmitter.emitDurationChange(newDuration);
                //this.emit(TimelineConstants.EVENTS.DURATION_CHANGE, newDuration);
            }
        }

        this.dataModel.setCurrentTime(time);
        this.updateTimeCursor(); this.eventEmitter.emitTimeChange(time);
        //this.emit(TimelineConstants.EVENTS.TIME_CHANGE, time);
    }

    /**
     * Go to a specific time
     * @param time Time in seconds to seek to
     */
    public goToTime(time: number): void {
        this.setCurrentTime(time);
    }

    /**
     * Get the current playback time
     * @returns Current time in seconds
     */
    public getCurrentTime(): number {
        return this.dataModel.getCurrentTime();
    }

    /**
     * Get all keyframes at the current time or a specified time
     * @param time Optional time in seconds (defaults to current time)
     * @param tolerance Tolerance window in seconds
     * @returns Array of layer and keyframe pairs
     */
    public getKeyframesAtTime(time?: number, tolerance: number = 0.1): Array<{ layerId: string, keyframe: Keyframe }> {
        const timeToCheck = time !== undefined ? time : this.dataModel.getCurrentTime();
        return this.dataModel.getKeyframesAtTime(timeToCheck, tolerance);
    }

    /**
     * Get all objects with their state at the current time or a specified time
     * @param time Optional time in seconds (defaults to current time)
     * @returns Array of layer objects with interpolated properties
     */
    public getObjectsAtTime(time?: number): Array<{ layer: Layer, properties: Record<string, any> }> {
        const timeToCheck = time !== undefined ? time : this.dataModel.getCurrentTime();
        return this.dataModel.getObjectsAtTime(timeToCheck);
    }

    /**
     * Start playback
     */
    public play(): void {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.playbackLoop.bind(this));
        this.eventEmitter.emitPlay();
        //this.emit('playback:play');
    }

    /**
     * Pause playback
     */
    public pause(): void {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.eventEmitter.emitPause();
        //this.emit('playback:pause');
    }

    /**
     * Stop playback and return to beginning
     */
    public stop(): void {
        this.pause();
        this.setCurrentTime(0);
        this.eventEmitter.emitStop();
        //this.emit('playback:stop');
    }

    /**
     * Export timeline data as JSON
     * @returns JSON string
     */
    public exportData(): string {
        return this.dataModel.toJSON();
    }

    /**
     * Import timeline data from JSON
     * @param json JSON string
     */
    public importData(json: string): void {
        this.dataModel.fromJSON(json);
        this.renderAll();
        this.eventEmitter.emitDataImported();
        //this.emit('data:imported');
    }

    /**
     * Import layers from array
     * @param layers Array of layer objects
     */
    public importLayers(layers: Layer[]): void {
        layers.forEach(layer => {
            this.dataModel.addLayer(layer);
        });
        this.renderAll();
    }

    /**
     * Register an event listener
     * @param eventName Event name
     * @param callback Callback function
     * @returns Unsubscribe function
     */
    public on<T extends keyof TimelineEventMap>(
        eventName: T,
        callback: TimelineEventListener<T>
    ): () => void {
        return this.eventEmitter.on(eventName, callback);
    }

    /**
     * Set the zoom level/time scale
     * @param scale Zoom scale factor
     */
    public setTimeScale(scale: number): void {
        this.dataModel.setTimeScale(scale);
        this.renderTimeRuler();
        this.updateKeyframeDisplay();
        this.updateTimeCursor();
        this.mainToolbar.setZoomLevel(scale);
        this.eventEmitter.emitZoomChanged(scale);
        //this.emit(TimelineConstants.EVENTS.ZOOM_CHANGED, scale);
    }

    /**
     * Resize the timeline
     * @param width New width
     * @param height New height
     */
    public resize(width: number, height: number): void {
        this.width = width;
        this.height = height;

        this.timelineEl.style.width = `${width}px`;
        this.timelineEl.style.height = `${height}px`;

        this.renderAll();
        this.eventEmitter.emitResize(width, height);
        //this.emit(TimelineConstants.EVENTS.RESIZE, width, height);
    }

    // Private methods

    /**
     * Create the initial DOM structure
     */
    private createDOMStructure(): void {
        // Create main timeline container
        this.timelineEl = document.createElement('div');
        this.timelineEl.className = 'timeline-control';
        this.timelineEl.style.width = `${this.width}px`;
        this.timelineEl.style.height = `${this.height}px`;
        this.container.appendChild(this.timelineEl);

        // Create toolbar
        this.toolbarEl = document.createElement('div');
        this.toolbarEl.className = 'timeline-toolbar';
        this.timelineEl.appendChild(this.toolbarEl);

        // Create main content area
        const contentEl = document.createElement('div');
        contentEl.className = 'timeline-content';
        this.timelineEl.appendChild(contentEl);

        // Create time ruler
        this.timeRulerEl = document.createElement('div');
        this.timeRulerEl.className = 'timeline-ruler';
        contentEl.appendChild(this.timeRulerEl);

        // Create content container (for layers and keyframes)
        const contentContainer = document.createElement('div');
        contentContainer.className = 'timeline-content-container';
        contentEl.appendChild(contentContainer);

        // Create layers container (left panel)
        this.layersContainerEl = document.createElement('div');
        this.layersContainerEl.className = 'timeline-layers-container';
        this.layersContainerEl.style.width = `${this.leftPanelWidth}px`;
        contentContainer.appendChild(this.layersContainerEl);

        // Create keyframes container (right panel)
        this.keyframesContainerEl = document.createElement('div');
        this.keyframesContainerEl.className = 'timeline-keyframes-container';
        contentContainer.appendChild(this.keyframesContainerEl);

        // Create object toolbar (at bottom of layers)
        this.objectToolbarEl = document.createElement('div');
        this.objectToolbarEl.className = 'timeline-object-toolbar';
        this.timelineEl.appendChild(this.objectToolbarEl);

        // Create time cursor
        this.timeCursorEl = document.createElement('div');
        this.timeCursorEl.className = 'timeline-cursor';
        this.keyframesContainerEl.appendChild(this.timeCursorEl);

        // Initialize component instances
        this.initializeComponents();
    }

    /**
     * Initialize event listeners
     */
    private initEventListeners(): void {
        // Listen for seek-to-time event from toolbar
        this.eventEmitter.on(TimelineConstants.EVENTS.SEEK_TO_TIME, (time: number) => {
            this.goToTime(time);
        });

        // TODO: Implement additional event listeners for:
        // - Time ruler clicks (seeking)
        // - Layer/keyframe selection
        // - Drag and drop
        // - Toolbar button clicks
    }

    /**
     * Render all components
     */
    private renderAll(): void {
        this.renderToolbar();
        this.renderObjectToolbar();
        this.renderTimeRuler();
        this.renderLayers();
        this.renderKeyframes();
        this.updateTimeCursor();
    }

    /**
     * Render the main toolbar
     */
    private renderToolbar(): void {
        // TODO: Implement toolbar rendering
        this.toolbarEl.innerHTML = `
      <button class="timeline-btn" data-action="add-keyframe">Add Keyframe</button>
      <button class="timeline-btn" data-action="add-tween">Create Motion Tween</button>
      <button class="timeline-btn" data-action="delete-keyframe">Delete Keyframe</button>
      <button class="timeline-btn" data-action="edit-keyframe">Edit Keyframe</button>
      <div class="timeline-zoom-control">
        <label>Zoom:</label>
        <input type="range" min="0.1" max="5" step="0.1" value="${this.dataModel.getTimeScale()}">
      </div>
    `;
    }

    /**
     * Render the object toolbar
     */
    private renderObjectToolbar(): void {
        // TODO: Implement object toolbar rendering
        this.objectToolbarEl.innerHTML = `
      <button class="timeline-btn" data-action="new-object">New Object</button>
      <button class="timeline-btn" data-action="create-group">Create Group</button>
      <button class="timeline-btn" data-action="delete-object">Delete Object</button>
    `;
    }

    /**
     * Render the time ruler
     */
    private renderTimeRuler(): void {
        // TODO: Implement time ruler rendering with proper time scale
        const duration = this.dataModel.getDuration();
        const timeScale = this.dataModel.getTimeScale();
        const rulerWidth = duration * timeScale * 10; // 10px per second at scale 1

        let html = `<div class="timeline-ruler-content" style="width: ${rulerWidth}px;">`;

        // Add time markers
        const interval = this.getTimeRulerInterval();
        for (let time = 0; time <= duration; time += interval) {
            const position = time * timeScale * 10;
            html += `
        <div class="timeline-ruler-mark" style="left: ${position}px;">
          <div class="timeline-ruler-mark-label">${this.formatTime(time)}</div>
        </div>
      `;
        }

        html += '</div>';
        this.timeRulerEl.innerHTML = html;
    }

    /**
     * Render the layer list
     */
    private renderLayers(): void {
        const layers = this.dataModel.getLayers();
        let html = '';

        layers.forEach(layer => {
            const selectedClass = layer.isSelected ? 'selected' : '';
            const visibilityIcon = layer.visible ? 'eye' : 'eye-slash';
            const lockIcon = layer.locked ? 'lock' : 'unlock';

            html += `
        <div class="timeline-layer ${selectedClass}" data-id="${layer.id}">
          <div class="timeline-layer-header">
            <span class="timeline-layer-name">${layer.name}</span>
            <div class="timeline-layer-controls">
              <button class="timeline-layer-btn" data-action="toggle-visibility" title="Toggle Visibility">
                <i class="icon ${visibilityIcon}"></i>
              </button>
              <button class="timeline-layer-btn" data-action="toggle-lock" title="Toggle Lock">
                <i class="icon ${lockIcon}"></i>
              </button>
              <button class="timeline-layer-btn" data-action="edit-name" title="Edit Name">
                <i class="icon edit"></i>
              </button>
              <button class="timeline-layer-btn" data-action="change-color" title="Change Color">
                <span class="color-swatch" style="background-color: ${layer.color};"></span>
              </button>
            </div>
          </div>
        </div>
      `;
        });

        // Add empty state if no layers
        if (layers.length === 0) {
            html = '<div class="timeline-empty-state">No objects. Click "New Object" to add one.</div>';
        }

        this.layersContainerEl.innerHTML = html;
    }

    /**
     * Render keyframes
     */
    private renderKeyframes(): void {
        // TODO: Implement keyframe rendering
        // This is more complex and will involve creating a canvas or SVG
        // for each layer to render keyframes and motion tweens
    }

    /**
     * Update the time cursor position
     */
    private updateTimeCursor(): void {
        const currentTime = this.dataModel.getCurrentTime();
        const timeScale = this.dataModel.getTimeScale();
        const position = currentTime * timeScale * 10; // 10px per second at scale 1

        this.timeCursorEl.style.left = `${position}px`;
    }

    /**
     * Playback animation frame loop
     */
    private playbackLoop(timestamp: number): void {
        if (!this.isPlaying) return;

        const deltaTime = (timestamp - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = timestamp;

        let currentTime = this.dataModel.getCurrentTime() + deltaTime;
        const duration = this.dataModel.getDuration();

        // Check if we're approaching the end of the timeline
        if (currentTime >= duration - 1) {
            // Extend duration by 10 seconds if playing
            const wasExtended = this.dataModel.extendDurationIfNeeded(currentTime, 10);

            if (wasExtended) {
                const newDuration = this.dataModel.getDuration();
                this.renderTimeRuler();
                this.renderKeyframes();
                this.eventEmitter.emitDurationChange(newDuration);
                //this.emit(TimelineConstants.EVENTS.DURATION_CHANGE, newDuration);
            }
        }

        // Loop back to start if reached end and didn't extend
        if (currentTime >= duration) {
            currentTime = 0;
        }

        this.setCurrentTime(currentTime, false); // Don't check extension again
        this.animationFrameId = requestAnimationFrame(this.playbackLoop.bind(this));
    }

    /**
     * Format time as MM:SS.ms
     */
    private formatTime(timeInSeconds: number): string {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        const milliseconds = Math.floor((timeInSeconds % 1) * 100);

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }

    /**
     * Determine appropriate time ruler interval based on zoom level
     */
    private getTimeRulerInterval(): number {
        const timeScale = this.dataModel.getTimeScale();

        if (timeScale <= 0.2) return 60; // 1 minute
        if (timeScale <= 0.5) return 30; // 30 seconds
        if (timeScale <= 1) return 10; // 10 seconds
        if (timeScale <= 2) return 5; // 5 seconds
        if (timeScale <= 4) return 1; // 1 second
        return 0.5; // 500 milliseconds
    }

    ///**
    // * Emit an event
    // */
    //private emit<T extends keyof TimelineEventMap>(
    //    eventName: T,
    //    ...args: Parameters<TimelineEventMap[T]>
    //): void {
    //    this.eventEmitter.emit(eventName, ...args);
    //}
}