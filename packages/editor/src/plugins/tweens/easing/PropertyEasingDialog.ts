// packages/editor/src/plugins/tweens/easing/PropertyEasingDialog.ts
import { parseEasing } from '@kazo-ca/timeline-runtime';
import type { PropertyEasing } from '@kazo-ca/timeline-runtime';
import type { IEasingDialog } from './EasingDialog';
import { PROPERTY_EFFECTS, readPropertyEffect, renderPropertyEffectParameters } from './propertyEffectChoices';
import { renderPropertyEasingGraph } from './propertyEasingGraph';
import type { IPropertyCurvePreview } from './propertyEasingGraph';

export interface IPropertyEasingDialogOptions extends IPropertyCurvePreview {
  readonly owner: HTMLElement;
  readonly property: string;
  readonly apply: (easing: PropertyEasing) => boolean;
  readonly close: () => void;
}
interface IElements {
  readonly portal: HTMLDivElement; readonly form: HTMLFormElement;
  readonly family: HTMLSelectElement; readonly mode: HTMLSelectElement; readonly modeLabel: HTMLLabelElement;
  readonly fields: HTMLDivElement; readonly graph: SVGSVGElement; readonly provenance: HTMLParagraphElement;
  readonly message: HTMLParagraphElement; readonly apply: HTMLButtonElement; readonly cancel: HTMLButtonElement;
}
let sequence = 0;

function initialEffect(options: IPropertyEasingDialogOptions): PropertyEasing | undefined {
  const source = options.transition.source;
  if (source === undefined) return options.transition.easing;
  if (source.legacyEasing !== undefined) {
    const bezier = parseEasing(source.legacyEasing);
    return bezier === null ? undefined : { kind: 'bezier', ...bezier };
  }
  return source.easing;
}

function elements(options: IPropertyEasingDialogOptions): IElements {
  const doc = options.owner.ownerDocument;
  const id = `jt-property-easing-${++sequence}`;
  const portal = doc.createElement('div'); portal.className = 'JsTimeLine jt-easing-portal';
  const form = doc.createElement('form'); form.className = 'jt-easing-dialog jt-property-easing'; form.noValidate = true;
  form.setAttribute('role', 'dialog'); form.setAttribute('aria-modal', 'true');
  const title = doc.createElement('h2'); title.id = `${id}-title`; title.textContent = 'Effet de l’interpolation';
  form.setAttribute('aria-labelledby', title.id);
  const description = doc.createElement('p'); description.id = `${id}-description`;
  description.textContent = `${options.property} · images ${options.transition.fromFrame} à ${options.transition.toFrame}. L’effet s’applique uniquement à cette interpolation.`;
  form.setAttribute('aria-describedby', description.id);
  const provenance = doc.createElement('p'); provenance.className = 'jt-property-easing__provenance';
  provenance.textContent = options.transition.source === undefined ? ''
    : 'Courbe conservée après découpage ou migration : l’aperçu montre ses valeurs réelles. Choisir puis appliquer un effet remplacera seulement ce segment.';
  const addSelect = (name: string, items: readonly { readonly value: string; readonly label: string }[]): [HTMLSelectElement, HTMLLabelElement] => {
    const label = doc.createElement('label'); label.textContent = name;
    const select = doc.createElement('select'); select.setAttribute('aria-label', name);
    for (const item of items) { const option = doc.createElement('option'); option.value = item.value; option.textContent = item.label; select.append(option); }
    label.append(select); return [select, label];
  };
  const [family, familyLabel] = addSelect('Famille', PROPERTY_EFFECTS);
  const [mode, modeLabel] = addSelect('Mode', [{ value: 'in', label: 'Accélération' }, { value: 'out', label: 'Décélération' }, { value: 'in-out', label: 'Accélération et décélération' }]);
  const controls = doc.createElement('div'); controls.className = 'jt-property-easing__choices'; controls.append(familyLabel, modeLabel);
  const fields = doc.createElement('div'); fields.className = 'jt-property-easing__parameters';
  const graph = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); graph.classList.add('jt-property-easing__graph');
  const message = doc.createElement('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const actions = doc.createElement('div'); actions.className = 'jt-easing-dialog__actions';
  const apply = doc.createElement('button'); apply.type = 'submit'; apply.textContent = 'Appliquer'; apply.disabled = true;
  const cancel = doc.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Annuler'; actions.append(apply, cancel);
  form.append(title, description, provenance, controls, fields, graph, message, actions); portal.append(form);
  const current = initialEffect(options);
  family.value = current?.kind === 'bezier' ? 'bezier' : current?.family ?? 'linear';
  mode.value = current?.kind === 'effect' ? current.mode : 'in'; modeLabel.hidden = family.value === 'bezier';
  renderPropertyEffectParameters(fields, family.value, current);
  return { portal, form, family, mode, modeLabel, fields, graph, provenance, message, apply, cancel };
}

