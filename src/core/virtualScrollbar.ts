import { EventManager } from './eventManager';

export class VirtualScrollbar {
  private container: HTMLElement;
  private scrollbarElement: HTMLElement;
  private thumbElement: HTMLElement;
  private eventManager: EventManager;
  
  // Scrolling state
  private totalWidth: number = 0;
  private viewportWidth: number = 0;
  private scrollPosition: number = 0;
  private thumbWidth: number = 50; // Default minimum width
  private isThumbDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartScrollPos: number = 0;
  
  constructor(container: HTMLElement, eventManager: EventManager) {
    this.container = container;
    this.eventManager = eventManager;
    
    // Create the scrollbar elements
    this.scrollbarElement = document.createElement('div');
    this.scrollbarElement.className = 'virtual-scrollbar';
    this.thumbElement = document.createElement('div');
    this.thumbElement.className = 'virtual-scrollbar__thumb';
    
    // Assemble the DOM
    this.scrollbarElement.appendChild(this.thumbElement);
    this.container.appendChild(this.scrollbarElement);
    
    // Set up event listeners
    this.attachEventListeners();
    
    // Subscribe to events from the timeline
    this.eventManager.subscribe('scrollPositionChange', this.handleScrollPositionChange.bind(this));
    this.eventManager.subscribe('contentSizeChange', this.handleContentSizeChange.bind(this));
  }
  
  private attachEventListeners(): void {
    // Mouse down on the thumb starts dragging
    this.thumbElement.addEventListener('mousedown', this.handleThumbMouseDown.bind(this));
    
    // Mouse down on the track jumps to that position
    this.scrollbarElement.addEventListener('mousedown', this.handleTrackMouseDown.bind(this));
    
    // Global mouse events for dragging
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Prevent clicks on track from being stopped by thumb
    this.thumbElement.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  private handleThumbMouseDown(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    this.isThumbDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartScrollPos = this.scrollPosition;
    
    this.thumbElement.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }
  
  private handleTrackMouseDown(e: MouseEvent): void {
    // Only handle direct clicks on the track, not the thumb
    if (e.target !== this.scrollbarElement) return;
    
    const trackRect = this.scrollbarElement.getBoundingClientRect();
    const clickPositionRatio = (e.clientX - trackRect.left) / trackRect.width;
    
    // Calculate new scroll position based on click location
    const newScrollPosition = clickPositionRatio * (this.totalWidth - this.viewportWidth);
    
    // Update scroll position and notify listeners
    this.setScrollPosition(newScrollPosition);
  }
  
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isThumbDragging) return;
    
    const trackRect = this.scrollbarElement.getBoundingClientRect();
    const deltaX = e.clientX - this.dragStartX;
    const movementRatio = deltaX / (trackRect.width - this.thumbWidth);
    
    // Calculate new scroll position
    const scrollRange = this.totalWidth - this.viewportWidth;
    const newScrollPosition = Math.max(0, Math.min(scrollRange, this.dragStartScrollPos + (movementRatio * scrollRange)));
    
    // Update scroll position and notify listeners
    this.setScrollPosition(newScrollPosition);
  }
  
  private handleMouseUp(): void {
    if (!this.isThumbDragging) return;
    
    this.isThumbDragging = false;
    this.thumbElement.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
  
  private handleScrollPositionChange(data: { position: number }): void {
    this.scrollPosition = data.position;
    this.updateThumbPosition();
  }
  
  private handleContentSizeChange(data: { totalWidth: number, viewportWidth: number }): void {
    this.totalWidth = data.totalWidth;
    this.viewportWidth = data.viewportWidth;
    
    // Update visibility based on whether scrolling is needed
    this.scrollbarElement.style.display = this.totalWidth > this.viewportWidth ? 'block' : 'none';
    
    this.updateThumbWidth();
    this.updateThumbPosition();
  }
  
  private updateThumbWidth(): void {
    // Calculate thumb width based on visible portion ratio
    const visibleRatio = Math.min(1, this.viewportWidth / this.totalWidth);
    const thumbWidth = Math.max(20, visibleRatio * this.scrollbarElement.offsetWidth);
    
    this.thumbWidth = thumbWidth;
    this.thumbElement.style.width = `${thumbWidth}px`;
  }
  
  private updateThumbPosition(): void {
    if (this.totalWidth <= this.viewportWidth) {
      this.thumbElement.style.left = '0';
      return;
    }
    
    const availableTrackWidth = this.scrollbarElement.offsetWidth - this.thumbWidth;
    const scrollRatio = this.scrollPosition / (this.totalWidth - this.viewportWidth);
    const thumbPosition = scrollRatio * availableTrackWidth;
    
    this.thumbElement.style.left = `${thumbPosition}px`;
  }
  
  private setScrollPosition(position: number): void {
    this.scrollPosition = position;
    this.updateThumbPosition();
    
    // Notify listeners about the scroll change
    this.eventManager.emit('scrollChange', { position });
  }
  
  // Public method to update scrollbar from external changes
  public update(totalWidth: number, viewportWidth: number, scrollPosition: number): void {
    this.totalWidth = totalWidth;
    this.viewportWidth = viewportWidth;
    this.scrollPosition = scrollPosition;
    
    this.scrollbarElement.style.display = this.totalWidth > this.viewportWidth ? 'block' : 'none';
    
    this.updateThumbWidth();
    this.updateThumbPosition();
  }
  
  // Public method to destroy and clean up
  public destroy(): void {
    this.thumbElement.removeEventListener('mousedown', this.handleThumbMouseDown.bind(this));
    this.scrollbarElement.removeEventListener('mousedown', this.handleTrackMouseDown.bind(this));
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    
    if (this.container.contains(this.scrollbarElement)) {
      this.container.removeChild(this.scrollbarElement);
    }
  }
}
