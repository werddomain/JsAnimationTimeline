# Timeline Cleanup Task List

This document outlines the tasks required to refactor the TimelineGrid3D class by extracting components into separate classes for better organization, maintainability, and reusability.

## Initial Setup Tasks

- [x] Create a new directory structure for the extracted components
  - [x] Create `src/core/timeline-components` directory to house all extracted classes

## Component Extraction Tasks

### 1. PlaybackController Component
- [x] Create `PlaybackController.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract properties: isPlaying, playInterval
  - [x] Extract methods: togglePlay(), stopPlayback(), stepFrame(), attachPlaybackControls()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor that takes stateManager and eventManager dependencies

### 2. FrameNavigator Component
- [x] Create `FrameNavigator.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract properties: suppressSync
  - [x] Extract methods: seekToFrame(), ensureFrameVisible(), attachGotoFrame(), attachGotoTimeSync()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor that takes stateManager and eventManager dependencies

### 3. KeyframeManager Component
- [x] Create `KeyframeManager.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract methods: toggleKeyframe(), renderTrackFrames()
  - [x] Extract keyframe-related functionality from attachFrameSelection()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor that takes stateManager and eventManager dependencies

### 4. RulerRenderer Component
- [x] Create `RulerRenderer.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract properties: rulerHeight, rulerEl
  - [x] Extract methods: renderRuler()
  - [x] Extract ruler-specific parts from syncRulerAndTracks()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor with necessary dependencies

### 5. TracksRenderer Component
- [x] Create `TracksRenderer.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract properties: tracksEl, rowHeight
  - [x] Extract methods: renderTracks(), updateActiveTrackRow()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor with necessary dependencies

### 6. PlayheadController Component
- [x] Create `PlayheadController.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract properties: mouseMoveHandler, mouseUpHandler
  - [x] Extract methods: attachPlayheadDrag(), updatePlayheadPosition()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor with necessary dependencies

### 7. TimelineScrollController Component
- [x] Create `TimelineScrollController.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract properties: scrollContainer, scrollTimeout, scrollHandler
  - [x] Extract methods: attachScrollHandler(), extendFramesAndRestoreScroll(), extendFrames()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor with necessary dependencies

### 8. TimelineConfigManager Component
- [x] Create `TimelineConfigManager.ts` class
  - [x] Add events that this component will emit and/or register to event this component need to respond to.
  - [x] Extract properties: frameWidth, frameCount
  - [x] Extract methods: attachFpsInput()
  - [x] Create appropriate interfaces/types for the component
  - [x] Add constructor with necessary dependencies

## Integration Tasks

- [x] Refactor `TimelineGrid3D` class
  - [x] Update imports to include new component classes
  - [x] Replace extracted code with calls to component methods
  - [x] Initialize component instances in the constructor
  - [x] Update the render() method to coordinate the component interactions
  - [x] Fix any broken references between components

## CSS/LESS Refactoring Tasks

- [x] Create separate LESS files for each component
  - [x] Create `playbackController.less` with relevant styles
  - [x] Create `frameNavigator.less` with relevant styles
  - [x] Create `keyframeManager.less` with relevant styles
  - [x] Create `rulerRenderer.less` with relevant styles
  - [x] Create `tracksRenderer.less` with relevant styles
  - [x] Create `playheadController.less` with relevant styles
  - [x] Create `timelineScrollController.less` with relevant styles

## Testing and Documentation Tasks

- [ ] Update imports in all files that use TimelineGrid3D
- [ ] Test each component individually
- [ ] Test the integrated TimelineGrid3D with all components
- [ ] Add JSDoc documentation to all new classes and methods
- [ ] Create a component diagram showing the relationships between components

## Final Verification Tasks

- [ ] Ensure all components have proper interfaces/types defined
- [ ] Verify that all dependencies are properly injected
- [ ] Check that all events are properly handled between components
- [ ] Verify that no functionality has been lost in the refactoring
- [ ] Check for any performance improvements or regressions
