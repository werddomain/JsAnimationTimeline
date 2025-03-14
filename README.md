# JavaScript Timeline Control

A flexible timeline control for JavaScript/TypeScript applications, inspired by the timeline in Flash CS4. This control provides a comprehensive timeline interface for animation authoring and playback.

## Features

- Table-like interface with objects as rows and time as columns
- Keyframe creation, editing, and motion tweens
- Hierarchical object grouping
- Object properties (visibility, locking, naming, color)
- Dynamic timeline that extends as needed
- Playback controls (play, pause, stop)
- Type-safe event system
- Customizable zoom/time scale
- GoTo time functionality

## Installation

```bash
npm install js-timeline-control
```

## Usage

### Basic Setup

```html
<div id="timeline-container" style="width: 100%; height: 300px;"></div>

<script type="module">
  import { TimelineControl, TimelineConstants } from 'js-timeline-control';
  
  const timelineContainer = document.getElementById('timeline-container');
  const timeline = new TimelineControl({
    container: timelineContainer,
    duration: 60, // 1 minute initial duration
    initialLayers: [
      {
        name: 'Background',
        visible: true,
        locked: false,
        color: '#42A5F5'
      },
      {
        name: 'Character',
        visible: true,
        locked: false, 
        color: '#66BB6A'
      }
    ]
  });
  
  // Add keyframes
  const layers = timeline.getDataModel().getLayers();
  if (layers.length > 0) {
    timeline.addKeyframe(layers[0].id, {
      time: 1,
      properties: { x: 100, y: 100 }
    });
    
    timeline.addKeyframe(layers[0].id, {
      time: 5,
      properties: { x: 300, y: 200 }
    });
  }
  
  // Start playback
  timeline.play();
</script>
```

## API Reference

### TimelineControl

The main entry point for the timeline control.

#### Constructor

```typescript
new TimelineControl(options: TimelineOptions)
```

**Options:**
- `container`: HTMLElement - The container element
- `width?`: number - Width in pixels (defaults to container width)
- `height?`: number - Height in pixels (defaults to container height)
- `duration?`: number - Initial duration in seconds (defaults to 600)
- `initialLayers?`: Layer[] - Initial layers to add

#### Methods

**Layer Operations:**
- `addLayer(layer: Omit<Layer, 'id'>): Layer | null` - Add a new layer
- `getDataModel(): TimelineDataModel` - Get the data model

**Keyframe Operations:**
- `addKeyframe(layerId: string, keyframe: Omit<Keyframe, 'id'>): Keyframe | null` - Add a keyframe
- `addMotionTween(layerId: string, tween: Omit<MotionTween, 'id'>): MotionTween | null` - Add a motion tween

**Playback:**
- `play(): void` - Start playback
- `pause(): void` - Pause playback
- `stop(): void` - Stop playback and return to beginning
- `setCurrentTime(time: number, extendDuration = true): void` - Set the current time
- `getCurrentTime(): number` - Get the current time
- `goToTime(time: number): void` - Go to a specific time

**Access Objects at Current Time:**
- `getKeyframesAtTime(time?: number, tolerance = 0.1): Array<{layerId: string, keyframe: Keyframe}>` - Get keyframes at a specific time
- `getObjectsAtTime(time?: number): Array<{layer: Layer, properties: Record<string, any>}>` - Get objects with their state at a specific time

**Import/Export:**
- `exportData(): string` - Export timeline data as JSON
- `importData(json: string): void` - Import timeline data from JSON

**Other:**
- `setTimeScale(scale: number): void` - Set the zoom level
- `resize(width: number, height: number): void` - Resize the timeline
- `on<T extends keyof TimelineEventMap>(eventName: T, callback: TimelineEventListener<T>): () => void` - Register an event listener

### Events

The timeline control uses a type-safe event system. Events can be listened to using the `on` method:

```typescript
timeline.on(TimelineConstants.EVENTS.TIME_CHANGE, (time) => {
  console.log(`Current time: ${time}`);
});

timeline.on(TimelineConstants.EVENTS.KEYFRAME_USER_CREATED, (layerId, time) => {
  console.log(`User created keyframe at ${time}s on layer ${layerId}`);
});
```

Available events:

