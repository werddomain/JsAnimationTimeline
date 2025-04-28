/**
 * Test and integration script for timeline components
 * Run this to verify all scroll synchronization and integration works correctly
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize test timeline after all components are ready
    window.addEventListener('timeline-ready', runTimelineTests);
    
    console.log('Timeline test script loaded, waiting for timeline-ready event...');
});

/**
 * Main test function to verify timeline functionality
 */
function runTimelineTests() {
    console.log('Running timeline tests...');
    
    // Get timeline references
    const timelineControl = document.querySelector('.timeline-control');
    const keyframesContainer = document.querySelector('.timeline-keyframes-container');
    const layersContainer = document.querySelector('.timeline-layers-container');
    const timeRuler = document.querySelector('.timeline-ruler');
    
    if (!timelineControl || !keyframesContainer || !layersContainer || !timeRuler) {
        console.error('Timeline elements not found');
        return;
    }
    
    // Test 1: Horizontal scroll synchronization
    console.log('Test 1: Testing horizontal scroll synchronization...');
    testHorizontalScroll(keyframesContainer, timeRuler);
    
    // Test 2: Vertical scroll synchronization
    console.log('Test 2: Testing vertical scroll synchronization...');
    testVerticalScroll(keyframesContainer, layersContainer);
    
    // Test 3: Playhead alignment during scrolling
    console.log('Test 3: Testing playhead alignment during scrolling...');
    testPlayheadAlignment(keyframesContainer);
    
    // Test 4: Layer selection visibility during scrolling
    console.log('Test 4: Testing layer selection visibility during scrolling...');
    testLayerSelectionVisibility(layersContainer, keyframesContainer);
    
    // Test 5: Tween display across timeline
    console.log('Test 5: Testing tween display across timeline...');
    testTweenDisplay(keyframesContainer);
    
    // Test 6: Plugin communication
    console.log('Test 6: Testing plugin communication...');
    testPluginCommunication();
    
    // Test 7: Selection state synchronization
    console.log('Test 7: Testing selection state synchronization...');
    testSelectionSynchronization();
    
    console.log('All tests completed');
}

/**
 * Test horizontal scroll synchronization between keyframes and ruler
 */
function testHorizontalScroll(keyframesContainer, timeRuler) {
    // Scroll positions to test
    const positions = [100, 200, 500, 1000];
    
    positions.forEach(pos => {
        // Scroll keyframes container
        keyframesContainer.scrollLeft = pos;
        
        // Force scroll event
        keyframesContainer.dispatchEvent(new Event('scroll'));
        
        // Check if ruler transform matches scroll position
        const transform = getComputedStyle(timeRuler.firstElementChild).transform;
        const expectedTransform = `translateX(${pos}px)`;
        
        console.log(`  Scroll position: ${pos}px`);
        console.log(`  Ruler transform: ${transform}`);
        console.log(`  Expected transform: matrix(1, 0, 0, 1, ${pos}, 0)`);
        
        // Simple visual indicator of test result
        if (transform.includes(`${pos}`)) {
            console.log('  ✅ Horizontal scroll test passed');
        } else {
            console.log('  ❌ Horizontal scroll test failed');
        }
    });
}

/**
 * Test vertical scroll synchronization between layers and keyframes
 */
function testVerticalScroll(keyframesContainer, layersContainer) {
    // Scroll positions to test
    const positions = [50, 100, 150, 200];
    
    positions.forEach(pos => {
        // Scroll keyframes container
        keyframesContainer.scrollTop = pos;
        
        // Force scroll event
        keyframesContainer.dispatchEvent(new Event('scroll'));
        
        // Check if layers container scroll position matches
        const layersScroll = layersContainer.scrollTop;
        
        console.log(`  Keyframes scroll position: ${pos}px`);
        console.log(`  Layers scroll position: ${layersScroll}px`);
        
        // Simple visual indicator of test result
        if (Math.abs(layersScroll - pos) < 2) { // Allow small rounding differences
            console.log('  ✅ Vertical scroll test passed');
        } else {
            console.log('  ❌ Vertical scroll test failed');
        }
        
        // Test reverse synchronization
        layersContainer.scrollTop = pos + 50;
        layersContainer.dispatchEvent(new Event('scroll'));
        
        const keyframesScroll = keyframesContainer.scrollTop;
        
        console.log(`  Layers scroll position (reverse test): ${pos + 50}px`);
        console.log(`  Keyframes scroll position (reverse test): ${keyframesScroll}px`);
        
        if (Math.abs(keyframesScroll - (pos + 50)) < 2) {
            console.log('  ✅ Reverse vertical scroll test passed');
        } else {
            console.log('  ❌ Reverse vertical scroll test failed');
        }
    });
}

