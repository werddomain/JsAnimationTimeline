import { Timeline } from './timeline';

export class App {
    constructor() {
        console.log("App initialized");
    }

    init() {
        console.log("App is running");
        // Initialize the operating system here
        // For example, you can load the main menu or other components
    }

}

window.addEventListener('DOMContentLoaded', () => {
  new Timeline('timeline-container');
  // No need to manually create LayerPanel or TimelineGrid here; Timeline handles it.
});