**Playback events:**
- `PLAY`: () => void
- `PAUSE`: () => void
- `STOP`: () => void
- `TIME_CHANGE`: (time: number) => void
- `DURATION_CHANGE`: (duration: number) => void
- `SEEK_TO_TIME`: (time: number) => void

**Layer events:**
- `LAYER_ADDED`: (layer: Layer) => void
- `LAYER_UPDATED`: (layer: Layer) => void
- `LAYER_REMOVED`: (layerId: string) => void
- `LAYER_SELECTED`: (layerId: string, isMultiSelect: boolean) => void
- `LAYER_MOVED`: (layerId: string, newIndex: number) => void
- `LAYER_VISIBILITY_CHANGED`: (layerId: string, visible: boolean) => void
- `LAYER_LOCK_CHANGED`: (layerId: string, locked: boolean) => void
- `LAYER_COLOR_CHANGED`: (layerId: string, color: string) => void
- `LAYER_NAME_CHANGED`: (layerId: string, name: string) => void

**Keyframe events:**
- `KEYFRAME_ADDED`: (layerId: string, keyframe: Keyframe) => void
- `KEYFRAME_UPDATED`: (layerId: string, keyframe: Keyframe) => void
- `KEYFRAME_REMOVED`: (layerId: string, keyframeId: string) => void
- `KEYFRAME_SELECTED`: (layerId: string, keyframeId: string, isMultiSelect: boolean) => void
- `KEYFRAME_MOVED`: (layerId: string, keyframeId: string, newTime: number) => void
- `KEYFRAME_USER_CREATED`: (layerId: string, time: number) => void

**Motion tween events:**
- `TWEEN_ADDED`: (layerId: string, tween: MotionTween) => void
- `TWEEN_UPDATED`: (layerId: string, tween: MotionTween) => void
- `TWEEN_REMOVED`: (layerId: string, tweenId: string) => void
- `TWEEN_USER_CREATED`: (layerId: string, startKeyframeId: string, endKeyframeId: string) => void

**UI events:**
- `ZOOM_CHANGED`: (scale: number) => void
- `RESIZE`: (width: number, height: number) => void
- `DATA_IMPORTED`: () => void
- `DATA_EXPORTED`: (data: string) => void

### Data Model

The data model consists of the following key interfaces:

#### Layer

```typescript
interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  keyframes: Keyframe[];
  motionTweens: MotionTween[];
  isSelected: boolean;
  parentId?: string;       // For hierarchical grouping
  children?: Layer[];      // For hierarchical grouping
  isExpanded?: boolean;    // UI state for groups
  [key: string]: any;      // Extensible with custom properties
}
```

#### Keyframe

```typescript
interface Keyframe {
  id: string;
  time: number;
  properties: Record<string, any>;
  isSelected: boolean;
}
```

#### MotionTween

```typescript
interface MotionTween {
  id: string;
  startKeyframeId: string;
  endKeyframeId: string;
  easingFunction?: string;
  properties: Record<string, any>;
}
```

### Extending the Timeline

The timeline control is designed to be highly extensible. You can add custom properties to layers and keyframes, and use the events to integrate with your application.

#### Custom Properties Example

```typescript
// Add a custom layer with additional properties
timeline.addLayer({
  name: 'Custom Layer',
  visible: true,
  locked: false,
  color: '#FF5252',
  keyframes: [],
  motionTweens: [],
  // Custom properties
  customProperty: 'value',
  metadata: {
    createdBy: 'User',
    tags: ['important', 'animation']
  }
});

// Add a keyframe with custom properties
timeline.addKeyframe(layerId, {
  time: 2,
  properties: {
    x: 100,
    y: 200,
    // Custom animation properties
    opacity: 0.5,
    rotation: 45,
    scale: 1.2,
    customTransform: { skewX: 10, skewY: 5 },
    // Metadata
    description: 'Start of animation'
  }
});
```

#### Animation Integration Example

