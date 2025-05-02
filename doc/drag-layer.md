# Drag and Drop Layer Reordering Implementation

This document outlines the tasks required to implement drag and drop reordering for the animation timeline layers. The implementation needs to follow the guidelines specified in the ProjectDescription.md document.

## Task List

### Analysis and Preparation Tasks

- [x] Review existing layer reordering implementation in layerPanel.ts
- [x] Review how timeline tracks are synced with layer panel in TracksRenderer.ts
- [x] Identify required DOM elements and event handlers for drag and drop
- [x] Research optimal drag and drop implementation for TypeScript

### Implementation Tasks

#### Layer Panel UI Changes

- [x] Add a drag handle icon to the layer-panel__item elements
- [x] Create CSS styles for the drag handle in layer panel styles 
- [x] Add visual feedback for draggable items (cursor, highlighting)
- [x] Add styles for drag-over states to indicate where the item will be dropped

#### Drag and Drop Core Implementation

- [x] Implement dragstart event handler for layer items
- [x] Implement dragover event handler to allow dropping
- [x] Implement dragenter/dragleave events for visual feedback
- [x] Implement drop event handler to reorder layers
- [x] Store and update the original position during drag operations
- [x] Ensure dragged item has proper ghost image during dragging

#### Layer Reordering Logic

- [x] Update layer reordering logic to work with drag and drop
- [x] Modify layer data structure to reflect new order after drop
- [x] Update data-idx attributes of layer items after reordering (handled automatically by render)
- [x] Emit layerReordered event with updated layers array
- [x] Replace existing up/down button reordering with drag and drop (maintained both for backup)

#### Timeline Grid Synchronization

- [x] Ensure timeline-grid__track-row elements reorder in sync with layer-panel__item elements
- [x] Update track row data attributes to match layer changes
- [x] Maintain active state on the correct layer after reordering

### Testing Tasks

- [x] Test dragging layers up and down in the layer panel
- [x] Verify that track rows update correctly in the timeline grid
- [x] Ensure proper visual feedback during drag operations
- [x] Test interaction with other features (selection, visibility toggle, etc.)
- [x] Verify data consistency after multiple drag operations

### Cleanup and Refinement

- [x] Remove or disable existing up/down buttons if they're no longer needed (kept but made less prominent for accessibility)
- [x] Refactor code for clarity and maintainability
- [x] Add comments explaining the drag and drop implementation
- [x] Optimize performance for smoother drag operations
- [x] Ensure accessibility considerations are addressed

### Documentation

- [x] Update comments in the code to explain the drag and drop implementation
- [x] Document any new events or state changes related to drag and drop
- [x] Note any potential edge cases or limitations of the implementation

### Addons

- [ ] Add animation for smoother visual transitions when layers are reordered
- [ ] Allow dragging between layer groups when folder structure is implemented