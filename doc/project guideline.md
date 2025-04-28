# Timeline Animation Editor Project Specification

## Project Overview
Create a modular, plugin-based timeline animation editor similar to those found in animation and video editing software. The editor should allow users to create, manipulate, and animate objects along a timeline with keyframes and motion tweens.

## Core Architecture

### Plugin-Based Design
- Implement the project as a collection of plugin modules, each responsible for a specific functionality
- Each plugin must be self-contained and communicate with other plugins through events
- Every plugin must handle its own rendering (no plugin should render another plugin's content)
- Plugins should explicitly declare dependencies on other plugins

### Core Components
- **BaseComponent**: Abstract base class for all components
- **EventEmitter**: Strongly-typed event system for communication
- **DataModel**: Central data storage for timeline state
- **PluginManager**: Manages plugin lifecycle and dependencies
- **TimelineControl**: Main control class that ties everything together

## DOM Structure Requirements

The timeline must have the following DOM structure with strict adherence to this hierarchy:

```
timeline-control (main container)
├── timeline-toolbar (main toolbar at top)
├── timeline-content (main content area)
│   └── timeline-content-container (container for layers and keyframes)
│       ├── timeline-layers-container (left panel with layer list)
│       └── timeline-keyframes-area (right panel)
│           ├── timeline-ruler (time ruler above keyframes)
│           └── timeline-keyframes-container (keyframes area)
└── timeline-object-toolbar (object toolbar at bottom)
```

### Critical Layout Requirements
- The timeline-ruler must be positioned as the header of the timeline-keyframes-area
- The timeline-ruler and timeline-keyframes-container must be aligned perfectly
- Both panels must allow synchronized scrolling:
  - Vertical scrolling must be synchronized between layers-container and keyframes-container
  - Horizontal scrolling of keyframes-container must update time-ruler's position using CSS transforms

## Plugin Implementation

Each plugin must follow this pattern:
```typescript
export class MyPlugin extends Component {
    constructor(options: MyPluginOptions) {
        super(options.container, 'my-plugin-element-id');
        // Initialize
    }
    
    // Must implement these methods
    public initialize(): void { /* Set up event listeners */ }
    public render(): string { /* Return HTML string */ }
    public update(data: any): void { /* Update with new data */ }
    public destroy(): void { /* Clean up event listeners */ }
}
```

## Key Plugins

### 1. Time Management
- **TimeRuler**: Displays time markers and handles time navigation
  - Must handle click events to seek to a specific time
  - Must transform its content based on keyframes container scroll position
  - Must display tick marks at appropriate intervals based on zoom level

### 2. Layer Management
- **LayerManager**: Manages the list of layers/objects
  - Must handle layer selection, renaming, reordering
  - Must synchronize vertical scroll position with keyframes container

### 3. Keyframe Management
- **KeyframeManager**: Handles keyframe creation, selection, and movement
  - Must render keyframes at correct time positions
  - Must handle drag operations for moving keyframes
  - Must create/edit motion tweens between keyframes

### 4. Group Management
- **GroupManager**: Manages layer grouping and hierarchy

## Scroll Synchronization Implementation

To ensure proper scroll synchronization:

```typescript
// In TimelineControl.ts
private setupScrollSynchronization(): void {
    // Sync vertical scrolling
    this.keyframesContainerEl.addEventListener('scroll', () => {
        this.layersContainerEl.scrollTop = this.keyframesContainerEl.scrollTop;
    });
    
    this.layersContainerEl.addEventListener('scroll', () => {
        this.keyframesContainerEl.scrollTop = this.layersContainerEl.scrollTop;
    });
    
    // Sync horizontal scrolling between ruler and keyframes
    this.keyframesContainerEl.addEventListener('scroll', () => {
        const rulerContent = this.timeRulerEl.querySelector('.timeline-ruler-content');
        if (rulerContent) {
            (rulerContent as HTMLElement).style.transform = 
                `translateX(-${this.keyframesContainerEl.scrollLeft}px)`;
        }
    });
}
```

## CSS Structure Requirements

Key CSS rules to ensure proper layout:

```css
.timeline-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
}

.timeline-content-container {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.timeline-layers-container {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}

.timeline-keyframes-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
}

.timeline-ruler {
    height: var(--time-ruler-height);
    overflow: hidden;
    position: relative;
}

.timeline-keyframes-container {
    flex: 1;
    overflow: auto;
    position: relative;
}

.timeline-ruler-content {
    position: relative;
    height: 100%;
    min-width: 100%;
    will-change: transform;
}
```

## Event System Implementation

All components must communicate using the event system:

1. Define event types in Constants.ts
2. Define event handlers in EventTypes.ts
3. Implement emit methods in EventEmitter.ts
4. Components subscribe to events in their initialize method
5. Components emit events when making changes

## Component Initialization Order

The initialization order matters:
1. Create DOM structure
2. Set up scroll synchronization
3. Initialize MainToolbar
4. Initialize TimeRuler
5. Initialize LayerManager
6. Initialize KeyframeManager
7. Initialize ObjectToolbar
8. Initialize GroupManager
9. Render all components

## Important Implementation Details

1. **TimeRuler Component**:
   - Must render itself with a width based on duration and time scale
   - Must handle clicks to seek to specific times
   - Must account for horizontal scroll position when calculating click positions

2. **KeyframeManager**:
   - Must render keyframes at positions calculated from: 
     `position = time * timeScale * PIXELS_PER_SECOND`
   - Must handle dragging of keyframes and update their time values

3. **LayerManager**:
   - Must handle layer selection and communicate with other components

4. **Code Structure**:
    - Event emitter must handle all logic with event. I will need to do EventEmitter.on(Events_Const.SOME_EVENT_CONST, this.myEventHandleFunction);.
      I must be able to do EventEmitter.off(Events_Const.SOME_EVENT_CONST, this.myEventHandleFunction); and the event emmiter keep track of the function reference and register the .bind(sender) by itself.
      Use a sender parametter in the EventEmitter.emit function. Like this: emit(name: string, sender: class, eventData:typedEventData)
      I wish that every events are avaliable also fully typed on the control and/or in the plugin and accesible like this: var offCallback = this.Events.OnSome_Event_Const(this.onSomeEventConst);.
      Every on function make a off before to be sure a event is not registered twice on the same handle.
    - Every plugin render the html and handle the action inside his class. It can call an action on a other plugin or register to event of other plugin but it canot raise event or add an event listener to a dom element rendered by an other plugin.

## Testing Requirements

Verify that:
1. The time ruler and keyframes container scroll together horizontally
2. The layers container and keyframes container scroll together vertically
3. Each layer have keyframes in the same row, aligned.
4. Keyframes have a grid like layout with vertical and horizontal line and is aligned with the time ruler at the top.
5. Adding, moving, and deleting keyframes works correctly
6. Zooming in/out updates all components properly
7. All components render themselves correctly
8. Events are properly propagated between components

## Best Practices

1. Use TypeScript interfaces for all component options and data types
2. Keep components focused on single responsibilities
3. Use constants for CSS class names, dimensions, and event names
4. Follow the plugin architecture pattern strictly
5. Each plugin should handle its own rendering
6. Use event communication for inter-plugin coordination
7. Use less for css style
8. Make comments when we need to test or revisit some parts of the code, you can't code all this in one shot.

## Changelog Requirements
1. Create a changelog entry for each significant update to the project
2. Store changelog files in a dedicated 'changelog' folder
3. Use the naming format: changelog_{smallTitle}_{date}_{Hour}-{minutes}.md
4. Include sections for: Added, Changed, Fixed, and Next Steps
5. Document all major component additions and modifications
6. Track technical details and implementation changes