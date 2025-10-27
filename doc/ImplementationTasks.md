# **JsTimeLine Control: Implementation Task List**

This document outlines the step-by-step tasks to build the JsTimeLine control's core functionality, starting after the initial project setup.

**To GitHub Copilot:** Please follow each prompt. After you complete the actions described in a prompt, please add ✅ \*\*Task Completed\*\* at the end of that task's section.

### **Phase 7: Core Layout & Styling**

**Note:** This phase is critical. We must implement the three-part layout specified in Section 1.1 of the Création Contrôle Timeline...md spec. The layout consists of a fixed-width Layer Panel (left), a fixed-height Time Ruler (top), and a main Timeline Grid (center) that scrolls in both directions, synchronizing with the panel and ruler.

**Task 7.1: Create the HTML Structure**

Prompt:  
"Copilot, modify src/JsTimeLine.ts. Update the constructor to clear the 'hello world' innerHTML and build the core three-part DOM structure.  
The structure inside the this.container (which has the .JsTimeLine class) should be:

\<div class="timeline-layout-grid"\>  
  \<\!-- Top-left empty corner \--\>  
  \<div class="timeline-corner"\>\</div\>  
    
  \<\!-- Top: Time Ruler (fixed height, scrolls horizontally) \--\>  
  \<div class="timeline-ruler"\>  
    \<div class="timeline-ruler-content"\>\</div\>  
    \<div class="timeline-playhead"\>\</div\>  
  \</div\>  
    
  \<\!-- Left: Layer Panel (fixed width, scrolls vertically) \--\>  
  \<div class="timeline-layer-panel"\>  
    \<div class="timeline-layer-content"\>\</div\>  
  \</div\>  
    
  \<\!-- Main: Timeline Grid (scrolls in both directions) \--\>  
  \<div class="timeline-grid-container"\>  
    \<div class="timeline-grid-content"\>\</div\>  
  \</div\>  
\</div\>

Store references to these new elements (e.g., this.ui.rulerContainer, this.ui.layerPanelContainer, this.ui.gridContainer) for later use. We will implement the Context object properly in the next phase."

✅ **Task Completed**

**Task 7.2: Implement the Core Layout CSS**

Prompt:  
"Copilot, open src/styles/JsTimeLine.less and replace the 'hello world' styles. Implement the CSS Grid layout for .timeline-layout-grid as described in Task 7.1.  
**Key Requirements:**

1. The .JsTimeLine class should be the root.  
2. .timeline-layout-grid must use display: grid.  
3. Define grid-template-columns for a fixed-width layer panel (e.g., 250px) and a flexible grid area (1fr).  
4. Define grid-template-rows for a fixed-height ruler (e.g., 40px) and a flexible grid area (1fr).  
5. The .timeline-grid-container MUST be the *only* element with overflow: auto; (or scroll).  
6. The .timeline-ruler and .timeline-layer-panel MUST have overflow: hidden; to prevent them from showing their own scrollbars. We will scroll their *content* (e.g., .timeline-ruler-content) manually with JavaScript.  
7. Add placeholder styles (borders, background colors) for all 4 grid areas so we can see the layout."

✅ **Task Completed**

### **Phase 8: Core Context & Data Model**

**Task 8.1: Define Data Interfaces**

Prompt:  
"Copilot, create a new file src/data/ITimeLineData.ts. Based on Section 7.1 of the Création Contrôle Timeline...md spec, define the TypeScript interfaces for our data model:

* ITimeLineSettings  
* IKeyframe  
* ITween  
* ILayer (this must be recursive, with an optional children: ILayer\[\] property for folders)  
* ITimeLineData (the root object containing version, settings, and layers: ILayer\[\])"

✅ **Task Completed**

**Task 8.2: Implement Data Manager**

Prompt:  
"Copilot, update src/data/TimeLineData.ts.

1. Import the new interfaces from ITimeLineData.ts.  
2. Create a TimeLineData class.  
3. It should have a private \_data: ITimeLineData property.  
4. Add a load(data: ITimeLineData) method to set the data.  
5. Add a getData(): Readonly\<ITimeLineData\> method to retrieve the data, fulfilling the 'read-only' requirement from the guidelines.  
6. Add a constructor that takes a default empty ITimeLineData object."

✅ **Task Completed**

**Task 8.3: Define and Instantiate the Context**

Prompt:  
"Copilot, update src/IJsTimeLineContext.ts. Flesh out the interface based on our guidelines and files:

* UI: Should hold HTMLElement references for root, rulerContainer, layerPanelContainer, gridContainer, etc.  
* Core: Should hold EventManager and StateManager.  
* Plugins: Should be { \[key: string\]: IPlugin }.  
* Data: Should be an instance of our TimeLineData class.

Then, update src/JsTimeLine.ts. In the constructor:

1. Instantiate the main \_context: IJsTimeLineContext object.  
2. Instantiate EventManager, StateManager, and TimeLineData.  
3. Populate the \_context.Core and \_context.Data properties.  
4. Populate the \_context.UI properties with the DOM elements created in Task 7.1."

✅ **Task Completed**

### **Phase 9: Render Layer Panel**

**Task 9.1: Create LayerPanel UI Class**

Prompt:  
"Copilot, create a new file src/ui/LayerPanel.ts.

