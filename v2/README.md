# JsTimeLine Control

A feature-rich, Flash MX-style timeline control built with TypeScript and LESS. This control provides a professional animation timeline interface for web applications, with support for layers, keyframes, tweens, and playback control.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)

## ✨ Features

### Core Functionality
- **Layer Management**: Create, delete, rename, and organize layers in hierarchical folders
- **Keyframe System**: Insert content keyframes, blank keyframes, and standard frames
- **Tween Support**: Create and manage motion tweens between keyframes
- **Playback Engine**: Play, pause, stop, and scrub through animations at customizable frame rates
- **Drag & Drop**: Reorder layers and move keyframes across the timeline
- **Context Menus**: Right-click context menus for layers and frames (with touch support)
- **Selection System**: Single, multi-select (CTRL), and range select (Shift) for keyframes

### User Interface
- **Responsive Design**: Adapts to container size changes with configurable panel widths
- **Synchronized Scrolling**: Layer panel, ruler, and grid scroll together seamlessly
- **Visual Feedback**: Hover states, selection highlights, and drag indicators
- **Folder Navigation**: Expand/collapse folders with visual indicators
- **Mobile Support**: Touch-friendly three-dot menu for context actions on mobile devices

### Accessibility (WCAG 2.1 AA Compliant)
- **ARIA Support**: Full semantic structure with role attributes and labels
- **Keyboard Navigation**: Navigate layers with arrow keys, Enter, Space, and Delete
- **Focus Indicators**: Visible focus outlines on all interactive elements
- **Screen Reader Support**: Comprehensive aria-labels for all UI elements
- **Logical Tab Order**: Proper focus flow through the interface

### Advanced Features
- **Event System**: 19+ events for integrating with your application
- **Data Persistence**: Export/import timeline data as JSON
- **Performance Optimized**: Debounced scroll handlers and efficient rendering
- **Event Logger**: Built-in debugging tool for tracking all timeline events
- **Undo/Redo Ready**: Architecture designed for command pattern implementation

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Build

```bash
# Production build
npm run build

# Development build
npm run build:dev

# Watch mode
npm run watch

# Development server with hot reload
npm run debug
```

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>Timeline Demo</title>
</head>
<body>
    <div id="timeline-container"></div>
    
    <script src="dist/JsTimeLine.bundle.js"></script>
    <script>
        // Create timeline instance
        const timeline = new JsTimeLine.JsTimeLine('timeline-container');
        
        // Timeline is now ready to use!
    </script>
</body>
</html>
```

## 📚 API Documentation

### Creating a Timeline

```javascript
const timeline = new JsTimeLine.JsTimeLine('container-id');
```

### Configuration Options

```javascript
// Enable/disable playhead movement on frame click
timeline.setMovePlayheadOnFrameClick(true); // default: true

// Update panel sizes
timeline.updateLayerPanelWidth(300); // default: 250px
timeline.updateRulerHeight(50);      // default: 40px
```

### Data Management

```javascript
// Export timeline data
const jsonData = timeline.exportData();

// Import timeline data
timeline.importData(jsonData);

// Get timeline context
const context = timeline.getContext();
```

### Playback Control

```javascript
const context = timeline.getContext();
const playback = context.Core.playbackEngine;

// Control playback
playback.play();
playback.pause();
playback.stop();
playback.goToFrame(25);
```

### Layer Management

```javascript
const layerManager = context.Core.layerManager;

// Add layers
layerManager.addLayer('New Layer');
layerManager.addFolder('My Folder');

// Delete layer
layerManager.deleteObject(layerId);

// Rename layer
layerManager.renameObject(layerId, 'New Name');

// Toggle visibility/lock
layerManager.toggleVisibility(layerId);
layerManager.toggleLock(layerId);
```

### Keyframe Operations

```javascript
const keyframeManager = context.Core.keyframeManager;

// Insert keyframes
keyframeManager.insertKeyframe(layerId, frameNumber);
keyframeManager.insertBlankKeyframe(layerId, frameNumber);

// Delete keyframes
keyframeManager.deleteFrames(layerId, startFrame, endFrame);

// Move keyframes
keyframeManager.moveKeyframes([frameId1, frameId2], targetLayerId, frameOffset);

// Copy/paste keyframes
keyframeManager.copyKeyframes([frameId1, frameId2]);
keyframeManager.pasteKeyframes(targetLayerId, targetFrame);
```

### Tween Management

```javascript
const tweenManager = context.Core.tweenManager;

// Create motion tween
tweenManager.createMotionTween(layerId, startFrame, endFrame);

// Remove tween
tweenManager.removeTween(layerId, tweenIndex);

// Update tween properties
tweenManager.updateTween(layerId, tweenIndex, { type: 'ease-in' });
```

### Event Handling

```javascript
const eventManager = context.Core.eventManager;

// Listen to events
eventManager.on('onObjectAdd', (data) => {
    console.log('Layer added:', data);
});

eventManager.on('onKeyframeAdd', (data) => {
    console.log('Keyframe added:', data);
});

eventManager.on('onFrameEnter', (data) => {
    console.log('Current frame:', data.currentFrame);
});

