## Project: TypeScript/LESS Animation Timeline Control

**1. Overview**

This project aims to develop a reusable UI control for creating and managing timeline-based animations, built using TypeScript and styled with LESS. The control provides a visual interface inspired by the classic Macromedia Flash (now Adobe Animate) timeline editor, enabling users to define animation sequences through layers and keyframes.

**2. Goal**

To create a modular, event-driven, and highly customizable timeline component that can be integrated into web applications requiring animation sequencing capabilities. The control will offer an intuitive interface for managing animation layers, setting keyframes, and visualizing the animation flow over time.

**3. Inspiration**

The primary inspiration for the user interface and functionality is the timeline panel found in traditional animation software like Macromedia Flash/Adobe Animate. This includes the distinct separation of layer management and the frame-by-frame timeline grid.

**4. Core Components/Modules**

The control will be architected with a modular approach, separating concerns into distinct components:

* **`Timeline` (Main Container):** Orchestrates the interaction between different modules, manages overall state, and exposes the main API and events.
* **`LayerPanel`:** Displays the list of layers on the left side. Handles layer creation, deletion, reordering, naming, and attribute toggles.
    * **`LayerItem`:** Represents a single layer within the `LayerPanel`, displaying its name, color indicator, visibility status, and lock status.
* **`TimelineGrid`:** Displays the main timeline area on the right, aligned with the layers. Renders frame markers, keyframes, and the playhead.
    * **`FrameRuler`:** Displays the time/frame numbers above the grid.
    * **`LayerTrack`:** Represents the row corresponding to a specific layer within the grid, containing the frames for that layer.
    * **`Frame`:** Represents an individual frame slot within a `LayerTrack`. Can be empty or hold a `Keyframe`.
    * **`Keyframe`:** A visual marker within a `Frame` indicating a specific state or event at that point in time for the associated layer.
* **`Playhead`:** A movable indicator showing the current time/frame being previewed or edited.
* **`ControlsPanel`:** (Optional) Contains playback controls (play, stop, loop), frame rate settings, etc.
* **`EventManager`:** A central hub for publishing and subscribing to events within the timeline control (e.g., `keyframeAdded`, `layerVisibilityChanged`, `playheadMoved`).
* **`StateManager`:** Manages the overall state of the timeline (layers, keyframes, current time).

**5. Key Features**

* **Layer Management:**
    * Add, remove, and rename layers.
    * Reorder layers via drag-and-drop.
    * Group layers in a folder like treeview.
    * Assign a visual color indicator to each layer.
    * Toggle layer object visibility (show/hide). (It dont hide the Layer but the object that the layer is bond to)
    * Toggle layer locking (prevent editing).
* **Timeline Navigation:**
    * Horizontal scrolling through time/frames.
    * Zoom in/out on the timeline.
    * Movable playhead indicating the current frame.
* **Keyframe Management:**
    * Add keyframes to specific frames on a layer.
    * Remove keyframes.
    * Select and potentially edit keyframe properties (though the *visual* representation is the primary focus of the control itself).
    * Visually distinguish between empty frames, frames holding keyframes, and potentially tweened frames (future enhancement).
* **Event-Driven Architecture:**
    * Internal components communicate via a defined set of events.
    * External applications can listen for events to react to changes within the timeline (e.g., updating an animation preview when the playhead moves or a keyframe is modified).
* **Customization:**
    * Styling controlled via LESS variables and mixins.
    * API for programmatic control (adding layers, keyframes, setting time).
    * Can load or export the data with public functions

**6. Technology Stack**

* **Language:** TypeScript
* **Styling:** LESS (or CSS preprocessor of choice)
* **Framework:** (Optional - Specify if it's intended for a specific framework like React, Angular, Vue, or as a standalone vanilla component)

**7. Architecture Principles**

* **Modularity:** Break down the control into smaller, reusable components with well-defined responsibilities.
* **Separation of Concerns:** Keep UI rendering, state management, and event handling distinct.
* **Event-Driven:** Use an internal event bus for communication between modules to reduce tight coupling.
* **Testability:** Design components and modules to be easily testable in isolation.

**Deliverables:**

* Provide complete, well-commented code for the requested task.
* Identify any potential issues or areas for improvement.

**Progress Tracking:**
Before you start the work, create a task list to enumerate the change we need to make and save it as 'start-menu-theme-task.md'

After that, take one item, execute it, then mark that task item done before starting a new one.