1. Create a LayerPanel class.  
2. It should take IJsTimeLineContext in its constructor and store it.  
3. Create a public render() method.  
4. Inside render(), get the layer data from this.\_context.Data.getData().  
6. Get the .timeline-layer-content container element: this.\_context.UI.layerPanelContent (you'll need to add this to the IJsTimeLineContext and instantiate it in JsTimeLine.ts \- it's the .timeline-layer-content div).  
7. Clear the container's innerHTML.  
8. Write a (recursive) function to loop through the layers array and create DOM elements for each layer (\<div class="layer-row"\>...\</div\>). This function must handle nested children for folders."

✅ **Task Completed**

**Task 9.2: Style Layer Panel**

Prompt:  
"Copilot, update src/styles/JsTimeLine.less.

1. Inside the .JsTimeLine block, add styles for .timeline-layer-panel.  
2. Add nested styles for .timeline-layer-content.  
3. Add styles for .layer-row, including display: flex and properties for .layer-name, and placeholders for .layer-controls (eye, lock icons)."

✅ **Task Completed**

**Task 9.3: Integrate LayerPanel**

Prompt:  
"Copilot, update src/JsTimeLine.ts.

1. Import LayerPanel.  
2. In the constructor, instantiate new LayerPanel(this.\_context) and store it on the context (e.g., this.\_context.UI.layerPanel \= ...).  
3. Create a test ITimeLineData object (based on the spec's JSON example) and use this.\_context.Data.load(...) to load it.  
4. Call this.\_context.UI.layerPanel.render() to render the test data."

✅ **Task Completed**

### **Phase 10: Render Time Ruler & Playhead**

**Task 10.1: Create TimeRuler UI Class**

Prompt:  
"Copilot, create a new file src/ui/TimeRuler.ts.

1. Create a TimeRuler class, taking IJsTimeLineContext in its constructor.  
2. Create a public render() method.  
3. Get the .timeline-ruler-content container from the context.  
4. Get settings like totalFrames from this.\_context.Data.getData().  
5. Loop from 1 to totalFrames and generate the DOM for ruler ticks (.ruler-tick) and labels (.ruler-label every 5 or 10 frames)."

✅ **Task Completed**

**Task 10.2: Style Time Ruler**

Prompt:  
"Copilot, update src/styles/JsTimeLine.less.

1. Add styles for .timeline-ruler and .timeline-ruler-content.  
2. Add styles for .ruler-tick (small div) and .ruler-label (text).  
3. Add styles for the .timeline-playhead (e.g., an absolute-positioned red div with a ::after pseudo-element for the line)."

✅ **Task Completed**

**Task 10.3: Integrate TimeRuler**

Prompt:  
"Copilot, update src/JsTimeLine.ts.

1. Import TimeRuler.  
2. Instantiate it in the constructor and store it on the context.  
3. Call this.\_context.UI.timeRuler.render() after loading data."

✅ **Task Completed**

### **Phase 11: Synchronized Scrolling**

**Task 11.1: Implement Scroll Sync Logic**

Prompt:  
"Copilot, update src/JsTimeLine.ts.

1. In the constructor, find the .timeline-grid-container element from the context.  
2. Add an onscroll event listener to this element.  
3. Inside the scroll event handler:  
   * Get event.target.scrollTop and event.target.scrollLeft.  
   * Set this.\_context.UI.layerPanelContent.style.transform \= \\translateY(-${scrollTop}px)\`;\`  
   * Set this.\_context.UI.rulerContent.style.transform \= \\translateX(-${scrollLeft}px)\`;\`  
   * This will synchronize the scrolling as required by the spec (Section 4.1)."

**Task 11.2: Add Sizing Content to Grid**

Prompt:  
"Copilot, to test scrolling, let's update src/ui/TimelineGrid.ts (create this file if it doesn't exist).

1. Give it a simple render() method that gets the .timeline-grid-content container.  
2. Inside, get the totalFrames and layers.length.  
3. Set the *width* of .timeline-grid-content to totalFrames \* frameWidth (e.g., frameWidth \= 15px).  
4. Set the *height* of .timeline-grid-content to layers.length \* rowHeight (e.g., rowHeight \= 30px).  
5. Call this render() method in JsTimeLine.ts. This will make the grid container overflow and enable scrolling, allowing us to test Phase 11."

### **Phase 12: Render Timeline Grid**

**Task 12.1: Implement Grid Rendering Logic**

Prompt:  
"Copilot, update src/ui/TimelineGrid.ts.

1. Implement the *actual* render() logic, replacing the temporary sizing code.  
2. Clear the .timeline-grid-content container.  
3. Get the layers array from the data.  
4. Loop through each layer and create a .grid-row element.  
5. Inside each row, implement the logic from Spec Section 1.4 to render the frames. This is complex. You'll need to parse the layer.keyframes and layer.tweens arrays to generate:  
   * .grid-frame (standard frames)  
   * .grid-keyframe (solid circle)  
   * .grid-keyframe-empty (hollow circle)  
   * .grid-tween (blue background with an arrow)  
6. Append each .grid-row to the .timeline-grid-content."

**Task 12.2: Style the Timeline Grid**

Prompt:  
"Copilot, update src/styles/JsTimeLine.less.

1. Add styles for .timeline-grid-container and .timeline-grid-content.  
2. Add styles for .grid-row.  
3. Add styles for .grid-frame, .grid-keyframe, .grid-keyframe-empty, and .grid-tween to match the visual descriptions in Spec Section 1.4."