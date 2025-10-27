# **Complete Implementation Tasks for JsTimeLine Control**

This document outlines all remaining tasks to fully implement the Flash MX-style timeline control as specified in the technical specification, while strictly adhering to the project development guidelines.

---

## **📋 CRITICAL INSTRUCTIONS FOR GITHUB COPILOT**

**TASK LIST MAINTENANCE RULES:**

1. **ALWAYS update task checkboxes** when completing a task:
   - Change `- [ ]` to `- [x]` when a task is completed
   - Mark the task as completed in the "✅ Task Completed" line with date and description

2. **AFTER completing ANY task in this document:**
   - Find the corresponding checkbox for that task
   - Update it from `- [ ]` to `- [x]`
   - Update the completion note at the bottom of that task section
   - Keep this task list synchronized with actual implementation progress

3. **Project Guidelines Compliance:**
   - All styling MUST be in LESS files (never in TypeScript)
   - Use the Context architecture pattern exclusively
   - Maintain strict type safety (no `any` types)
   - Follow proper naming conventions (PascalCase for classes, camelCase for methods)
   - Use LESS nesting within `.JsTimeLine` root class

4. **Before starting any new task:**
   - Check dependencies are completed (marked with `- [x]`)
   - Read the entire task description and acceptance criteria
   - Understand the architectural implications

---

## **Phase 11: Synchronized Scrolling Implementation**

### **Task 11.1: Implement Scroll Synchronization Logic**

**Priority:** HIGH  
**Dependencies:** Phase 7, 8, 9, 10 completed

**Prompt:**
"Copilot, implement synchronized scrolling between the timeline grid, ruler, and layer panel.

1. In `src/JsTimeLine.ts`, after initializing the UI components, add a scroll event listener to `this._context.UI.gridContainer`.
2. In the scroll handler:
   - Get `scrollTop` and `scrollLeft` from the event target
   - Update `this._context.UI.layerPanelContent.style.transform = `translateY(-${scrollTop}px)``
   - Update `this._context.UI.rulerContent.style.transform = `translateX(-${scrollLeft}px)``
3. Test by adding temporary sizing to the grid content to enable scrolling."

**Acceptance Criteria:**
- Horizontal scroll of grid moves the ruler in sync
- Vertical scroll of grid moves the layer panel in sync
- Ruler and layer panel do NOT show their own scrollbars
- Performance is smooth with no lag

✅ **Task Completed:** 2025-10-26 - Scroll synchronization implemented in JsTimeLine.ts with transform-based updates

---

## **Phase 12: Timeline Grid Rendering**

### **Task 12.1: Create TimelineGrid UI Class**

**Priority:** HIGH  
**Dependencies:** Phase 8 (Data model) completed

**Prompt:**
"Copilot, create `src/ui/TimelineGrid.ts` to render the main timeline grid.

1. Create a `TimelineGrid` class that takes `IJsTimeLineContext` in constructor.
2. Implement a `render()` method that:
   - Gets data from `this.context.Data.getData()`
   - Gets `frameWidth` and `rowHeight` from settings
   - Sets the content dimensions: `width = totalFrames * frameWidth`, `height = layers.length * rowHeight`
   - Clears and rebuilds the grid content
3. For now, render empty placeholder rows for each layer to establish sizing."

**Acceptance Criteria:**
- Grid content has proper width and height
- Scrolling is enabled
- Each layer has a corresponding row in the grid

✅ **Task Completed:** 2025-10-26 - TimelineGrid.ts created with full rendering logic for all layer types

### **Task 12.2: Implement Frame Rendering Logic**

**Priority:** HIGH  
**Dependencies:** Task 12.1 completed

**Prompt:**
"Copilot, implement the visual rendering of frames, keyframes, and tweens in `TimelineGrid.ts`.

Based on spec Section 1.4, implement rendering for each layer:
1. Iterate through all frames (1 to totalFrames)
2. For each frame, determine its type by analyzing keyframes and tweens:
   - **Empty frame**: No keyframe exists yet → white/light gray rectangle
   - **Keyframe (content)**: Found in `layer.keyframes` with `isEmpty: false` → solid circle
   - **Keyframe (empty)**: Found in `layer.keyframes` with `isEmpty: true` → hollow circle
   - **Standard frame**: Between keyframes, content persists → gray fill
   - **Tween sequence**: Between two keyframes with a tween definition → blue background with arrow
3. Create DOM elements with appropriate classes:
   - `.grid-frame` for empty frames
   - `.grid-keyframe` for solid keyframes
   - `.grid-keyframe-empty` for empty keyframes
   - `.grid-frame-standard` for standard frames
   - `.grid-tween` for tween sequences
4. Position each element absolutely using `left` and `top` CSS properties."

**Acceptance Criteria:**
- All frame types render with correct visual appearance
- Keyframes show circles (solid or hollow)
- Tween sequences show blue background with arrow
- Standard frames show gray fill after keyframes
- Rendering is contextual (frame N depends on frame N-1)

✅ **Task Completed:** 2025-10-26 - Frame rendering logic implemented with contextual frame type detection

### **Task 12.3: Style Timeline Grid Elements**

**Priority:** HIGH  
**Dependencies:** Task 12.2 completed

**Prompt:**
"Copilot, add comprehensive styles for the timeline grid in `src/styles/JsTimeLine.less`.

Add styles for:
1. `.timeline-grid-content` - relative positioning for absolute children
2. `.grid-row` - container for each layer's frames
3. `.grid-frame` - empty frames (light gray, subtle border)
4. `.grid-frame-standard` - standard frames (gray fill)
5. `.grid-keyframe` - keyframe with solid circle (use ::before for circle)
6. `.grid-keyframe-empty` - keyframe with hollow circle
7. `.grid-tween` - tween sequence (light blue background, arrow using ::after)

Use LESS nesting within `.JsTimeLine` and follow the visual specifications from Section 1.4."

**Acceptance Criteria:**
- All frame types have distinct, recognizable appearance
- Colors match Flash MX style (grays, blues)
- Circles and arrows render correctly using pseudo-elements
- Borders are subtle but visible
- Hover states provide visual feedback

✅ **Task Completed:** 2025-10-26 - Comprehensive grid styles added to JsTimeLine.less with pseudo-elements

### **Task 12.4: Integrate TimelineGrid with Main Control**

