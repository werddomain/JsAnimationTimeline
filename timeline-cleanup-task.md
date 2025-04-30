# Timeline Cleanup Task List

This document outlines the tasks required to refactor the TimelineGrid3D class by extracting components into separate classes for better organization, maintainability, and reusability.

## Initial Setup Tasks

- [ ] Create a new directory structure for the extracted components
  - [ ] Create `src/core/timeline-components` directory to house all extracted classes

## Component Extraction Tasks

### 1. PlaybackController Component
- [ ] Create `PlaybackController.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract properties: isPlaying, playInterval
  - [ ] Extract methods: togglePlay(), stopPlayback(), stepFrame(), attachPlaybackControls()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor that takes stateManager and eventManager dependencies

### 2. FrameNavigator Component
- [ ] Create `FrameNavigator.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract properties: suppressSync
  - [ ] Extract methods: seekToFrame(), ensureFrameVisible(), attachGotoFrame(), attachGotoTimeSync()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor that takes stateManager and eventManager dependencies

### 3. KeyframeManager Component
- [ ] Create `KeyframeManager.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract methods: toggleKeyframe(), renderTrackFrames()
  - [ ] Extract keyframe-related functionality from attachFrameSelection()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor that takes stateManager and eventManager dependencies

### 4. RulerRenderer Component
- [ ] Create `RulerRenderer.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract properties: rulerHeight, rulerEl
  - [ ] Extract methods: renderRuler()
  - [ ] Extract ruler-specific parts from syncRulerAndTracks()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor with necessary dependencies

### 5. TracksRenderer Component
- [ ] Create `TracksRenderer.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract properties: tracksEl, rowHeight
  - [ ] Extract methods: renderTracks(), updateActiveTrackRow()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor with necessary dependencies

### 6. PlayheadController Component
- [ ] Create `PlayheadController.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract properties: mouseMoveHandler, mouseUpHandler
  - [ ] Extract methods: attachPlayheadDrag(), updatePlayheadPosition()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor with necessary dependencies

### 7. TimelineScrollController Component
- [ ] Create `TimelineScrollController.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract properties: scrollContainer, scrollTimeout, scrollHandler
  - [ ] Extract methods: attachScrollHandler(), extendFramesAndRestoreScroll(), extendFrames()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor with necessary dependencies

### 8. TimelineConfigManager Component
- [ ] Create `TimelineConfigManager.ts` class
  - [ ] Add events that this component will emit and/or register to event this component need to respond to.
  - [ ] Extract properties: frameWidth, frameCount
  - [ ] Extract methods: attachFpsInput()
  - [ ] Create appropriate interfaces/types for the component
  - [ ] Add constructor with necessary dependencies

## Integration Tasks

- [ ] Refactor `TimelineGrid3D` class
  - [ ] Update imports to include new component classes
  - [ ] Replace extracted code with calls to component methods
  - [ ] Initialize component instances in the constructor
  - [ ] Update the render() method to coordinate the component interactions
  - [ ] Fix any broken references between components

## CSS/LESS Refactoring Tasks

- [ ] Create separate LESS files for each component
  - [ ] Create `playbackController.less` with relevant styles
  - [ ] Create `frameNavigator.less` with relevant styles
  - [ ] Create `keyframeManager.less` with relevant styles
  - [ ] Create `rulerRenderer.less` with relevant styles
  - [ ] Create `tracksRenderer.less` with relevant styles
  - [ ] Create `playheadController.less` with relevant styles
  - [ ] Create `timelineScrollController.less` with relevant styles

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