```typescript
// Update your animation based on timeline state
timeline.on(TimelineConstants.EVENTS.TIME_CHANGE, (time) => {
  // Get all objects at current time
  const objects = timeline.getObjectsAtTime();
  
  objects.forEach(({ layer, properties }) => {
    // Find your animation objects by layer ID or name
    const animationObject = findMyAnimationObject(layer.id);
    
    // Apply properties from timeline to your animation
    if (animationObject) {
      Object.assign(animationObject, properties);
      
      // Or apply specific properties
      if (properties.x !== undefined) animationObject.x = properties.x;
      if (properties.y !== undefined) animationObject.y = properties.y;
      if (properties.rotation !== undefined) animationObject.rotation = properties.rotation;
      if (properties.scale !== undefined) animationObject.scale = properties.scale;
      if (properties.opacity !== undefined) animationObject.opacity = properties.opacity;
      
      // Update your display
      renderScene();
    }
  });
});
```

## Dynamic Duration

The timeline automatically extends its duration when:

1. Adding keyframes beyond the current duration
2. Moving keyframes beyond the current duration
3. During playback when approaching the end

This behavior can be controlled via the `extendDuration` parameter in the `setCurrentTime` method.

## Advanced Features

### Go To Time

The timeline includes a "Go to Time" input in the toolbar. Users can enter time in MM:SS.ms or SS.ms format to quickly navigate to specific points in the timeline.

### Hierarchical Grouping

Layers can be organized into groups:

```typescript
// Create a parent group
const groupLayer = timeline.addLayer({
  name: 'Character Group',
  visible: true,
  locked: false,
  color: '#FF5252',
  isExpanded: true
});

// Add child layers
const headLayer = timeline.addLayer({
  name: 'Head',
  visible: true,
  locked: false,
  color: '#42A5F5',
  parentId: groupLayer.id  // Reference to parent
});

const bodyLayer = timeline.addLayer({
  name: 'Body',
  visible: true,
  locked: false,
  color: '#66BB6A',
  parentId: groupLayer.id  // Reference to parent
});
```

## Browser Support

This timeline control is compatible with all modern browsers that support ES2018 or later.

## Architecture

### Plugin-Based Design

The timeline control uses a plugin-based architecture where each component is a self-contained module responsible for:

1. **Rendering its own HTML** - Each component defines its own structure and appearance
2. **Managing its own events** - Components handle their own user interactions
3. **Maintaining its own state** - Components keep track of their internal state

This architecture makes the codebase more maintainable and allows for easy extension or replacement of individual components.

### Key Components

- **TimelineControl** - Main entry point and coordinator
- **PluginManager** - Manages component registration and lifecycle
- **MainToolbar** - Provides playback controls and tools
- **LayerManager** - Handles object/layer management
- **KeyframeManager** - Manages keyframes and motion tweens
- **TimeRuler** - Displays the time scale and handles time navigation
- **ObjectToolbar** - Manages layer/object creation and organization

### Styling with LESS

Styles are organized using LESS with a similar modular approach:

1. **Variables** - Shared colors, dimensions, etc. defined once
2. **Component-Specific Styles** - Each component has its own LESS file
3. **Core Styles** - Basic shared styles for the control
4. **Utilities** - Reusable utility classes

This approach makes it easy to maintain and extend the visual aspects of the control.

## Extending the Control

### Creating Custom Components

You can create custom components by extending the BaseComponent class:

```typescript
import { Component } from 'js-timeline-control';

export class MyCustomComponent extends Component {
  constructor(container, id) {
    super(container, id);
    // Initialize your component
  }
  
  render() {
    return `
      <div id="${this.elementId}" class="my-custom-component">
        <!-- Your component HTML -->
      </div>
    `;
  }
  
  update(data) {
    // Update your component with new data
  }
  
  // Add your component-specific methods
}
```

### Registering Custom Components

Register your custom component with the plugin manager:

```typescript
const timeline = new TimelineControl({
  container: document.getElementById('timeline-container')
});

// Create and register your custom component
const myComponent = new MyCustomComponent(someContainer, 'myCustomComponent');
timeline.pluginManager.register('myCustomComponent', myComponent);
```

### Adding Custom Styles

Create a LESS file for your component and import it in the main LESS file:

```less
// In your-component.less
.my-custom-component {
  // Your component styles
}

// In timeline.less
@import "components/your-component.less";
```

## Visual Panel Component

The timeline control includes an optional visual panel component that provides a canvas where HTML div elements can be created and linked to timeline layers.