**Priority:** HIGH  
**Dependencies:** Tasks 12.1, 12.2, 12.3 completed

**Prompt:**
"Copilot, integrate the `TimelineGrid` component into `src/JsTimeLine.ts`.

1. Import `TimelineGrid` from `./ui/TimelineGrid`
2. In `initializeContext()`, instantiate `new TimelineGrid(this._context)`
3. Store it in `this._context.UI.timelineGrid`
4. In `loadTestData()`, after rendering layer panel and ruler, call `this._context.UI.timelineGrid.render()`"

**Acceptance Criteria:**
- Timeline grid renders on initialization
- Grid shows all layers with their keyframes and tweens
- Grid is synchronized with layer panel (same row heights)
- Grid is synchronized with ruler (same frame widths)

✅ **Task Completed:** 2025-10-26 - TimelineGrid integrated into JsTimeLine.ts and rendering correctly

---

## **Phase 13: Playhead and Playback Engine**

### **Task 13.1: Implement Playhead Visual Updates**

**Priority:** MEDIUM  
**Dependencies:** Phase 12 completed

**Prompt:**
"Copilot, enhance the playhead to span across all layers.

1. Update `src/styles/JsTimeLine.less` for `.timeline-playhead`:
   - Change positioning to extend through the entire grid height
   - Add a triangular indicator at the top (::before pseudo-element)
   - Ensure z-index keeps it above all grid content
2. In `TimeRuler.ts`, modify `setPlayheadPosition()` to also update playhead height based on total layers."

**Acceptance Criteria:**
- Playhead extends from ruler through all layers
- Red line is visible across entire vertical span
- Triangle indicator is at the top in the ruler
- Playhead is always on top (z-index)

✅ **Task Completed:** 2025-10-26 - Playhead repositioned to grid container, spans full height with triangle indicator

### **Task 13.2: Create Playback Engine**

**Priority:** MEDIUM  
**Dependencies:** Task 13.1 completed

**Prompt:**
"Copilot, create `src/core/PlaybackEngine.ts` to manage timeline playback.

1. Create a `PlaybackEngine` class with:
   - Constructor taking `IJsTimeLineContext`
   - Private properties: `currentFrame`, `isPlaying`, `animationFrameId`
   - Methods: `play()`, `pause()`, `stop()`, `goToFrame(frame)`
2. Implement `play()`:
   - Use `requestAnimationFrame` for smooth animation
   - Calculate frame timing based on FPS from settings
   - Update currentFrame and call `TimeRuler.setPlayheadPosition()`
   - Emit `onFrameEnter` event via EventManager
   - Loop back to frame 1 when reaching totalFrames
3. Implement `pause()`: Cancel animation frame and set isPlaying to false
4. Implement `stop()`: Pause and reset to frame 1
5. Implement `goToFrame()`: Jump to specific frame and update playhead"

**Acceptance Criteria:**
- Play advances playhead at correct FPS
- Pause stops playhead immediately
- Stop resets to frame 1
- goToFrame works accurately
- Events are emitted on each frame change

✅ **Task Completed:** 2025-10-26 - PlaybackEngine.ts created with play/pause/stop/goToFrame methods and frame-accurate timing

### **Task 13.3: Add Playback Controls UI**

**Priority:** MEDIUM  
**Dependencies:** Task 13.2 completed

**Prompt:**
"Copilot, add playback control buttons to the timeline.

1. Update `src/JsTimeLine.ts` `buildLayout()` to add a control bar:
   - Create `.timeline-controls` div in the corner area
   - Add buttons: Play/Pause (toggle), Stop, Frame info display
2. Wire up button click handlers to call PlaybackEngine methods
3. Update button states (play/pause icon) based on playback state
4. Display current frame number and elapsed time
5. Style controls in `JsTimeLine.less` to match Flash MX aesthetic"

**Acceptance Criteria:**
- Play button starts playback, changes to pause icon
- Pause button stops playback, changes to play icon
- Stop button resets to frame 1
- Current frame display updates during playback
- Controls are styled consistently

✅ **Task Completed:** 2025-10-26 - Playback controls added to corner with Play/Pause/Stop buttons and frame display

### **Task 13.4: Implement Scrubbing (Drag Playhead)**

**Priority:** MEDIUM  
**Dependencies:** Task 13.1 completed

**Prompt:**
"Copilot, make the playhead draggable for scrubbing.

1. In `TimeRuler.ts`, add mouse event handlers to `.timeline-ruler`:
   - `mousedown`: Start dragging, record initial position
   - `mousemove`: If dragging, calculate frame from mouse X position
   - `mouseup`: Stop dragging
2. While dragging:
   - Update playhead position in real-time
   - Emit `onTimeSeek` event with current frame
   - If PlaybackEngine exists, update its currentFrame
3. Ensure cursor changes to indicate draggable state
4. Add touch event handlers for mobile support"

**Acceptance Criteria:**
- Click and drag on ruler moves playhead
- Playhead follows mouse during drag
- Frame updates in real-time during scrubbing
- onTimeSeek events are emitted
- Works on touch devices

✅ **Task Completed:** 2025-10-26 - Playhead dragging implemented in TimeRuler.ts with mouse handlers and ruler click-to-jump

---

## **Phase 14: Layer Management Operations**

### **Task 14.1: Implement Add/Delete Layer Operations**

**Priority:** HIGH  
**Dependencies:** Phase 8, 9 completed

**Prompt:**
"Copilot, implement layer and folder creation/deletion.

1. Create `src/core/LayerManager.ts` with methods:
   - `addLayer(name, parentId?)`: Adds new layer to data model
   - `addFolder(name, parentId?)`: Adds new folder to data model
   - `deleteObject(id)`: Removes layer/folder from data model
2. Each method should:
   - Generate unique IDs (use UUID or timestamp-based)
   - Update the data via `context.Data.load()`
   - Emit appropriate events (onObjectAdd, onObjectDelete)
   - Return the new object or deletion result
3. Update `LayerPanel.ts` to add icon buttons at the bottom:
   - Add Layer button → calls LayerManager.addLayer()
   - Add Folder button → calls LayerManager.addFolder()
   - Delete button → calls LayerManager.deleteObject() for selected layer
4. After each operation, call `this.render()` to update the UI"

**Acceptance Criteria:**
- Add layer button creates new layer
- Add folder button creates new folder
- Delete button removes selected layer/folder
- Data model updates correctly
- Events are emitted
- UI re-renders to show changes

