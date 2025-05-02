import './styles/main.less';
import { App } from './core/app';

// Initialize the operating system when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Set up global drag state handling
  document.addEventListener('dragstart', () => {
    document.body.classList.add('dragging-in-progress');
  });
  
  document.addEventListener('dragend', () => {
    document.body.classList.remove('dragging-in-progress');
  });
  
  const app = new App();
  app.init();
});