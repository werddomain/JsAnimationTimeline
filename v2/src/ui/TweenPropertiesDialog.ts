import { IJsTimeLineContext } from '../IJsTimeLineContext';
import { ITween } from '../data/ITimeLineData';

/**
 * TweenPropertiesDialog - Modal dialog for editing tween properties
 */
export class TweenPropertiesDialog {
  private context: IJsTimeLineContext;
  private overlay: HTMLElement | null = null;
  private dialog: HTMLElement | null = null;
  private currentTween: { layerId: string; tween: ITween } | null = null;
  private onSaveCallback: ((layerId: string, tween: ITween) => void) | null = null;

  constructor(context: IJsTimeLineContext) {
    this.context = context;
  }

  /**
   * Show the tween properties dialog
   * @param layerId ID of the layer containing the tween
   * @param tween The tween object to edit
   * @param onSave Callback function when user clicks OK
   */
  public show(layerId: string, tween: ITween, onSave: (layerId: string, tween: ITween) => void): void {
    this.currentTween = { layerId, tween: { ...tween } }; // Clone tween
    this.onSaveCallback = onSave;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'tween-dialog-overlay';
    
    // Create dialog
    this.dialog = document.createElement('div');
    this.dialog.className = 'tween-dialog';
    
    // Dialog title
    const title = document.createElement('h3');
    title.className = 'tween-dialog-title';
    title.textContent = 'Tween Properties';
    this.dialog.appendChild(title);

    // Form container
    const form = document.createElement('form');
    form.className = 'tween-dialog-form';
    form.onsubmit = (e) => {
      e.preventDefault();
      this.handleSave();
    };

    // Easing type field
    const easingLabel = document.createElement('label');
    easingLabel.className = 'tween-dialog-label';
    easingLabel.textContent = 'Easing Type:';
    
    const easingSelect = document.createElement('select');
    easingSelect.className = 'tween-dialog-select';
    easingSelect.id = 'tween-easing-type';
    
    const easingOptions = [
      { value: 'linear', label: 'Linear' },
      { value: 'ease-in', label: 'Ease In' },
      { value: 'ease-out', label: 'Ease Out' },
      { value: 'ease-in-out', label: 'Ease In-Out' }
    ];

    easingOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (tween.type === opt.value) {
        option.selected = true;
      }
      easingSelect.appendChild(option);
    });

    form.appendChild(easingLabel);
    form.appendChild(easingSelect);

    // Frame info (read-only)
    const frameInfo = document.createElement('div');
    frameInfo.className = 'tween-dialog-info';
    frameInfo.textContent = `Frames: ${tween.startFrame} → ${tween.endFrame} (${tween.endFrame - tween.startFrame} frames)`;
    form.appendChild(frameInfo);

    this.dialog.appendChild(form);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'tween-dialog-buttons';

    // OK button
    const okButton = document.createElement('button');
    okButton.type = 'button';
    okButton.className = 'tween-dialog-button tween-dialog-button-ok';
    okButton.textContent = 'OK';
    okButton.onclick = () => this.handleSave();
    buttonContainer.appendChild(okButton);

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'tween-dialog-button tween-dialog-button-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => this.hide();
    buttonContainer.appendChild(cancelButton);

    this.dialog.appendChild(buttonContainer);

    // Add to overlay and document
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);

    // Focus on select
    setTimeout(() => easingSelect.focus(), 100);

    // Handle ESC key
    this.handleEscapeKey = this.handleEscapeKey.bind(this);
    document.addEventListener('keydown', this.handleEscapeKey);

    // Handle overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }

  /**
   * Hide and cleanup the dialog
   */
  public hide(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    document.removeEventListener('keydown', this.handleEscapeKey);
    
    this.overlay = null;
    this.dialog = null;
    this.currentTween = null;
    this.onSaveCallback = null;
  }

  /**
   * Handle save action
   */
  private handleSave(): void {
    if (!this.currentTween || !this.onSaveCallback || !this.dialog) return;

    const select = this.dialog.querySelector('#tween-easing-type') as HTMLSelectElement;
    if (!select) return;

    // Update tween with new easing type
    this.currentTween.tween.type = select.value;

    // Call the callback
    this.onSaveCallback(this.currentTween.layerId, this.currentTween.tween);

    // Close dialog
    this.hide();
  }

  /**
   * Handle ESC key press
   */
  private handleEscapeKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.hide();
    }
  }
}
