# TimelineControl Implementation Plan

1. Replace TimelineControl.ts with the content from TimelineControl.ts.new
2. Add the missing methods that are needed based on the error log:
   - ensureDefaultLayer()
   - addLayer()
   - setupLayersResize()
   - verifyAlignment()
   - verifyDefaultLayer()
3. Update EventTypes.ts to add missing events:
   - TWEEN_CREATED
   - KEYFRAMES_DELETED
4. Fix TimeRuler.ts line 117 null check
5. Fix KeyboardHandler.ts Symbol.iterator issue

## Detailed Implementation Steps

### 1. Replace TimelineControl.ts

Copy the content from TimelineControl.ts.new to TimelineControl.ts.

### 2. Add Missing Methods to TimelineControl.ts

```typescript
/**
 * Ensures that a default layer exists in the timeline
 * @returns The default layer ID
 */
public ensureDefaultLayer(): string {
    return this.verifyDefaultLayer();
}

/**
 * Add a new layer to the timeline
 * @param name - Name of the layer
 * @param options - Additional layer options
 * @returns ID of the new layer
 */
public addLayer(name: string, options: any = {}): string {
    return this.dataModel.addLayer(name, options);
}

/**
 * Setup layer resize functionality
 * Handles resizing of the layers panel
 */
private setupLayersResize(): void {
    // Implementation for layer resize functionality
    // This would handle the resizing of the layers panel
    if (!this.layersContainerEl || !this.keyframesAreaEl) {
        return;
    }
    
    // Add resize handle between layers and keyframes
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'timeline-resize-handle';
    this.contentContainerEl?.appendChild(resizeHandle);
    
    // Handle mouse events for resizing
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = this.layersContainerEl!.offsetWidth;
        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const delta = e.clientX - startX;
        const newWidth = Math.max(100, startWidth + delta); // Minimum width of 100px
        
        this.layersContainerEl!.style.width = `${newWidth}px`;
        this.keyframesAreaEl!.style.left = `${newWidth}px`;
        this.keyframesAreaEl!.style.width = `calc(100% - ${newWidth}px)`;
        
        // Emit resize event
        this.eventEmitter.emit(Events.TIMELINE_RESIZED, {}, this);
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });
}

/**
 * Verify that the layers container and keyframes container are properly aligned
 */
private verifyAlignment(): void {
    if (!this.layersContainerEl || !this.keyframesContainerEl) {
        return;
    }
    
    // Ensure the heights match for proper scrolling alignment
    const layersHeight = this.layersContainerEl.scrollHeight;
    const keyframesHeight = this.keyframesContainerEl.scrollHeight;
    
    if (layersHeight !== keyframesHeight) {
        // Adjust the container with the smaller height to match the larger one
        const maxHeight = Math.max(layersHeight, keyframesHeight);
        
        if (layersHeight < maxHeight) {
            const spacer = document.createElement('div');
            spacer.style.height = `${maxHeight - layersHeight}px`;
            spacer.className = 'timeline-height-spacer';
            this.layersContainerEl.appendChild(spacer);
        }
        
        if (keyframesHeight < maxHeight) {
            const spacer = document.createElement('div');
            spacer.style.height = `${maxHeight - keyframesHeight}px`;
            spacer.className = 'timeline-height-spacer';
            this.keyframesContainerEl.appendChild(spacer);
        }
    }
}

/**
 * Verify that at least one default layer exists in the timeline
 * @returns ID of the default layer
 */
private verifyDefaultLayer(): string {
    const layers = this.dataModel.getLayers();
    
    // If no layers exist, create a default one
    if (layers.length === 0) {
        return this.dataModel.addLayer('Layer 1', { isDefault: true });
    }
    
    // Check if there's already a default layer
    const defaultLayer = layers.find(layer => layer.isDefault);
    if (defaultLayer) {
        return defaultLayer.id;
    }
    
    // Otherwise, make the first layer the default
    this.dataModel.updateLayer(layers[0].id, { isDefault: true });
    return layers[0].id;
}
```

### 3. Update EventTypes.ts to Add Missing Events

Add to the Events constant:
```typescript
// Add missing event types
TWEEN_CREATED: 'tween:created',
KEYFRAMES_DELETED: 'keyframes:deleted',
```

### 4. Fix TimeRuler.ts line 117 null check

Original (with potential null error):
```typescript
if (this.playheadEl) {
    this.rulerContentEl.insertBefore(tempContainer.firstChild, this.playheadEl);
} else {
    this.rulerContentEl.appendChild(tempContainer.firstChild);
}
```

Fixed version with proper null check:
```typescript
if (this.playheadEl && tempContainer.firstChild) {
    this.rulerContentEl.insertBefore(tempContainer.firstChild, this.playheadEl);
} else if (tempContainer.firstChild) {
    this.rulerContentEl.appendChild(tempContainer.firstChild);
}
```

### 5. Fix KeyboardHandler.ts Symbol.iterator Issue

For Record<string, IKeyframe>, add the following helper method:

```typescript
// Helper method to make Record<string, IKeyframe> iterable
private getIterableKeyframes(keyframesRecord: Record<string, IKeyframe>): IKeyframe[] {
    return Object.values(keyframesRecord);
}
```

Then replace instances where we try to iterate over the Record directly with:
```typescript
for (const keyframe of this.getIterableKeyframes(keyframes)) {
    // Logic here
}
```
