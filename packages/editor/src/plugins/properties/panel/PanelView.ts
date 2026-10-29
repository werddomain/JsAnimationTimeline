// packages/editor/src/plugins/properties/panel/PanelView.ts
import type { IPanelField, IPanelState } from './panelState';
import { propertyLabel, samePanelContext } from './panelState';

interface IFieldView {
  readonly name: string;
  readonly form: HTMLFormElement;
  readonly input: HTMLInputElement;
  readonly button: HTMLButtonElement;
  readonly origin: HTMLElement;
  readonly error: HTMLElement;
  readonly remove: () => void;
  state: IPanelState;
  display: string;
  draft: boolean;
}

/** Owns only its DOM and handlers; refreshes never move focus. */
export class PanelView {
  readonly element: HTMLElement;
  private readonly title: HTMLElement;
  private readonly status: HTMLElement;
  private readonly fields: HTMLElement;
  private controls: IFieldView[] = [];
  private alive = true;

  constructor(owner: HTMLElement, private readonly apply: (state: IPanelState, name: string, value: number) => void) {
    const doc = owner.ownerDocument;
    this.element = doc.createElement('aside');
    this.element.className = 'jt-properties-panel';
    this.element.setAttribute('aria-label', 'Propriétés du calque');
    this.element.tabIndex = -1;
    const heading = doc.createElement('h2');
    heading.textContent = 'Propriétés';
    this.title = doc.createElement('p');
    this.title.className = 'jt-properties-panel__context';
    this.status = doc.createElement('p');
    this.status.className = 'jt-properties-panel__status';
    this.status.setAttribute('role', 'status');
    const hint = doc.createElement('p');
    hint.className = 'jt-properties-panel__hint';
    hint.textContent = 'Valeurs évaluées à cette image. Appliquer ou Entrée pour enregistrer ; Échap pour rétablir.';
    this.fields = doc.createElement('div');
    this.fields.className = 'jt-properties-panel__fields';
    this.element.append(heading, this.title, this.status, hint, this.fields);
    owner.append(this.element);
  }

  update(state: IPanelState, reset = false): void {
    if (!this.alive) return;
    this.title.textContent = state.title;
    this.status.textContent = state.reason;
    const names = state.fields.map(({ descriptor }) => descriptor.name);
    if (names.length !== this.controls.length || names.some((name, i) => name !== this.controls[i].name)) {
      this.clear();
      this.controls = state.fields.map((field) => this.createField(state, field));
    }
    state.fields.forEach((field, i) => this.updateField(this.controls[i], state, field, reset));
  }

  focus(): void {
    if (!this.alive) return;
    const input = this.controls.find(({ input: control }) => !control.disabled)?.input;
    (input ?? this.element).focus({ preventScroll: true });
  }

  destroy(): void {
    this.alive = false;
    this.clear();
    this.element.remove();
  }

  private clear(): void {
    this.controls.forEach(({ remove }) => remove());
    this.controls = [];
    this.fields.replaceChildren();
  }

  private createField(state: IPanelState, field: IPanelField): IFieldView {
    const doc = this.element.ownerDocument;
    const form = doc.createElement('form');
    form.noValidate = true;
    form.dataset.property = field.descriptor.name;
    const label = doc.createElement('label');
    const labelText = doc.createElement('span');
    labelText.textContent = propertyLabel(field.descriptor) + (field.descriptor.unit ? ' (' + field.descriptor.unit + ')' : '');
    const input = doc.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.inputMode = 'decimal';
    const origin = doc.createElement('small');
    origin.className = 'jt-properties-panel__origin';
    const error = doc.createElement('span');
    error.className = 'jt-properties-panel__error';
    error.setAttribute('role', 'status');
    const button = doc.createElement('button');
    button.type = 'submit';
    button.textContent = 'Appliquer';
    button.setAttribute('aria-label', 'Appliquer ' + propertyLabel(field.descriptor));
    label.append(labelText, input);
    form.append(label, button, origin, error);
    const control: IFieldView = { name: field.descriptor.name, form, input, button, origin, error,
      state, display: '', draft: false, remove: () => {
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKey);
        form.removeEventListener('submit', onSubmit);
      } };
    const onInput = (): void => {
      if (!this.alive || input.disabled) return;
      control.draft = true;
      error.textContent = '';
      input.removeAttribute('aria-invalid');
      button.disabled = false;
    };
    const onSubmit = (event: Event): void => {
      event.preventDefault();
      this.commit(control);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') { event.preventDefault(); this.commit(control); }
      else if (event.key === 'Escape') {
        event.preventDefault();
        input.value = control.display;
        control.draft = false;
        error.textContent = '';
        input.removeAttribute('aria-invalid');
        button.disabled = true;
      }
    };
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKey);
    form.addEventListener('submit', onSubmit);
    this.fields.append(form);
    return control;
  }

  private updateField(control: IFieldView, state: IPanelState, field: IPanelField, reset: boolean): void {
    const changed = !samePanelContext(control.state, state);
    control.state = state;
    control.display = String(field.value);
    control.input.disabled = state.reason !== '';
    if (changed || reset || !control.draft) {
      control.input.value = control.display;
      control.draft = false;
      control.error.textContent = '';
      control.input.removeAttribute('aria-invalid');
    }
    control.button.disabled = control.input.disabled || !control.draft;
    control.origin.textContent = field.defaultOrigin ? 'Valeur par défaut du registre.' : 'Valeur évaluée.';
    if (field.stored !== undefined) control.origin.textContent += ' Clé enregistrée : ' + field.stored + '.';
  }

  private commit(control: IFieldView): void {
    if (!this.alive || !control.draft || control.input.disabled || !this.controls.includes(control)) return;
    const raw = control.input.value.trim();
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) {
      control.error.textContent = 'Saisissez un nombre fini.';
      control.input.setAttribute('aria-invalid', 'true');
      return;
    }
    this.apply(control.state, control.name, value);
  }
}

