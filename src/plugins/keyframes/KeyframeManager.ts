 
/**
 * Updates to KeyframeManager.ts to support motion tween selection and preview
 */

// Add a property to store selected tween
private selectedTweenId: string | null = null;

// Add event handling for tween clicks in the handleClick method
/**
 * Handle click events
 * @param e Mouse event
 */
private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Check if clicked on a motion tween
    if(target.classList.contains('timeline-motion-tween')) {
    const layerId = target.getAttribute('data-layer-id');
    const tweenId = target.getAttribute('data-tween-id');

    if (layerId && tweenId) {
        this.selectMotionTween(layerId, tweenId);
    }
    return;
}

// Check if clicked on a keyframe
if (target.classList.contains(CSS_CLASSES.KEYFRAME)) {
    const layerId = target.getAttribute('data-layer-id');
    const keyframeId = target.getAttribute('data-keyframe-id');

    if (layerId && keyframeId) {
        const multiSelect = e.ctrlKey || e.metaKey;
        this.options.onKeyframeSelect(layerId, keyframeId, multiSelect);

        // Deselect any selected tween
        this.deselectMotionTween();
    }
}
}

/**
 * Select a motion tween
 */
private selectMotionTween(layerId: string, tweenId: string): void {
    // Find the layer and tween
    const layer = this.layers.find(l => l.id === layerId);
    const tween = layer?.motionTweens.find(t => t.id === tweenId);

    if(!layer || !tween) return;

// Update selected tween
this.selectedTweenId = tweenId;

// Update visual state
this.updateTweenDisplay();

// Emit event
this.eventEmitter.emit('motion:tween:selected', layer, tween);
}

/**
 * Deselect the motion tween
 */
private deselectMotionTween(): void {
    if(!this.selectedTweenId) return;

    // Reset selected tween
    this.selectedTweenId = null;

    // Update visual state
    this.updateTweenDisplay();

    // Emit event
    this.eventEmitter.emit('motion:tween:deselected');
}

/**
 * Update tween display
 */
private updateTweenDisplay(): void {
    // Find all tween elements
    const element = this.getElement();
    if(!element) return;

    const tweenElements = element.querySelectorAll('.timeline-motion-tween');

    // Update classes
    tweenElements.forEach(tweenEl => {
        const tweenId = tweenEl.getAttribute('data-tween-id');
        if (tweenId === this.selectedTweenId) {
            tweenEl.classList.add('selected');
        } else {
            tweenEl.classList.remove('selected');
        }
    });
}

// Enhance renderLayerKeyframes to include tween selection state
/**
 * Render keyframes on canvas
 * @param layer Layer data
 * @param canvas Canvas element
 */
private renderLayerKeyframes(layer: Layer, canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw motion tweens first (as background)
    layer.motionTweens.forEach(tween => {
        const startKeyframe = layer.keyframes.find(k => k.id === tween.startKeyframeId);
        const endKeyframe = layer.keyframes.find(k => k.id === tween.endKeyframeId);

        if (startKeyframe && endKeyframe) {
            const startX = this.timeToPixels(startKeyframe.time);
            const endX = this.timeToPixels(endKeyframe.time);
            const centerY = DIMENSIONS.LAYER_HEIGHT / 2;

            // Draw tween line
            ctx.beginPath();
            ctx.moveTo(startX, centerY);
            ctx.lineTo(endX, centerY);

            // Check if this tween is selected
            if (tween.id === this.selectedTweenId) {
                ctx.strokeStyle = COLORS.KEYFRAME_SELECTED;
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = COLORS.TWEEN_LINE;
                ctx.lineWidth = 2;
            }

            ctx.stroke();

            // Add DOM element for the tween to make it clickable
            const tweenEl = document.createElement('div');
            tweenEl.className = 'timeline-motion-tween' + (tween.id === this.selectedTweenId ? ' selected' : '');
            tweenEl.setAttribute('data-tween-id', tween.id);
            tweenEl.setAttribute('data-layer-id', layer.id);
            tweenEl.style.position = 'absolute';
            tweenEl.style.left = `${startX}px`;
            tweenEl.style.width = `${endX - startX}px`;
            tweenEl.style.top = `${centerY - 5}px`;
            tweenEl.style.height = '10px';

            // Add to DOM
            const layerRow = document.querySelector(`[data-layer-id="${layer.id}"]`);
            if (layerRow) {
                layerRow.appendChild(tweenEl);
            }
        }
    });
}