// Enable event logging (for debugging)
const eventLogger = JsTimeLine.attachEventLogger(context);
eventLogger.enable();
```

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **F5** | Insert Frame |
| **Shift+F5** | Delete Frame |
| **F6** | Insert Keyframe (content) |
| **F7** | Insert Blank Keyframe |
| **Enter** | Toggle Play/Pause |
| **,** (comma) | Previous Frame |
| **.** (period) | Next Frame |
| **Ctrl+C** | Copy selected keyframes |
| **Ctrl+V** | Paste keyframes |
| **Delete** | Delete selected frames |
| **Arrow Keys** | Navigate layers (when layer panel focused) |
| **Ctrl+Click** | Toggle selection |
| **Shift+Click** | Range selection |

## 📋 Events Reference

### Layer Events
- `onObjectAdd` - Layer or folder added
- `onBeforeObjectDelete` - Before layer deletion (cancellable)
- `onObjectDelete` - Layer or folder deleted
- `onObjectRename` - Layer renamed
- `onObjectReparent` - Layer moved to different parent
- `onObjectReorder` - Layer order changed
- `onObjectVisibilityChange` - Layer visibility toggled
- `onObjectLockChange` - Layer lock state toggled
- `onLayerSelect` - Layer selected

### Keyframe Events
- `onKeyframeAdd` - Keyframe added
- `onBeforeKeyframeDelete` - Before keyframe deletion (cancellable)
- `onKeyframeDelete` - Keyframe deleted
- `onKeyframeMove` - Keyframe moved
- `onKeyframeSelect` - Keyframe selected

### Tween Events
- `onTweenAdd` - Motion tween created
- `onTweenRemove` - Motion tween removed
- `onTweenUpdate` - Tween properties updated

### Playback Events
- `onPlaybackStart` - Playback started
- `onPlaybackPause` - Playback paused
- `onTimeSeek` - Playhead moved manually
- `onFrameEnter` - Entered new frame during playback

## 🏗️ Project Structure

```
v2/
├── src/
│   ├── core/              # Core managers (Layer, Keyframe, Tween, etc.)
│   ├── ui/                # UI components (LayerPanel, TimelineGrid, etc.)
│   ├── utils/             # Utilities (Performance, EventLogger)
│   ├── data/              # Data models and interfaces
│   ├── styles/            # LESS stylesheets
│   └── JsTimeLine.ts      # Main entry point
├── dist/                  # Compiled output
├── doc/                   # Documentation
├── index.html             # Test page
└── package.json
```

## 🎨 Architecture

The project follows a **Context Architecture Pattern**:
- **No Prop Drilling**: All components access shared state via `IJsTimeLineContext`
- **Event-Driven**: Components communicate through `EventManager`
- **Separation of Concerns**: UI components are separate from business logic
- **Type Safety**: Full TypeScript with strict mode enabled
- **Style Isolation**: All styles in LESS files (no inline styles)

### Key Components

- **JsTimeLine**: Main control class
- **LayerPanel**: Layer hierarchy and management
- **TimelineGrid**: Frame visualization and interaction
- **TimeRuler**: Frame numbers and playhead dragging
- **PlaybackEngine**: Animation playback control
- **LayerManager**: Layer CRUD operations
- **KeyframeManager**: Keyframe operations
- **TweenManager**: Tween creation and management
- **SelectionManager**: Frame selection state
- **StateManager**: Persistent state storage
- **EventManager**: Event pub/sub system

## 🛠️ Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Development Workflow

```bash
# Install dependencies
npm install

# Start development server
npm run debug

# Build for production
npm run build

# Watch mode for development
npm run watch
```

### Testing

Open `index.html` in a browser after building. The test page includes:
- Interactive timeline with sample data
- Event logger with real-time event tracking
- Configuration toggles
- Export/import functionality

## 🎯 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📦 Data Format

Timeline data uses a hierarchical JSON structure:

```json
{
  "version": "1.0.0",
  "settings": {
    "totalFrames": 100,
    "frameRate": 24,
    "frameWidth": 15,
    "rowHeight": 30,
    "layerPanelWidth": 250,
    "rulerHeight": 40,
    "movePlayheadOnFrameClick": true
  },
  "layers": [
    {
      "id": "layer-1",
      "name": "Background",
      "type": "layer",
      "visible": true,
      "locked": false,
      "keyframes": [
        { "frame": 1, "isEmpty": false },
        { "frame": 10, "isEmpty": false }
      ],
      "tweens": [
        { "startFrame": 1, "endFrame": 10, "type": "linear" }
      ]
    },
    {
      "id": "folder-1",
      "name": "Character",
      "type": "folder",
      "children": [
        {
          "id": "layer-2",
          "name": "Head",
          "type": "layer",
          "keyframes": [],
          "tweens": []
        }
      ]
    }
  ]
}
```

## 🤝 Contributing

Contributions are welcome! Please ensure:
1. All TypeScript code is strictly typed (no `any`)
2. All styles are in LESS files (no inline styles)
3. Follow the Context architecture pattern
4. Add JSDoc comments for public APIs
5. Test changes with the included test page

## 📄 License

MIT License - feel free to use in personal and commercial projects.

## 🔮 Roadmap

### Completed ✅
- Core timeline rendering
- Layer management (CRUD, drag & drop)
- Keyframe operations
- Motion tweens
- Playback engine
- Context menus
- Selection system
- Event system
- Data persistence
- Responsive design
- Accessibility (WCAG 2.1 AA)

### Planned 🚧
- Undo/Redo system
- Onion skinning
- Frame markers and labels
- Multiple tween types (ease-in, ease-out, etc.)
- Layer effects and filters
- Timeline zoom controls
- Multi-track audio visualization
- Plugin system for extensions

## 📞 Support

For issues, questions, or feature requests, please use the GitHub issue tracker.

---

**Built with TypeScript, LESS, and ❤️**
