# Timeline Grid Component Extraction

The following components from the `TimelineGrid3D` class in `timelineGrid.ts` could be extracted into separate classes to improve code organization, maintainability, and reusability:

## 1. PlaybackController
Responsible for managing the timeline playback functionality.

**Methods/Properties to extract:**
- isPlaying (property)
- playInterval (property)
- togglePlay()
- stopPlayback()
- stepFrame()
- attachPlaybackControls()

## 2. FrameNavigator
Handles frame navigation, seeking, and visibility within the viewport.

**Methods/Properties to extract:**
- seekToFrame()
- ensureFrameVisible()
- attachGotoFrame()
- attachGotoTimeSync()
- suppressSync (property)

## 3. KeyframeManager
Manages keyframe operations and rendering.

**Methods/Properties to extract:**
- toggleKeyframe()
- renderTrackFrames() - keyframe-specific parts
- attachFrameSelection() - keyframe toggle functionality

## 4. RulerRenderer
Handles the rendering and behavior of the timeline ruler.

**Methods/Properties to extract:**
- rulerHeight (property)
- rulerEl (property)
- renderRuler()
- syncRulerAndTracks() - ruler-specific parts

## 5. TracksRenderer
Responsible for rendering and managing track rows.

**Methods/Properties to extract:**
- tracksEl (property)
- rowHeight (property)
- renderTracks()
- updateActiveTrackRow()

## 6. PlayheadController
Manages the playhead element and its interactions.

**Methods/Properties to extract:**
- attachPlayheadDrag()
- updatePlayheadPosition()
- mouseMoveHandler (property)
- mouseUpHandler (property)

## 7. TimelineScrollController
Manages scrolling behaviors and frame extension when scrolling.

**Methods/Properties to extract:**
- scrollContainer (property)
- scrollTimeout (property)
- scrollHandler (property)
- attachScrollHandler()
- extendFramesAndRestoreScroll()
- extendFrames()

## 8. TimelineConfigManager
Handles configuration aspects like FPS settings.

**Methods/Properties to extract:**
- frameWidth (property)
- frameCount (property)
- attachFpsInput()

## Benefits of this Extraction:

1. **Improved code organization** - Each class has a single responsibility
2. **Better testability** - Smaller, focused components are easier to test
3. **Reduced complexity** - The main TimelineGrid3D class becomes a coordinator rather than doing everything
4. **Easier maintenance** - Changes to one aspect don't require understanding the entire class
5. **Code reuse** - Some components could be reused in other parts of the application

Each extracted class should receive dependencies (stateManager, eventManager) as needed through their constructors and should expose a clear public API.