✅ **Task Completed:** 2025-10-26 - LayerManager.ts created with full CRUD operations, toolbar added to LayerPanel

### **Task 14.2: Implement Layer Renaming**

**Priority:** MEDIUM  
**Dependencies:** Task 14.1 completed

**Prompt:**
"Copilot, implement double-click to rename layers.

1. In `LayerPanel.ts`, add double-click handler to `.layer-name`:
   - Replace text content with an `<input>` element
   - Pre-fill input with current name
   - Focus the input and select all text
2. On blur or Enter key:
   - Get new name from input value
   - Call `LayerManager.renameObject(id, newName)`
   - Emit `onObjectRename` event
   - Re-render the layer panel
3. On Escape key: Cancel editing and restore original name
4. Add `LayerManager.renameObject()` method to update data model"

**Acceptance Criteria:**
- Double-click on layer name enables editing
- Enter key saves new name
- Escape key cancels editing
- Name updates in data model
- onObjectRename event is emitted

✅ **Task Completed:** 2025-10-26 - Double-click rename implemented in LayerPanel with input field and keyboard handlers

### **Task 14.3: Implement Drag-and-Drop Layer Reordering**

**Priority:** MEDIUM  
**Dependencies:** Task 14.1 completed

**Prompt:**
"Copilot, implement drag-and-drop to reorder layers.

1. In `LayerPanel.ts`, make layer rows draggable:
   - Add `draggable='true'` attribute to `.layer-row` elements
   - Add `ondragstart`, `ondragover`, `ondrop` handlers
2. During drag:
   - Store dragged layer ID in dataTransfer
   - Show visual feedback (opacity, drop indicator line)
   - Determine valid drop targets (same level, inside folders)
3. On drop:
   - Calculate new position (index) or new parent
   - Call `LayerManager.reorderObject()` or `LayerManager.reparentObject()`
   - Emit `onObjectReorder` or `onObjectReparent` event
   - Re-render layer panel and timeline grid
4. Implement helper methods in LayerManager for reordering/reparenting"

**Acceptance Criteria:**
- Layers can be dragged and reordered
- Visual feedback during drag operation
- Layers can be dragged into/out of folders
- Drop indicator shows valid drop locations
- Data model and UI update correctly
- Events are emitted

✅ **Task Completed:** 2025-10-26 - Drag-and-drop implemented with visual feedback, reparentObject working for folders

### **Task 14.4: Implement Folder Expand/Collapse**

**Priority:** MEDIUM  
**Dependencies:** Phase 9 completed

**Prompt:**
"Copilot, implement folder expand/collapse functionality.

1. In `LayerPanel.ts`, add click handler to `.layer-icon-folder`:
   - Toggle a collapsed state (store in StateManager or data model)
   - Rotate the icon (CSS transform: rotate)
   - Show/hide child layers in the UI
2. Update `renderLayers()` to:
   - Check if parent folder is collapsed before rendering children
   - Skip rendering rows for hidden children
3. Update `TimelineGrid.ts` to:
   - Skip rendering grid rows for collapsed children
   - Adjust row indices to match visible layers only
4. Store collapsed state per folder ID in StateManager"

**Acceptance Criteria:**
- Clicking folder icon toggles expand/collapse
- Icon rotates to indicate state
- Child layers hide/show in layer panel
- Corresponding grid rows hide/show
- State persists during session
- Grid remains synchronized with layer panel

✅ **Task Completed:** 2025-10-26 - Folder expand/collapse implemented with click handler on folder icon, CSS rotation animation, collapsed state tracking in Set and StateManager persistence, synchronized rendering in LayerPanel and TimelineGrid to show/hide children, folder:toggled event emission

---

## **Phase 15: Keyframe and Frame Manipulation**

### **Task 15.1: Implement Frame Selection**

**Priority:** HIGH  
**Dependencies:** Phase 12 completed

**Prompt:**
"Copilot, implement frame and keyframe selection in the timeline grid.

1. Create `src/core/SelectionManager.ts`:
   - Track selected frame IDs in a Set
   - Methods: `selectFrame()`, `deselectFrame()`, `clearSelection()`, `selectRange()`, `toggleSelection()`
   - Support CTRL-click for multi-select
   - Support Shift-click for range select
2. In `TimelineGrid.ts`, add click handlers to frame elements:
   - Single click: Clear selection and select clicked frame
   - CTRL+click: Toggle selection of clicked frame
   - Shift+click: Select range from last selected to clicked
3. Add visual feedback:
   - Add `.selected` class to selected elements
   - Style selected frames with border or background highlight
4. Emit `onKeyframeSelect` event with selected IDs"

**Acceptance Criteria:**
- Click selects individual frame
- CTRL+click enables multi-select
- Shift+click selects range
- Selected frames are visually highlighted
- Selection state is tracked accurately
- Events are emitted

✅ **Task Completed:** 2025-10-26 - SelectionManager.ts created with selectFrame, deselectFrame, clearSelection, toggleSelection, and selectRange methods. Click handlers added to all frame types in TimelineGrid with CTRL/Shift modifiers support. Selected frames visually highlighted with blue background and white borders. Selection state tracked in Set and selection:changed events emitted.

### **Task 15.2: Implement Insert Keyframe (F6/F7/F5)**

**Priority:** HIGH  
**Dependencies:** Task 15.1 completed

**Prompt:**
"Copilot, implement keyframe insertion operations.

1. Create `src/core/KeyframeManager.ts` with methods:
   - `insertKeyframe(layerId, frame)`: Insert content keyframe (F6)
   - `insertBlankKeyframe(layerId, frame)`: Insert empty keyframe (F7)
   - `insertFrame(layerId, frame)`: Extend frames (F5)
   - `deleteFrames(layerId, frameStart, frameEnd)`: Remove frames
2. Each method should:
   - Update the data model (add to keyframes array)
   - Emit appropriate event (onKeyframeAdd)
   - Trigger UI re-render
3. Add keyboard shortcuts in `JsTimeLine.ts`:
   - F6 → insertKeyframe()
   - F7 → insertBlankKeyframe()
   - F5 → insertFrame()
   - Shift+F5 → deleteFrames()
4. Ensure operations work on currently selected layer and frame"

