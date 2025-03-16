//// Example code demonstrating how to use the GroupManager

///**
// * Example of creating a timeline with grouped layers
// */
//function createTimelineWithGroups(containerId: string): TimelineControl {
//    const container = document.getElementById(containerId);
//    if (!container) {
//        throw new Error(`Container element with ID "${containerId}" not found`);
//    }

//    // Create timeline control
//    const timeline = new TimelineControl({
//        container: container as HTMLElement,
//        width: container.clientWidth,
//        height: container.clientHeight
//    });

//    // Create some layers
//    const backgroundLayer = timeline.addLayer({
//        name: 'Background',
//        visible: true,
//        locked: false,
//        color: '#42A5F5',
//        keyframes: [],
//        motionTweens: [],
//        isSelected: false
//    });

//    const characterGroup = timeline.addLayer({
//        name: 'Character',
//        visible: true,
//        locked: false,
//        color: '#FF5252',
//        keyframes: [],
//        motionTweens: [],
//        isSelected: false,
//        isExpanded: true
//    });

//    // Add layers to the character group
//    if (characterGroup) {
//        const bodyLayer = timeline.addLayer({
//            name: 'Body',
//            visible: true,
//            locked: false,
//            color: '#FFAB40',
//            keyframes: [],
//            motionTweens: [],
//            isSelected: false,
//            parentId: characterGroup.id
//        });

//        const headLayer = timeline.addLayer({
//            name: 'Head',
//            visible: true,
//            locked: false,
//            color: '#66BB6A',
//            keyframes: [],
//            motionTweens: [],
//            isSelected: false,
//            parentId: characterGroup.id
//        });

//        const armsGroup = timeline.addLayer({
//            name: 'Arms',
//            visible: true,
//            locked: false,
//            color: '#7E57C2',
//            keyframes: [],
//            motionTweens: [],
//            isSelected: false,
//            isExpanded: true,
//            parentId: characterGroup.id
//        });

//        if (armsGroup) {
//            // Add sub-layers for arms
//            const leftArmLayer = timeline.addLayer({
//                name: 'Left Arm',
//                visible: true,
//                locked: false,
//                color: '#EC407A',
//                keyframes: [],
//                motionTweens: [],
//                isSelected: false,
//                parentId: armsGroup.id
//            });

//            const rightArmLayer = timeline.addLayer({
//                name: 'Right Arm',
//                visible: true,
//                locked: false,
//                color: '#26A69A',
//                keyframes: [],
//                motionTweens: [],
//                isSelected: false,
//                parentId: armsGroup.id
//            });
//        }
//    }

//    const foregroundLayer = timeline.addLayer({
//        name: 'Foreground',
//        visible: true,
//        locked: false,
//        color: '#FFEB3B',
//        keyframes: [],
//        motionTweens: [],
//        isSelected: false
//    });

//    return timeline;
//}

///**
// * Example of programmatically manipulating layer groups
// */
//function manipulateGroups(timeline: TimelineControl): void {
//    // Get the data model
//    const dataModel = timeline.getDataModel();

//    // Find the character group
//    const characterGroup = dataModel.getLayers().find(layer => layer.name === 'Character');
//    if (!characterGroup) return;

//    // Toggle the group's expanded state
//    dataModel.updateLayer(characterGroup.id, { isExpanded: !characterGroup.isExpanded });

//    // Find all layers in the group
//    const childLayers = dataModel.getLayers().filter(layer => layer.parentId === characterGroup.id);

//    // Batch operations on group children
//    childLayers.forEach(layer => {
//        // For example, make all children visible
//        dataModel.updateLayer(layer.id, { visible: true });
//    });

//    // Create a new group
//    const effectsGroup = timeline.addLayer({
//        name: 'Effects',
//        visible: true,
//        locked: false,
//        color: '#42A5F5',
//        keyframes: [],
//        motionTweens: [],
//        isSelected: false,
//        isExpanded: true
//    });

//    // Add some layers to the new group
//    if (effectsGroup) {
//        const blurEffect = timeline.addLayer({
//            name: 'Blur',
//            visible: true,
//            locked: false,
//            color: '#FF5252',
//            keyframes: [],
//            motionTweens: [],
//            isSelected: false,
//            parentId: effectsGroup.id
//        });

//        const glowEffect = timeline.addLayer({
//            name: 'Glow',
//            visible: true,
//            locked: false,
//            color: '#FFEB3B',
//            keyframes: [],
//            motionTweens: [],
//            isSelected: false,
//            parentId: effectsGroup.id
//        });
//    }
//}

///**
// * Example of event handlers for group operations
// */
//function setupGroupEventHandlers(timeline: TimelineControl): void {
//    // Get the event emitter
//    const eventEmitter = timeline.getEventEmitter();

//    // Listen for group toggle events
//    eventEmitter.on('layer:group:toggle', (groupId: string, isExpanded: boolean) => {
//        console.log(`Group ${groupId} ${isExpanded ? 'expanded' : 'collapsed'}`);
//    });

//    // Listen for group creation
//    eventEmitter.on(TimelineConstants.EVENTS.LAYER_ADDED, (layer: Layer) => {
//        // Check if this is a group (has children)
//        const dataModel = timeline.getDataModel();
//        const hasChildren = dataModel.getLayers().some(l => l.parentId === layer.id);

//        if (hasChildren) {
//            console.log(`Group layer created: ${layer.name} (${layer.id})`);
//        }
//    });

//    // Listen for layer being added to a group
//    eventEmitter.on(TimelineConstants.EVENTS.LAYER_UPDATED, (layer: Layer) => {
//        if (layer.parentId) {
//            const parentLayer = dataModel.getLayers().find(l => l.id === layer.parentId);
//            if (parentLayer) {
//                console.log(`Layer ${layer.name} added to group ${parentLayer.name}`);
//            }
//        }
//    });

//    // Listen for group deletion
//    eventEmitter.on(TimelineConstants.EVENTS.LAYER_REMOVED, (layerId: string) => {
//        // Check if any layers that had this as parent need to be updated
//        const orphanedLayers = dataModel.getLayers().filter(layer =>
//            layer.parentId === layerId
//        );

//        if (orphanedLayers.length > 0) {
//            console.log(`Group with ID ${layerId} was deleted, orphaning ${orphanedLayers.length} layers`);
//        }
//    });
//}