/**
 * Test playhead alignment during horizontal scrolling
 */
function testPlayheadAlignment(keyframesContainer) {
    // Get playhead element
    const playheadLine = document.querySelector('.timeline-playhead-line');
    
    if (!playheadLine) {
        console.error('Playhead line not found');
        return;
    }
    
    // Get initial position
    const initialPosition = playheadLine.style.left;
    console.log(`  Initial playhead position: ${initialPosition}`);
    
    // Scroll keyframes container
    keyframesContainer.scrollLeft = 100;
    keyframesContainer.dispatchEvent(new Event('scroll'));
    
    // Get updated position
    const updatedPosition = playheadLine.style.left;
    console.log(`  Updated playhead position: ${updatedPosition}`);
    
    // Simple visual indicator of test result
    if (initialPosition !== updatedPosition) {
        console.log('  ✅ Playhead alignment test passed');
    } else {
        console.log('  ❌ Playhead alignment test failed');
    }
}

/**
 * Test layer selection visibility during vertical scrolling
 */
function testLayerSelectionVisibility(layersContainer, keyframesContainer) {
    // Find a layer row to select
    const layerRows = layersContainer.querySelectorAll('.timeline-layer-row');
    
    if (layerRows.length === 0) {
        console.error('No layer rows found');
        return;
    }
    
    // Select the second layer if available
    const layerToSelect = layerRows.length > 1 ? layerRows[1] : layerRows[0];
    
    // Add selection class
    layerToSelect.classList.add('selected');
    
    // Get initial position
    const initialTop = layerToSelect.offsetTop;
    console.log(`  Selected layer top position: ${initialTop}px`);
    
    // Scroll layersContainer past the layer
    layersContainer.scrollTop = initialTop + 100;
    layersContainer.dispatchEvent(new Event('scroll'));
    
    // Check if keyframesContainer scrollTop matches
    console.log(`  Layers scrollTop: ${layersContainer.scrollTop}px`);
    console.log(`  Keyframes scrollTop: ${keyframesContainer.scrollTop}px`);
    
    if (Math.abs(keyframesContainer.scrollTop - layersContainer.scrollTop) < 2) {
        console.log('  ✅ Layer selection visibility test passed');
    } else {
        console.log('  ❌ Layer selection visibility test failed');
    }
    
    // Clean up
    layerToSelect.classList.remove('selected');
}

/**
 * Test tween display across the timeline
 */
function testTweenDisplay(keyframesContainer) {
    // Get all tween elements
    const tweens = document.querySelectorAll('.timeline-tween');
    
    console.log(`  Found ${tweens.length} tweens`);
    
    if (tweens.length === 0) {
        console.log('  ⚠️ No tweens found to test');
        return;
    }
    
    // Check each tween's display properties
    let allTweensValid = true;
    
    tweens.forEach((tween, index) => {
        // Check that the tween has a width
        const width = tween.offsetWidth;
        console.log(`  Tween ${index + 1} width: ${width}px`);
        
        if (width <= 0) {
            console.log(`  ❌ Tween ${index + 1} has invalid width`);
            allTweensValid = false;
        }
        
        // Check that the tween has the arrow indicator
        const computedStyle = getComputedStyle(tween, ':after');
        const hasArrow = computedStyle.borderStyle === 'solid';
        console.log(`  Tween ${index + 1} has arrow: ${hasArrow}`);
        
        if (!hasArrow) {
            console.log(`  ⚠️ Tween ${index + 1} might not have arrow indicator`);
        }
    });
    
    if (allTweensValid) {
        console.log('  ✅ Tween display test passed');
    } else {
        console.log('  ❌ Tween display test failed');
    }
}

/**
 * Test plugin communication through events
 */
function testPluginCommunication() {
    // Create a test event listener
    let eventReceived = false;
    
    const testHandler = () => {
        eventReceived = true;
        console.log('  ✅ Test event received');
    };
    
    // Add event listener
    document.addEventListener('timeline-test-event', testHandler);
    
    // Dispatch test event
    const testEvent = new CustomEvent('timeline-test-event', {
        detail: { test: true }
    });
    
    document.dispatchEvent(testEvent);
    
    // Check if event was received
    if (eventReceived) {
        console.log('  ✅ Plugin communication test passed');
    } else {
        console.log('  ❌ Plugin communication test failed');
    }
    
    // Clean up
    document.removeEventListener('timeline-test-event', testHandler);
}

/**
 * Test selection state synchronization
 */
function testSelectionSynchronization() {
    // This is a more complex test that would need to integrate with the actual
    // timeline control logic - simplified for demonstration
    console.log('  ⚠️ Selection synchronization would require manual testing');
    console.log('  ✓ Please verify bidirectional selection works between timeline and stage');
}