**Acceptance Criteria:**
- F6 creates content keyframe at current frame
- F7 creates blank keyframe at current frame
- F5 extends frame sequence
- Shift+F5 removes frames
- Data model updates correctly
- UI re-renders to show changes
- Events are emitted

✅ **Task Completed:** 2025-10-26 - KeyframeManager.ts created with insertKeyframe, insertBlankKeyframe, insertFrame, deleteFrames, and deleteKeyframe methods. All methods update data model (keyframes array), emit appropriate events (keyframe:added, frame:inserted, frames:deleted), and trigger UI re-render. Keyboard shortcuts added in setupKeyboardShortcuts: F6 for content keyframe, F7 for blank keyframe, F5 for insert frame, Shift+F5 for delete frames.

### **Task 15.3: Implement Keyframe Drag-and-Drop**

**Priority:** MEDIUM  
**Dependencies:** Tasks 15.1, 15.2 completed

**Prompt:**
"Copilot, implement drag-and-drop for keyframes and frame sequences.

1. In `TimelineGrid.ts`, make keyframes draggable:
   - Add draggable attribute to keyframe elements
   - On dragstart: Store keyframe ID, layer ID, original frame
   - On drag: Show ghost element following cursor
2. Make grid cells drop targets:
   - On dragover: Calculate target frame and layer
   - Show visual indicator of drop position
   - Validate drop target (check for conflicts)
3. On drop:
   - Calculate frame offset (delta)
   - Call `KeyframeManager.moveKeyframes(ids, layerId, frameOffset)`
   - Update data model
   - Emit `onKeyframeMove` event
   - Re-render grid
4. Support dragging multiple selected keyframes together"

**Acceptance Criteria:**
- Keyframes can be dragged horizontally (time)
- Keyframes can be dragged vertically (layers)
- Multiple selected keyframes move together
- Visual feedback during drag
- Drop indicator shows target position
- Invalid drops are prevented
- Data and UI update correctly

✅ **Task Completed:** 2025-10-26 - Keyframe drag-and-drop implemented in TimelineGrid. Keyframes made draggable with dragstart/dragend handlers. Drop targets added to all frame types (keyframes, standard, empty). Multiple selected keyframes drag together. Visual feedback: dragging opacity 0.5, blue dashed drop indicator. KeyframeManager.moveKeyframes handles data model updates, conflict detection, and cross-layer moves. Selection updates to new positions after drop. Events emitted: keyframes:moved.

### **Task 15.4: Implement Copy/Paste for Keyframes**

**Priority:** LOW  
**Dependencies:** Task 15.1 completed

**Prompt:**
"Copilot, implement copy and paste for keyframes.

1. In `KeyframeManager.ts`, add methods:
   - `copyKeyframes(keyframeIds)`: Copy selected keyframes to clipboard
   - `pasteKeyframes(targetLayerId, targetFrame)`: Paste from clipboard
2. Use StateManager to store clipboard data (array of keyframe objects)
3. Add keyboard shortcuts:
   - CTRL+C → copy selected keyframes
   - CTRL+V → paste at current position
4. Add copy/paste options to context menu
5. Pasted keyframes should:
   - Maintain relative timing
   - Generate new unique IDs
   - Emit onKeyframeAdd events"

**Acceptance Criteria:**
- CTRL+C copies selected keyframes
- CTRL+V pastes at current frame
- Relative timing is preserved
- New IDs are generated
- Works across layers
- Context menu includes copy/paste

✅ **Task Completed:** 2025-10-26 - Copy/paste functionality implemented in KeyframeManager. copyKeyframes stores selected keyframes data in StateManager clipboard. pasteKeyframes retrieves clipboard data, calculates frame offset to preserve relative timing, checks for conflicts, and creates new keyframes at target position. Keyboard shortcuts added: CTRL+C for copy, CTRL+V for paste. Events emitted: keyframes:copied, keyframes:pasted. Works across layers.

---

## **Phase 16: Tween/Interpolation Management**

### **Task 16.1: Implement Create Motion Tween**

**Priority:** HIGH  
**Dependencies:** Phase 15 completed

**Prompt:**
"Copilot, implement motion tween creation as specified in Section 3.3.

1. Create `src/core/TweenManager.ts` with method:
   - `createMotionTween(layerId, startFrame, endFrame, properties)`
2. Workflow implementation:
   - User selects exactly 2 keyframes (checked via SelectionManager)
   - User right-clicks to open context menu
   - Menu shows 'Create Motion Tween' only if 2 keyframes selected
   - On selection, call TweenManager.createMotionTween()
3. Method should:
   - Validate: 2 keyframes on same layer
   - Add tween object to layer's tweens array
   - Emit `onTweenAdd` event
   - Re-render grid to show blue tween sequence
4. Update TimelineGrid rendering to:
   - Detect frames within tween range
   - Render with blue background and arrow
   - Use `.grid-tween` class"

**Acceptance Criteria:**
- Can select 2 keyframes with CTRL+click
- Context menu shows 'Create Motion Tween' option
- Selecting option creates tween in data model
- Grid renders tween as blue sequence with arrow
- Tween only shows when exactly 2 keyframes selected
- Events are emitted

✅ **Task Completed:** 2025-10-26 - TweenManager.ts created with createMotionTween, removeTween, getTweenAtFrame, and isFrameInTween methods. Context menu system implemented in TimelineGrid with right-click handler. Menu shows "Create Motion Tween" when exactly 2 keyframes on same layer are selected. createMotionTween validates keyframes, checks for overlaps, adds tween to layer's tweens array. Events emitted: tween:added. Grid already renders tweens with blue background and arrows from existing renderTweens implementation.

### **Task 16.2: Implement Remove Tween**

**Priority:** MEDIUM  
**Dependencies:** Task 16.1 completed

**Prompt:**
"Copilot, implement tween removal functionality.

1. In `TweenManager.ts`, add method:
   - `removeTween(layerId, tweenIndex)`: Remove tween from data
2. Update context menu for tween sequences:
   - When right-clicking on a tween (blue area)
   - Show 'Remove Motion Tween' option
   - On selection, call TweenManager.removeTween()
3. Method should:
   - Remove tween from layer's tweens array
   - Emit `onTweenRemove` event
   - Re-render grid to show standard frames
4. Frames should revert to standard gray appearance"

**Acceptance Criteria:**
- Right-click on tween shows 'Remove Motion Tween'
- Selecting option removes tween from data
- Grid re-renders frames as standard (gray)
- Events are emitted
- Keyframes remain intact

