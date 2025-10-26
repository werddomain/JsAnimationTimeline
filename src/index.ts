/**
 * Main entry point for the Animation Timeline Editor test page.
 */
import './styles/main.less';
import { TimelineControl } from './core/TimelineControl';

// Initialize the timeline when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Animation Timeline Editor...');
  
  try {
    // Get the container element
    const container = document.getElementById('timeline-container');
    if (!container) {
      throw new Error('Timeline container element not found');
    }

    // Create and initialize the timeline control
    const timeline = new TimelineControl({
      container,
      fps: 24,
      totalFrames: 100,
      timeScale: 20,
      debug: true
    });

    // Initialize the timeline
    await timeline.initialize();

    // Store timeline reference globally for testing
    (window as any).timelineControl = timeline;

    // Emit timeline-ready event for testing
    const readyEvent = new CustomEvent('timeline-ready', {
      detail: { timeline }
    });
    window.dispatchEvent(readyEvent);

    console.log('Timeline initialized successfully:', timeline.getDebugInfo());

    // Test basic functionality
    setTimeout(() => {
      console.log('Testing timeline functionality...');
      timeline.setCurrentFrame(10);
      console.log('Current frame:', timeline.getCurrentFrame());
      console.log('Current time:', timeline.getCurrentTime());
    }, 1000);

  } catch (error) {
    console.error('Failed to initialize timeline:', error);
  }
});