class PropertyEasingDialog implements IEasingDialog {
  private readonly view: IElements;
  private readonly previous: Element | null;
  private active = true;
  private dirty = false;
  private draft: PropertyEasing | undefined;

  constructor(private readonly options: IPropertyEasingDialogOptions) {
    this.previous = options.owner.ownerDocument.activeElement;
    this.view = elements(options);
  }

  mount(): void {
    const { portal, form, family, cancel } = this.view;
    form.addEventListener('change', this.change); form.addEventListener('input', this.input);
    form.addEventListener('submit', this.submit); cancel.addEventListener('click', this.cancel); portal.addEventListener('keydown', this.keyboard);
    this.preview(); this.options.owner.ownerDocument.body.append(portal); family.focus();
  }

  destroy(): void {
    if (!this.active) return;
    this.active = false;
    const { portal, form, cancel } = this.view;
    const doc = portal.ownerDocument;
    const restore = portal.contains(doc.activeElement);
    form.removeEventListener('change', this.change); form.removeEventListener('input', this.input);
    form.removeEventListener('submit', this.submit); cancel.removeEventListener('click', this.cancel); portal.removeEventListener('keydown', this.keyboard); portal.remove();
    const view = doc.defaultView;
    if (restore && view !== null && this.previous instanceof view.HTMLElement && this.previous.isConnected) this.previous.focus();
  }

  private readonly change = (event: Event): void => {
    if (!this.active) return;
    if (event.target === this.view.family) {
      renderPropertyEffectParameters(this.view.fields, this.view.family.value);
      this.view.modeLabel.hidden = this.view.family.value === 'bezier';
    }
    this.dirty = true; this.preview();
  };

  private readonly input = (event: Event): void => {
    if (!this.active || !this.view.fields.contains(event.target as Node | null)) return;
    this.dirty = true; this.preview();
  };

  private preview(): void {
    const { family, mode, fields, graph, apply, message } = this.view;
    this.draft = readPropertyEffect(family.value, mode.value, fields);
    apply.disabled = !this.dirty || this.draft === undefined;
    message.textContent = this.draft === undefined ? 'Vérifiez les paramètres : valeurs finies dans les bornes indiquées et nombres entiers pour les rebonds ou oscillations.' : '';
    try {
      if (!this.dirty && this.options.transition.source !== undefined) renderPropertyEasingGraph(graph, undefined, this.options);
      else if (this.draft !== undefined) renderPropertyEasingGraph(graph, this.draft);
    } catch {
      graph.replaceChildren(); apply.disabled = true;
      message.textContent = 'La courbe ne peut pas être calculée avec ces paramètres.';
    }
  }

  private readonly submit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (!this.active) return;
    if (!this.dirty) { this.options.close(); return; }
    this.preview();
    if (this.draft === undefined || this.view.apply.disabled) return;
    if (this.options.apply(this.draft)) this.options.close();
    else if (this.active) this.view.message.textContent = 'La modification a été refusée. Vérifiez l’interpolation, les droits et les verrous.';
  };

  private readonly cancel = (): void => { if (this.active) this.options.close(); };

  private readonly keyboard = (event: KeyboardEvent): void => {
    if (!this.active) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.options.close(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...this.view.form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, select, button')]
      .filter((element) => !element.disabled && !element.closest('[hidden]'));
    const first = controls[0]; const last = controls[controls.length - 1];
    const current = this.view.form.ownerDocument.activeElement;
    if (event.shiftKey && current === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus(); }
  };
}

export function createPropertyEasingDialog(options: IPropertyEasingDialogOptions): IEasingDialog {
  const dialog = new PropertyEasingDialog(options);
  try { dialog.mount(); } catch (error) { dialog.destroy(); throw error; }
  return dialog;
}