### Features

- Create and manage div elements linked to timeline layers
- Drag, resize, and rotate elements
- Automatic synchronization with timeline keyframes
- Add custom content to elements
- Element properties (position, size, rotation, opacity) are automatically animated based on keyframes

### Usage

```typescript
import { TimelineControl } from 'js-timeline-control';
import { PanelComponent } from 'js-timeline-control/plugins/panel/PanelComponent';

// Create timeline instance
const timeline = new TimelineControl({
  container: document.getElementById('timeline-container')
});

// Create panel instance
const panel = new PanelComponent({
  container: document.getElementById('panel-container'),
  eventEmitter: timeline.getEventEmitter(),
  onLayerAdd: (name, color) => {
    // Create a new layer when an element is added
    const layer = timeline.addLayer({
      name, color, visible: true, locked: false
    });
    return layer ? layer.id : '';
  },
  onElementSelect: (layerId) => {
    // Select the layer when an element is selected
    timeline.selectLayer(layerId);
  }
});

// Register panel with timeline
timeline.pluginManager.register('panel', panel);

// Listen for keyframe updates from panel
timeline.on('panel:element:updated', (element, time) => {
  // Update or create keyframe for the element
  timeline.addKeyframe(element.layerId, {
    time: time,
    properties: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      opacity: element.opacity
    }
  });
});
```

### Adding Elements Programmatically

```typescript
// Add a new element linked to a layer
panel.addElement({
  layerId: 'layer-id',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  content: '<div style="width:100%;height:100%;">Content</div>'
});
```

### Styling Panel Elements

Panel elements automatically use the color of their associated layer as their background color. You can customize the appearance further by adding custom content:

```typescript
panel.addElement({
  layerId: 'layer-id',
  // ... other properties
  content: `
    <div style="
      width: 100%; 
      height: 100%; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      background: linear-gradient(to bottom, rgba(255,255,255,0.2), transparent);
      border-radius: 8px;
      font-weight: bold;
      color: white;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    ">
      Custom Element
    </div>
  `
});
```



### Property Editor

The timeline control includes a powerful property editor for manipulating CSS properties of panel elements. This editor provides a user-friendly interface for setting and animating a wide range of CSS properties.

#### Features

- Comprehensive property groups (Position & Size, Transform, Appearance, Text, Filters, Layout)
- Support for all animatable CSS properties
- Real-time preview of property changes
- Automatic keyframe creation when properties are modified
- Collapsible property groups for easy organization

#### Usage

```typescript
import { TimelineControl } from 'js-timeline-control';
import { PanelComponent } from 'js-timeline-control/plugins/panel/PanelComponent';
import { PropertyEditor } from 'js-timeline-control/plugins/panel/PropertyEditor';

// Create timeline instance
const timeline = new TimelineControl({
  container: document.getElementById('timeline-container')
});

// Create panel instance
const panel = new PanelComponent({
  container: document.getElementById('panel-container'),
  eventEmitter: timeline.getEventEmitter(),
  // Panel options...
});

// Create property editor instance
const propertyEditor = new PropertyEditor({
  container: document.getElementById('editor-container'),
  eventEmitter: timeline.getEventEmitter(),
  onPropertyChange: (elementId, property, value) => {
    // Update element property
    panel.updateElementProperty(elementId, property, value);
    
    // Create keyframe at current time with the updated property
    const element = panel.getElements().find(e => e.id === elementId);
    if (element) {
      timeline.addKeyframe(element.layerId, {
        time: timeline.getCurrentTime(),
        properties: { [property]: value }
      });
    }
  }
});

// Register components with timeline
timeline.pluginManager.register('panel', panel);
timeline.pluginManager.register('propertyEditor', propertyEditor);
```

#### Supported Properties

The property editor supports a wide range of CSS properties including:

**Transform Properties:**
- Rotation
- Scale (X and Y)
- Translate (X and Y)
- Skew (X and Y)

**Appearance Properties:**
- Opacity
- Background Color
- Border (Width, Color, Radius)
- Box Shadow (X, Y, Blur, Spread, Color)

**Text Properties:**
- Color
- Font Size
- Font Weight
- Font Family
- Text Align
- Line Height
- Letter Spacing
- Text Shadow