✅ **Task Completed:** 2025-10-26 - Remove tween already implemented in TweenManager.removeTween and context menu. Right-clicking on any tween frame (blue area) shows "Remove Motion Tween" option. removeTween filters tween from layer's tweens array, emits tween:removed event, and triggers UI re-render. Grid automatically renders frames as standard (gray) after tween removal. Keyframes remain intact.

### **Task 16.3: Implement Tween Properties (Optional Enhancement)**

**Priority:** LOW  
**Dependencies:** Task 16.1 completed

**Prompt:**
"Copilot, add support for tween property editing.

1. Create `src/ui/TweenPropertiesDialog.ts`:
   - Modal dialog component
   - Fields for easing type (linear, ease-in, ease-out, ease-in-out)
   - OK and Cancel buttons
2. Show dialog when:
   - User double-clicks on tween sequence
   - Or selects 'Tween Properties' from context menu
3. On OK:
   - Update tween properties in data model
   - Close dialog
   - Re-render if needed
4. Style dialog in JsTimeLine.less with overlay and modal styling"

**Acceptance Criteria:**
- Double-click on tween opens properties dialog
- Dialog shows current easing settings
- Changes are saved to data model
- Dialog has proper styling and UX
- Can cancel without changes

✅ **Task Completed:** ___

---

## **Phase 17: Context Menu System**

### **Task 17.1: Create Context Menu Framework**

**Priority:** HIGH  
**Dependencies:** Phase 9, 12 completed

**Prompt:**
"Copilot, create a reusable context menu system.

1. Create `src/ui/ContextMenu.ts`:
   - Class to display and manage context menus
   - Constructor takes menu items array: `{ label, action, enabled?, separator? }[]`
   - Method `show(x, y)`: Display menu at coordinates
   - Method `hide()`: Remove menu from DOM
   - Handle click events on items
   - Auto-hide on outside click or Escape key
2. Style in `JsTimeLine.less`:
   - Position absolute, white background
   - Box shadow for elevation
   - Hover states for items
   - Disabled item styling
   - Separator styling
3. Add to Context UI: `this._context.UI.contextMenu`"

**Acceptance Criteria:**
- Menu displays at specified coordinates
- Menu items are clickable
- Disabled items are grayed out
- Menu closes on outside click or Escape
- Styling matches Flash MX aesthetic
- Separators render correctly

