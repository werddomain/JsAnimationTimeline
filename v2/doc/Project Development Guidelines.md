# **🧑‍💻 Project Development Guidelines: TypeScript & LESS Controls**

This document outlines the core principles and best practices for developing controls in this project. Following these guidelines will ensure our code is clean, maintainable, scalable, and easy to work with for all developers (human or AI).

### **🎨 1\. Styling with LESS**

The cardinal rule is the **complete separation of concerns**. Style definitions must *never* reside in TypeScript (.ts), TSX (.tsx), or HTML files. All styling is to be handled exclusively in .less files.

#### **1.1. Strict Scoping**

Every control must have a unique root CSS class. All style rules for that control and its sub-components **must be nested** within this root class. This prevents style leakage and conflicts with other components on the page.

**Example Structure:**

// File: src\\styles\\tracks.less

// The root class for the entire control  
.JsTimeLine {  
  // Default container styles  
  display: block;  
  position: relative;  
  font-family: sans-serif;

  // Rule for a specific functional part (e.g., the main track)  
  .track {  
    width: 100%;  
    height: 5px;  
    background-color: \#e0e0e0;  
    border-radius: 3px;  
  

    // Rule for a repeating element (e.g., an event marker)  
    .event-marker {  
      position: absolute;  
      top: \-5px;  
      width: 15px;  
      height: 15px;  
      background-color: steelblue;  
      border-radius: 50%;  
      cursor: pointer;

      // State variations using pseudo-classes or modifier classes  
      &:hover {  
        transform: scale(1.2);  
      }

      &.is-active {  
        background-color: \#ff6347;  
        box-shadow: 0 0 5px \#ff6347;  
      }  
    } 
  } 
}

#### **1.2. File and Naming Conventions**

* Each control should have its own corresponding .less file (e.g., JsTimeLine.ts has JsTimeLine.less).  
* Use a BEM-like (Block\_\_Element--Modifier) naming convention for clarity, but within the nested structure. For example, .event-marker--important is more descriptive than .important-marker.

### **🧱 2\. Project Architecture & Modularity**

Our architecture is designed for clarity and scalability. Functionality is broken down into distinct modules that interact through a central Context object.

#### **2.1. Folder Structure**

A typical control's source directory should look like this:

src/  
└──   
        ├── ui/  
        │   ├── Track.ts  
        │   └── Marker.ts  
        ├── core/  
        │   ├── EventManager.ts  
        │   └── StateManager.ts  
        ├── plugins/  
        │   ├── ZoomPlugin.ts  
        │   └── TooltipPlugin.ts  
        ├── data/  
        │   └── TimeLineData.ts  
        ├── IJsTimeLineContext.ts  
        └── JsTimeLine.ts

#### **2.2. The Central Context Object**

A single Context object is instantiated for each control. It serves as the central hub for communication and state sharing between all modules and plugins. This avoids tightly coupled components and "prop drilling."

* **UI:** Contains instances of classes that manage the main DOM containers of the control.  
* **Core:** Holds the core logic modules. These modules expose events and methods for direct interaction (e.g., context.Core.EventManager.on('event:click', ...)).  
* **Plugins:** A dictionary ({ \[name: string\]: IPlugin }) of all registered and instantiated plugins.  
* **Data:** A read-only manager that provides access to the control's current data model. It ensures a single source of truth for the control's state.

**Example IJsTimeLineContext.ts:**

// Define interfaces for each part to ensure type safety  
import { EventManager } from "./core/EventManager";  
import { StateManager } from "./core/StateManager";  
import { IPlugin } from "./plugins/IPlugin";  
import { TimeLineData } from "./data/TimeLineData";  
import { TrackUI } from "./ui/Track";

// The main context interface  
export interface IJsTimeLineContext {  
  readonly UI: {  
    container: HTMLElement;  
    track: TrackUI;  
  };  
  readonly Core: {  
    eventManager: EventManager;  
    stateManager: StateManager;  
  };  
  readonly Plugins: {  
    \[key: string\]: IPlugin;  
  };  
  readonly Data: TimeLineData;  
}

### **✍️ 3\. General TypeScript Best Practices**

#### **3.1. Type Safety is Paramount**

* **Avoid any**: Use unknown for values where the type is truly unknown and perform type-checking. Define explicit interface or type definitions for all data structures.  
* **Use Readonly**: Use the readonly keyword for properties that should not be changed after initialization to promote immutability.

#### **3.2. DOM Interaction**

* **Cache Selectors**: If you need to access a DOM element multiple times, query it once and store the reference in a variable.  
* **Use data-\* Attributes for JS Hooks**: Avoid selecting elements by CSS classes or IDs for JS logic. Use dedicated data-js-\* attributes to decouple styling from functionality.  
  * **HTML**: \<div class="event-marker" data-js-marker-id="evt-01"\>\</div\>  
  * **TS**: element.querySelector('\[data-js-marker-id="evt-01"\]')

#### **3.3. Naming Conventions**

* **Classes, Interfaces, Enums, Types**: PascalCase (e.g., EventManager, IPlugin).  
* **Variables, Functions, Methods**: camelCase (e.g., activeMarker, initialize).  
* **Private Members**: Prefix with an underscore \_ (e.g., \_privateMethod).

### **✅ 4\. Tooling & Automation**

To enforce these rules automatically, our project should be configured with the following tools:

* **ESLint**: For identifying and fixing problems in TypeScript code.  
* **Stylelint**: For enforcing conventions and avoiding errors in LESS/CSS.  
* **Prettier**: For automatic code formatting to maintain a consistent style.