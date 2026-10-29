// packages/editor/src/plugins/tweens/easing/EasingDialog.ts
/** A document-local modal preset picker with disposable event handlers. */
import { DEFAULT_EASING, EASING_PRESETS, isEasingPreset } from '@kazo-ca/timeline-runtime';
import type { Easing, EasingPreset } from '@kazo-ca/timeline-runtime';

/** French labels in the same order as the runtime presets. */
export const EASING_PRESET_LABELS: Readonly<Record<EasingPreset, string>> = Object.freeze({
  linear: 'Linéaire',
  ease: 'Progressive',
  'ease-in': 'Accélération',
  'ease-out': 'Décélération',
  'ease-in-out': 'Accélération et décélération'
});

export interface IEasingDialogOptions {
  readonly owner: HTMLElement;
  readonly easing: Easing | undefined;
  readonly apply: (preset: EasingPreset) => boolean;
  readonly close: () => void;
}

export interface IEasingDialog { destroy(): void; }
interface IDialogElements {
  readonly portal: HTMLDivElement;
  readonly panel: HTMLFormElement;
  readonly select: HTMLSelectElement;
  readonly apply: HTMLButtonElement;
  readonly cancel: HTMLButtonElement;
  readonly message: HTMLParagraphElement;
}
let dialogCount = 0;

function renderSelect(doc: Document, id: string, current: Easing): HTMLSelectElement {
  const select = doc.createElement('select');
  select.id = `${id}-preset`;
  select.setAttribute('aria-label', 'Préréglage');
  if (!isEasingPreset(current)) {
    const custom = doc.createElement('option');
    custom.value = '';
    custom.textContent = 'Courbe personnalisée (conservée)';
    custom.disabled = true;
    select.append(custom);
  }
  EASING_PRESETS.forEach((preset) => {
    const option = doc.createElement('option');
    option.value = preset;
    option.textContent = EASING_PRESET_LABELS[preset];
    select.append(option);
  });
  select.value = isEasingPreset(current) ? current : '';
  return select;
}

function renderHeading(doc: Document, panel: HTMLFormElement, id: string): void {
  const title = doc.createElement('h2');
  title.id = `${id}-title`;
  title.textContent = 'Accélération de l’interpolation';
  panel.setAttribute('aria-labelledby', title.id);
  const description = doc.createElement('p');
  description.id = `${id}-description`;
  description.textContent = 'Le préréglage s’applique à toute la plage et conserve les clés de propriété.';
  panel.setAttribute('aria-describedby', description.id);
  panel.append(title, description);
}

function renderElements(options: IEasingDialogOptions): IDialogElements {
  const doc = options.owner.ownerDocument;
  const current = options.easing ?? DEFAULT_EASING;
  const id = `jt-easing-${++dialogCount}`;
  const portal = doc.createElement('div');
  portal.className = 'JsTimeLine jt-easing-portal';
  const panel = doc.createElement('form');
  panel.className = 'jt-easing-dialog';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  renderHeading(doc, panel, id);
  const select = renderSelect(doc, id, current);
  const label = doc.createElement('label');
  label.htmlFor = select.id;
  label.textContent = 'Préréglage';
  panel.append(label, select);
  if (!isEasingPreset(current)) {
    const note = doc.createElement('p');
    note.className = 'jt-easing-dialog__custom';
    note.textContent = `Courbe personnalisée : ${current}`;
    panel.append(note);
  }
  const message = doc.createElement('p');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const actions = doc.createElement('div');
  actions.className = 'jt-easing-dialog__actions';
  const apply = doc.createElement('button');
  apply.type = 'submit';
  apply.textContent = 'Appliquer';
  apply.disabled = select.value === '';
  const cancel = doc.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Annuler';
  actions.append(apply, cancel);
  panel.append(message, actions);
  portal.append(panel);
  return { portal, panel, select, apply, cancel, message };
}

class PresetDialog implements IEasingDialog {
  private readonly elements: IDialogElements;
  private readonly previous: Element | null;
  private active = true;

  constructor(private readonly options: IEasingDialogOptions) {
    this.previous = options.owner.ownerDocument.activeElement;
    this.elements = renderElements(options);
  }

  mount(): void {
    const { select, panel, cancel, portal } = this.elements;
    select.addEventListener('change', this.change);
    panel.addEventListener('submit', this.submit);
    cancel.addEventListener('click', this.cancel);
    portal.addEventListener('keydown', this.keyboard);
    this.options.owner.ownerDocument.body.append(portal);
    select.focus();
  }

  destroy(): void {
    if (!this.active) return;
    this.active = false;
    const { select, panel, cancel, portal } = this.elements;
    const doc = this.options.owner.ownerDocument;
    const restoreFocus = portal.contains(doc.activeElement);
    select.removeEventListener('change', this.change);
    panel.removeEventListener('submit', this.submit);
    cancel.removeEventListener('click', this.cancel);
    portal.removeEventListener('keydown', this.keyboard);
    portal.remove();
    const view = doc.defaultView;
    if (restoreFocus && view !== null && this.previous instanceof view.HTMLElement && this.previous.isConnected) {
      this.previous.focus();
    }
  }

  private readonly change = (): void => {
    this.elements.apply.disabled = !isEasingPreset(this.elements.select.value);
    this.elements.message.textContent = '';
  };

  private readonly submit = (event: SubmitEvent): void => {
    event.preventDefault();
    const { select, message } = this.elements;
    if (!this.active || !isEasingPreset(select.value)) return;
    if (this.options.apply(select.value)) this.options.close();
    else message.textContent = 'La modification a été refusée. Vérifiez l’interpolation et les verrous.';
  };

  private readonly cancel = (): void => { if (this.active) this.options.close(); };

  private readonly keyboard = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.options.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const { select, apply, cancel } = this.elements;
    const controls = [select, apply, cancel].filter((control) => !control.disabled);
    const first = controls[0];
    const last = controls[controls.length - 1];
    const focused = select.ownerDocument.activeElement;
    if (event.shiftKey && focused === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && focused === last) { event.preventDefault(); first.focus(); }
  };
}

/** Render outside the clipped editor while retaining the .JsTimeLine CSS scope. */
export function createEasingDialog(options: IEasingDialogOptions): IEasingDialog {
  const dialog = new PresetDialog(options);
  try { dialog.mount(); }
  catch (error) { dialog.destroy(); throw error; }
  return dialog;
}