**Filter Properties:**
- Blur
- Brightness
- Contrast
- Grayscale
- Hue Rotate
- Invert
- Saturate
- Sepia

**Layout Properties:**
- Display
- Overflow
- Justify Content
- Align Items
- Flex Direction

#### Animating CSS Properties

All properties set in the property editor can be animated through keyframes. The timeline smoothly interpolates property values between keyframes, creating fluid animations:

```typescript
// Add keyframes for color animation
timeline.addKeyframe(layerId, {
  time: 0,
  properties: {
    color: '#ffffff',
    fontSize: 16,
    rotation: 0
  }
});

timeline.addKeyframe(layerId, {
  time: 5,
  properties: {
    color: '#ff0000',
    fontSize: 24,
    rotation: 45
  }
});
```

The property editor makes it easy to create sophisticated animations that would otherwise require extensive CSS knowledge and coding.




## CSS Animation Generation

The timeline control includes a powerful CSS animation generator that can convert motion tweens into standard CSS animations. This allows you to create complex animations visually and then export them as CSS for use in your web projects.

### Features

- Generate CSS `@keyframes` animations from motion tweens
- Preview animations in real-time
- Second-by-second visualization of animation states
- Export animations to CSS files
- Support for all CSS animatable properties
- Apply different easing functions to animations

### MotionTweenPreview Component

The MotionTweenPreview component provides a visual preview of animations:

```typescript
import { TimelineControl } from 'js-timeline-control';
import { MotionTweenPreview } from 'js-timeline-control/plugins/panel/MotionTweenPreview';

// Create timeline instance
const timeline = new TimelineControl({
  container: document.getElementById('timeline-container')
});

// Create motion tween preview
const motionTweenPreview = new MotionTweenPreview({
  container: document.getElementById('preview-container'),
  eventEmitter: timeline.getEventEmitter()
});

// Register the preview component
timeline.pluginManager.register('motionTweenPreview', motionTweenPreview);
```

### CSS Animation Generator

The CSS Animation Generator can be used programmatically to generate CSS from keyframes and motion tweens:

```typescript
import { CssAnimationGenerator } from 'js-timeline-control/plugins/panel/CssAnimationGenerator';

// Generate CSS from a motion tween
const result = CssAnimationGenerator.generateFromTween(layer, tween, {
  name: 'button-animation',
  duration: 0.5,
  timingFunction: 'ease-out',
  iterationCount: 1,
  direction: 'normal',
  fillMode: 'forwards'
});

console.log(result.css);         // The generated CSS
console.log(result.animationName); // The animation name

// Generate CSS from multiple keyframes
const result = CssAnimationGenerator.generateFromMultipleKeyframes(
  layer.keyframes,
  { name: 'multi-step-animation' }
);

// Export all animations for a layer
const result = CssAnimationGenerator.exportLayerAnimation(layer, {
  duration: 2,
  iterationCount: 'infinite'
});
```

### Integrating with HTML Elements

The motion tween preview automatically creates animation classes that can be applied to any HTML element:

```html
<!-- In your HTML -->
<div class="my-button-animation">Click Me</div>
```

```css
/* Generated CSS */
@keyframes my-button-animation {
  0% {
    transform: scale(1);
    background-color: #42A5F5;
    box-shadow: 0 4px 8px 0 rgba(0,0,0,0.3);
  }
  100% {
    transform: scale(0.95);
    background-color: #1E88E5;
    box-shadow: 0 2px 4px 0 rgba(0,0,0,0.3);
  }
}

.my-button-animation {
  animation-name: my-button-animation;
  animation-duration: 0.3s;
  animation-timing-function: ease-out;
  animation-iteration-count: 1;
  animation-direction: normal;
  animation-fill-mode: forwards;
}
```

### Preview at Specific Time Points

You can also generate the exact CSS state at any point in the animation:

```typescript
// Get properties at 50% of the animation
const properties = CssAnimationGenerator.generatePreviewAtProgress(
  layer,
  tween,
  0.5  // 50% through the animation
);

console.log(properties); // Object with interpolated property values
```

This feature makes it easy to visualize and export complex CSS animations created in the timeline interface.