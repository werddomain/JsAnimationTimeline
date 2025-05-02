# Drag and Drop Layer Reordering - Technical Documentation

## Overview

This document describes the implementation of drag and drop functionality for reordering layers in the animation timeline. The implementation allows users to drag layers up and down in the layer panel using a drag handle, providing an intuitive and visual way to reorganize layers.

## Implementation Details

### Components Involved

1. **LayerPanel** - Handles the main UI and event handling for drag and drop
2. **TracksRenderer** - Synchronized with LayerPanel to update timeline tracks when layers are reordered
3. **StateManager** - Maintains the order of layers in the application state
4. **EventManager** - Facilitates communication between components

### Key Features

- Dedicated drag handle icon
- Visual feedback during drag operations (opacity changes, drop target indicators)
- Automatic synchronization between layer panel and timeline grid
- Proper state updates for maintaining selected layer after reordering

## Events and State Changes

The implementation uses the following events for communication:

| Event | Emitter | Payload | Description |
|-------|---------|---------|-------------|
| `layerReordered` | LayerPanel | Updated layers array | Emitted when layers are reordered via drag and drop or up/down buttons |
| `stateChange` | StateManager | Complete state | Emitted after layer updates to trigger UI refresh |

## Implementation Flow

1. User clicks on a drag handle and starts dragging
2. Visual feedback shows the layer being dragged and potential drop targets
3. On drop, the layer order is updated in the state
4. The `layerReordered` event is emitted
5. The StateManager updates the state and emits `stateChange`
6. Both the LayerPanel and TracksRenderer update to reflect the new order

## Accessibility Considerations

The implementation includes:
- ARIA attributes on all interactive elements
- Keyboard-accessible alternatives (up/down buttons) for users who cannot use drag and drop
- Proper color contrast for visual elements
- Tooltips and screen reader text for all controls

## Edge Cases and Limitations

1. **Drag and drop between separated layers**: The implementation currently only supports dropping directly onto another layer, not in the spaces between layers.

2. **Performance with many layers**: For very large numbers of layers, additional optimizations might be needed to ensure smooth dragging.

3. **Mobile/touch support**: The current implementation uses the standard HTML5 Drag and Drop API, which has limitations on mobile devices. For full mobile support, a touch-specific implementation would be needed.

4. **Folder groups**: If folder grouping of layers is implemented in the future, the drag and drop logic would need to be extended to handle dragging layers in and out of folders.

## Future Enhancements

Potential improvements for future iterations:

1. Add animation for smoother visual transitions when layers are reordered
2. Implement touch-specific handling for mobile devices
3. Add ability to drag multiple selected layers at once
4. Allow dragging between layer groups when folder structure is implemented
