import './styles/main.less';
import { App } from './core/app';

// Initialize the operating system when the page loads
document.addEventListener('DOMContentLoaded', () => {
  
  const app = new App();
  app.init();
});