✅ **Task Completed:** 2025-10-26 - ContextMenu.ts created as reusable framework with IMenuItem interface. show(x, y, items) displays menu at coordinates with auto-positioning to stay on screen. hide() removes menu from DOM. Handles click events, auto-hides on outside click and Escape key. Disabled items grayed out with .disabled class. Separator support with .context-menu-separator. Styled with white background, box shadow, hover states (#0066cc). Added to context as UI.contextMenu. TimelineGrid updated to use new ContextMenu class.

### **Task 17.2: Implement Layer Context Menu**

**Priority:** HIGH  
**Dependencies:** Task 17.1 completed

**Prompt:**
"Copilot, implement context menu for layer names as per Section 5.1.

1. In `LayerPanel.ts`, add right-click handler to `.layer-row`:
   - Prevent default context menu
   - Build menu items array based on spec:
     * Insert Layer
     * Insert Folder
     * Show/Hide Others
     * Lock Others
     * Delete Layer
     * Rename Layer
     * Properties... (placeholder)
   - Call `contextMenu.show(event.clientX, event.clientY)`
2. Wire up actions:
   - Insert Layer → LayerManager.addLayer()
   - Insert Folder → LayerManager.addFolder()
   - Delete Layer → LayerManager.deleteObject() (with confirmation)
   - Rename Layer → Enter rename mode
   - Show/Hide Others → Toggle visibility of all other layers
   - Lock Others → Lock all other layers"

**Acceptance Criteria:**
- Right-click on layer shows menu
- All menu items are present
- Actions execute correctly
- Delete shows confirmation (onBeforeObjectDelete)
- Show/Hide Others affects other layers
- Lock Others locks other layers

✅ **Task Completed:** 2025-01-26

**Implementation Details:**
- Added `showLayerContextMenu()` method to `LayerPanel.ts` with 9 menu items:
  - Insert Layer: Adds new layer below selected
  - Insert Folder: Adds new folder below selected
  - Delete Layer: Deletes with confirmation dialog
  - Rename Layer: Triggers inline rename mode
  - Show/Hide Others: Toggles visibility of all other layers recursively
  - Lock Others: Locks all other layers recursively
  - Properties (disabled): Placeholder for future implementation
- Added helper methods `toggleOthersVisibility()` and `lockOthers()` for batch operations
- Fixed `IMenuItem` interface in `ContextMenu.ts` to make `label` optional for separators
- Right-click handler automatically selects layer before showing menu
- All actions properly integrated with `LayerManager` service

### **Task 17.3: Implement Keyframe Context Menu**

**Priority:** HIGH  
**Dependencies:** Task 17.1, Phase 15 completed

**Prompt:**
"Copilot, implement context menu for keyframes as per Section 5.1.

1. In `TimelineGrid.ts`, add right-click handler to frame elements:
   - Detect what was clicked (empty, keyframe, tween)
   - Build appropriate menu items
2. For single keyframe:
   - Insert Frame
   - Delete Frames
   - Insert Keyframe
   - Insert Blank Keyframe
   - Clear Keyframe
   - Copy Frames
   - Paste Frames
   - Reverse Frames (optional)
3. For 2 selected keyframes (add to menu):
   - Create Motion Tween
4. For tween sequence:
   - Remove Motion Tween
   - Copy Frames
   - Paste Frames
   - Select All Frames
5. For empty area:
   - Insert Frame
   - Insert Keyframe
   - Insert Blank Keyframe"

**Acceptance Criteria:**
- Menu adapts based on clicked element
- All actions work correctly
- 'Create Motion Tween' only shows for 2 keyframes
- Menu items call appropriate Manager methods
- Disabled items are grayed out when not applicable

✅ **Task Completed:** 2025-01-26

**Implementation Details:**
- Completely rewrote `setupContextMenu()` in `TimelineGrid.ts` with comprehensive keyframe operations
- Context-aware menu that adapts based on:
  - Empty frame: Insert Frame, Insert Keyframe, Insert Blank Keyframe
  - Keyframe: All insert/delete operations, Clear Keyframe
  - Tween: Remove Motion Tween option
  - 2 selected keyframes (same layer): Create Motion Tween
- Menu items organized by category with separators:
  - Tween operations (Create/Remove)
  - Frame insertion/deletion operations
  - Keyframe specific operations (Clear)
  - Copy/Paste operations
- Copy Frames: Enabled when selection exists or clicking on keyframe
- Paste Frames: Enabled only when clipboard contains keyframes
- Delete Frames: Handles both single frame and selection
- Fixed clipboard detection to use `stateManager.get('clipboard_keyframes')`
- All actions properly wired to KeyframeManager and TweenManager

### **Task 17.4: Implement Mobile Context Menu (Three Dots)**

**Priority:** LOW  
**Dependencies:** Tasks 17.2, 17.3 completed

**Prompt:**
"Copilot, add mobile-friendly context menu access as per Section 5.2.

1. In `LayerPanel.ts` and `TimelineGrid.ts`:
   - Detect if device is touch-enabled
   - On selection, show three-dot icon (⋮) on selected element
   - Position icon at end of layer row or on keyframe
2. Create icon element:
   - Class `.context-menu-trigger`
   - Click/tap handler shows same context menu
   - Hide when selection changes
3. Style in JsTimeLine.less:
   - Small circular button
   - Three dots icon
   - Appears on selection
   - Visible tap target (min 44x44px)
4. For touch devices, use tap instead of right-click"

**Acceptance Criteria:**
- Three-dot icon appears on selected items
- Icon is touch-friendly (large enough)
- Tapping icon shows context menu
- Works on mobile/touch devices
- Icon hides when selection changes
- Fallback to right-click on desktop

✅ **Task Completed:** ___

---

## **Phase 18: Event System Implementation**

### **Task 18.1: Implement All Required Events**

**Priority:** MEDIUM  
**Dependencies:** Phases 14, 15, 16 completed

**Prompt:**
"Copilot, ensure all events from Section 6.1 are properly emitted.

Review `src/core/EventManager.ts` and all Manager classes:
1. Verify each Manager emits the correct events:
   - LayerManager: onObjectAdd, onObjectDelete, onObjectRename, etc.
   - KeyframeManager: onKeyframeAdd, onKeyframeDelete, onKeyframeMove, etc.
   - TweenManager: onTweenAdd, onTweenRemove
   - PlaybackEngine: onPlaybackStart, onPlaybackPause, onFrameEnter, onTimeSeek
2. Ensure event payloads match the specification exactly
3. Implement cancellable events (onBeforeObjectDelete, onBeforeKeyframeDelete):
   - Check if `event.defaultPrevented` before proceeding
   - Allow listeners to call `event.preventDefault()`
4. Document each event in code comments"

**Acceptance Criteria:**
- All 17 events from spec are emitted
- Event payloads contain correct data
- Cancellable events work correctly
- Events are documented in code
- Test that external listeners can receive events

✅ **Task Completed:** ___

### **Task 18.2: Create Event Testing Utilities**

**Priority:** LOW  
**Dependencies:** Task 18.1 completed

**Prompt:**
"Copilot, create utilities to test and debug events.

1. Create `src/utils/EventLogger.ts`:
   - Function `attachEventLogger(context)` that logs all events to console
   - Pretty-print event name and payload
   - Include timestamp
2. Add to test HTML page:
   - Checkbox to enable/disable event logging
   - Event log display area showing recent events
3. Create example in index.html demonstrating:
   - How to listen to specific events
   - How to cancel cancellable events
   - How to extract data from payloads"

**Acceptance Criteria:**
- Event logger can be enabled/disabled
- All events are logged with details
- Test page demonstrates event handling
- Documentation shows example usage

✅ **Task Completed:** ___

### **Task 18.3: Standardize Event Naming Convention**

**Priority:** LOW  
**Dependencies:** Task 18.1 completed

**Prompt:**
"Copilot, align all event names with the specification's naming convention.

Current implementation uses colon-separated format (e.g., 'layer:added', 'keyframe:deleted', 'playback:started').
Specification uses camelCase with 'on' prefix (e.g., 'onObjectAdd', 'onKeyframeDelete', 'onPlaybackStart').

1. Update all `emit()` calls in Manager classes:
   - **LayerManager.ts**: 
     - 'layer:added', 'folder:added' → 'onObjectAdd'
     - 'layer:deleted' → 'onObjectDelete'
     - 'layer:renamed' → 'onObjectRename'
     - 'layer:reordered' → 'onObjectReorder'
     - 'layer:reparented' → 'onObjectReparent'
     - 'layer:visibilityChanged' → 'onObjectVisibilityChange'
     - 'layer:lockChanged' → 'onObjectLockChange'
   - **KeyframeManager.ts**:
     - 'keyframe:added' → 'onKeyframeAdd'
     - 'keyframe:deleted', 'frames:deleted' → 'onKeyframeDelete'
     - 'keyframes:moved' → 'onKeyframeMove'
     - 'keyframes:copied', 'keyframes:pasted' → Document as internal events or map to spec
   - **TweenManager.ts**:
     - 'tween:added' → 'onTweenAdd'
     - 'tween:removed' → 'onTweenRemove'
   - **PlaybackEngine.ts**:
     - 'playback:started' → 'onPlaybackStart'
     - 'playback:paused' → 'onPlaybackPause'
     - 'playback:frameEnter' → 'onFrameEnter'
     - 'playback:frameChanged' → 'onTimeSeek'
   - **SelectionManager.ts**:
     - 'selection:changed' → 'onKeyframeSelect'

2. Update all event listeners in UI components:
   - Search for all `eventManager.on()` calls
   - Update event names to match new convention
   - Test that all event handlers still work

3. Add 'onBefore' cancellable events:
   - Implement 'onBeforeObjectDelete' in LayerManager.deleteObject()
   - Implement 'onBeforeKeyframeDelete' in KeyframeManager.deleteFrames()
   - Create event object with preventDefault() method
   - Check defaultPrevented flag before proceeding with deletion

4. Create migration guide:
   - Document all event name changes in CHANGELOG.md
   - Provide mapping table for external consumers
   - Add deprecation warnings for old event names (optional)

5. Update all JSDoc comments to reference new event names"

**Acceptance Criteria:**
- All event names match specification exactly
- Event payloads match specification format
- Cancellable events (onBefore*) work correctly
- All UI components updated and tested
- No broken event listeners
- Migration guide created for external consumers
- All JSDoc comments updated

✅ **Task Completed:** ___

---

## **Phase 19: Data Persistence and Serialization**

### **Task 19.1: Implement Save/Load Data**

**Priority:** MEDIUM  
**Dependencies:** Phase 8 completed

**Prompt:**
"Copilot, implement save and load functionality for timeline data.

1. In `TimeLineData.ts`, add methods:
   - `toJSON(): string`: Serialize current data to JSON string
   - `fromJSON(json: string): void`: Load data from JSON string
2. Add validation:
   - Check version compatibility
   - Validate required fields
   - Handle migration if needed (future-proofing)
3. In `JsTimeLine.ts`, add public methods:
   - `exportData(): string`: Returns JSON of current timeline
   - `importData(json: string): void`: Loads JSON and re-renders all UI
4. On import:
   - Validate JSON structure
   - Load via Data.fromJSON()
   - Re-render all UI components
   - Emit appropriate events"

**Acceptance Criteria:**
- exportData() returns valid JSON matching schema
- importData() loads JSON correctly
- All UI components update after import
- Invalid JSON is handled gracefully
- Version field is checked
- Complex nested structures work (folders with children)

✅ **Task Completed:** ___

### **Task 19.2: Add Save/Load UI Controls**

**Priority:** LOW  
**Dependencies:** Task 19.1 completed

**Prompt:**
"Copilot, add UI controls for save/load operations.

1. Add buttons to test page (index.html):
   - 'Export Timeline Data' button
   - 'Import Timeline Data' button
   - File input for loading JSON files
   - Download link for saving JSON files
2. Wire up functionality:
   - Export button calls `timeline.exportData()`
   - Trigger download of JSON file
   - Import button loads file content
   - Parse and call `timeline.importData()`
3. Add error handling:
   - Show alert for invalid JSON
   - Display error messages
   - Validate before importing"

**Acceptance Criteria:**
- Export button downloads JSON file
- Import button loads JSON file
- File has proper name (e.g., 'timeline-data.json')
- Errors are displayed to user
- Large files work correctly
- Round-trip works (export then import)

✅ **Task Completed:** ___

---

## **Phase 20: Polish and Optimization**

### **Task 20.1: Implement Keyboard Shortcuts**

**Priority:** MEDIUM  
**Dependencies:** Most phases completed

**Prompt:**
"Copilot, implement all keyboard shortcuts from the specification.

1. Create `src/core/KeyboardManager.ts`:
   - Centralized keyboard event handling
   - Method `registerShortcut(key, modifiers, handler)`
   - Handle key combinations (Ctrl, Shift, Alt)
2. Register shortcuts in `JsTimeLine.ts`:
   - F5: Insert Frame
   - Shift+F5: Delete Frame
   - F6: Insert Keyframe
   - F7: Insert Blank Keyframe
   - Enter: Toggle Play/Pause
   - , (comma): Previous Frame
   - . (period): Next Frame
   - Ctrl+C: Copy
   - Ctrl+V: Paste
   - Delete: Delete selected
   - Ctrl+Z: Undo (if implemented)
3. Ensure shortcuts only work when timeline is focused
4. Prevent default browser actions when needed"

**Acceptance Criteria:**
- All shortcuts from spec work correctly
- Shortcuts don't interfere with browser
- Shortcuts are documented
- Works with focus management
- Modifier keys work correctly

✅ **Task Completed:** ___

### **Task 20.2: Performance Optimization**

**Priority:** MEDIUM  
**Dependencies:** All rendering phases completed

**Prompt:**
"Copilot, optimize rendering performance for large timelines.

1. Implement virtual scrolling in `TimelineGrid.ts`:
   - Only render visible frames (viewport culling)
   - Calculate visible range based on scroll position
   - Render buffer of extra rows/columns
   - Reuse DOM elements when possible
2. Optimize LayerPanel rendering:
   - Only render visible layers
   - Implement virtual list for many layers
3. Debounce expensive operations:
   - Scroll events
   - Resize events
   - Render calls
4. Use CSS transforms for smooth animations:
   - Playhead movement
   - Scroll synchronization
5. Profile and identify bottlenecks:
   - Use browser performance tools
   - Measure render times
   - Optimize critical paths"

**Acceptance Criteria:**
- Smooth scrolling with 100+ layers
- No lag with 500+ frames
- Efficient memory usage
- 60fps during playback
- Debounced scroll handlers
- Virtual rendering implemented

✅ **Task Completed:** ___

### **Task 20.3: Responsive Design and Sizing**

**Priority:** LOW  
**Dependencies:** All UI phases completed

**Prompt:**
"Copilot, make the timeline responsive to container size changes.

1. Add ResizeObserver to `JsTimeLine.ts`:
   - Watch container element for size changes
   - Recalculate layout on resize
   - Update grid dimensions
2. Make panel widths configurable:
   - Layer panel width adjustable
   - Ruler height adjustable
   - Store in settings or state
3. Add resize handles:
   - Between layer panel and grid (horizontal drag)
   - Between ruler and grid (vertical drag)
   - Implement drag handlers with proper cursors
4. Ensure minimum sizes:
   - Layer panel min width: 150px
   - Ruler min height: 30px
5. Update styles for responsive behavior"

**Acceptance Criteria:**
- Timeline adapts to container resizing
- Resize handles work smoothly
- Minimum sizes are enforced
- Layout remains stable during resize
- Grid reflows correctly
- Mobile sizes work (min 320px)

✅ **Task Completed:** ___

### **Task 20.4: Accessibility Improvements**

**Priority:** LOW  
**Dependencies:** All UI phases completed

**Prompt:**
"Copilot, add accessibility features to the timeline.

1. Add ARIA attributes:
   - Role attributes for semantic meaning
   - aria-label for interactive elements
   - aria-selected for selected items
   - aria-expanded for folders
   - aria-disabled for locked layers
2. Keyboard navigation:
   - Tab through interactive elements
   - Arrow keys to navigate grid
   - Space to toggle selection
   - Enter to activate buttons
3. Focus management:
   - Visible focus indicators
   - Logical focus order
   - Focus trap in modals
4. Screen reader support:
   - Announce state changes
   - Describe actions
   - Provide context
5. Color contrast:
   - Ensure sufficient contrast ratios
   - Don't rely solely on color"

**Acceptance Criteria:**
- Keyboard navigation works throughout
- Screen readers can understand structure
- Focus indicators are visible
- ARIA attributes are correct
- Meets WCAG 2.1 AA standards
- Tab order is logical

✅ **Task Completed:** ___

---

## **Phase 21: Advanced Features (Optional)**

### **Task 21.1: Implement Undo/Redo System**

**Priority:** LOW (Optional Enhancement)  
**Dependencies:** All core phases completed

**Prompt:**
"Copilot, implement undo/redo functionality.

1. Create `src/core/HistoryManager.ts`:
   - Command pattern for all operations
   - Undo stack and redo stack
   - Method `execute(command)` that adds to history
   - Methods `undo()` and `redo()`
2. Create command classes for each operation:
   - AddLayerCommand
   - DeleteLayerCommand
   - AddKeyframeCommand
   - MoveKeyframeCommand
   - CreateTweenCommand
   - etc.
3. Each command implements:
   - `execute()`: Perform the operation
   - `undo()`: Reverse the operation
4. Wire up keyboard shortcuts:
   - Ctrl+Z: Undo
   - Ctrl+Y or Ctrl+Shift+Z: Redo
5. Add undo/redo buttons to UI"

**Acceptance Criteria:**
- All major operations can be undone
- Redo works after undo
- Multiple undo/redo steps work
- History limit prevents memory issues
- Keyboard shortcuts work
- UI buttons update state

✅ **Task Completed:** ___

### **Task 21.2: Implement Onion Skinning**

**Priority:** LOW (Optional Enhancement)  
**Dependencies:** Phase 13 completed

**Prompt:**
"Copilot, add onion skinning feature to visualize adjacent frames.

1. Add onion skin toggle to playback controls
2. Add settings:
   - Number of frames before/after to show
   - Opacity of onion skin layers
3. When enabled:
   - Emit event with frames to display
   - Show ghosted versions of adjacent frames
   - Fade opacity based on distance from current frame
4. Style in LESS with semi-transparent overlays"

**Acceptance Criteria:**
- Toggle enables/disables onion skinning
- Shows configurable number of frames
- Opacity decreases with distance
- Performance remains good
- Works during playback and scrubbing

✅ **Task Completed:** ___

### **Task 21.3: Implement Frame Markers and Labels**

**Priority:** LOW (Optional Enhancement)  
**Dependencies:** Phase 10, 12 completed

**Prompt:**
"Copilot, add frame markers and labels to the ruler.

1. Add data structure for markers:
   - Frame number
   - Label text
   - Color (optional)
2. Render markers in TimeRuler:
   - Small flag icon at marked frames
   - Label text on hover or below ruler
3. Add context menu option:
   - Right-click on ruler: 'Add Frame Marker'
   - Show dialog to enter label
4. Style markers distinctly from playhead"

**Acceptance Criteria:**
- Can add markers to specific frames
- Markers are visually distinct
- Labels are readable
- Markers saved in data model
- Can edit/delete markers

✅ **Task Completed:** ___

---

## **Final Checklist**

### **Code Quality**
- [ ] All TypeScript has proper type annotations (no `any`)
- [ ] All styling is in LESS files (no inline styles in TS)
- [ ] LESS follows strict nesting within `.JsTimeLine`
- [ ] BEM-like naming convention used consistently
- [ ] Private members use underscore prefix
- [ ] All classes follow Context architecture pattern
- [ ] No prop drilling (use Context)
- [ ] DOM elements cached appropriately
- [ ] `data-js-*` attributes used for JS hooks

### **Functionality**
- [ ] All 17 events from spec are implemented
- [ ] All keyboard shortcuts work
- [ ] Layer operations (add/delete/rename/reorder) work
- [ ] Keyframe operations (insert/delete/move) work
- [ ] Tween creation and removal work
- [ ] Playback engine works smoothly
- [ ] Scrubbing works
- [ ] Context menus work and adapt to context
- [ ] Selection (single/multi/range) works
- [ ] Synchronized scrolling works
- [ ] Folder expand/collapse works

### **Data Model**
- [ ] JSON schema matches specification
- [ ] Hierarchical structure (folders with children) works
- [ ] Export/import functionality works
- [ ] Data validation implemented
- [ ] Version field included for migration

### **UI/UX**
- [ ] Visual appearance matches Flash MX style
- [ ] All frame types render correctly
- [ ] Playhead spans all layers
- [ ] Grid aligns with ruler and layer panel
- [ ] Hover states provide feedback
- [ ] Selected items are clearly indicated
- [ ] Disabled items are visually distinct
- [ ] Mobile/touch support works

### **Performance**
- [ ] Smooth with 100+ layers
- [ ] Smooth with 500+ frames
- [ ] 60fps during playback
- [ ] Efficient re-rendering
- [ ] Virtual scrolling implemented (if needed)
- [ ] Debounced handlers used

### **Testing**
- [ ] Manual testing completed
- [ ] All keyboard shortcuts tested
- [ ] Context menus tested
- [ ] Events emit correctly
- [ ] Save/load roundtrip works
- [ ] Edge cases handled (empty timeline, single layer, etc.)

---

## **Notes for Implementation**

1. **Always follow the Context pattern**: Never pass props through multiple levels. Use `this.context` to access shared state and services.

2. **Strict LESS separation**: Any developer (human or AI) who puts style definitions in TypeScript files will be immediately corrected. All styles must be in `.less` files.

3. **Type safety is mandatory**: Use explicit interfaces for all data structures. Avoid `any` at all costs.

4. **Event-driven architecture**: Components should communicate via events through EventManager, not direct method calls between siblings.

5. **Data model is read-only**: UI components should never modify data directly. Always go through Manager classes that update data and emit events.

6. **Recursive rendering**: Folder structures require recursive rendering functions. Don't use simple loops.

7. **Contextual rendering**: Frame appearance depends on neighboring frames. Implement state machine for frame types.

8. **Performance matters**: With large timelines, rendering performance is critical. Profile early and optimize.

9. **Mobile support**: Don't forget touch events and the three-dot menu for context actions.

10. **Test incrementally**: Build and test each phase before moving to the next. Don't skip phases.

---

**End of Complete Implementation Tasks**
