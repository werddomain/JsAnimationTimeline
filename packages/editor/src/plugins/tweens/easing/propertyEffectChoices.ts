// packages/editor/src/plugins/tweens/easing/propertyEffectChoices.ts
import { isPropertyEasing } from '@kazo-ca/timeline-runtime';
import type { IEffectParameters, PropertyEasing, PropertyEasingFamily } from '@kazo-ca/timeline-runtime';

type EffectChoice = PropertyEasingFamily | 'bezier';
interface IParameter {
  readonly name: keyof IEffectParameters | 'x1' | 'y1' | 'x2' | 'y2';
  readonly label: string; readonly min: number; readonly max: number; readonly value: number; readonly step?: number;
}
export const PROPERTY_EFFECTS: readonly { readonly value: EffectChoice; readonly label: string }[] = [
  { value: 'linear', label: 'Linéaire' }, { value: 'sine', label: 'Sinus' }, { value: 'circle', label: 'Circulaire' },
  { value: 'quadratic', label: 'Quadratique' }, { value: 'cubic', label: 'Cubique' }, { value: 'quartic', label: 'Quartique' },
  { value: 'quintic', label: 'Quintique' }, { value: 'power', label: 'Puissance' }, { value: 'exponential', label: 'Exponentielle' },
  { value: 'back', label: 'Retour' }, { value: 'bounce', label: 'Rebond' }, { value: 'elastic', label: 'Élastique' },
  { value: 'bezier', label: 'Bézier personnalisée' }
];
const PARAMETERS: Readonly<Partial<Record<EffectChoice, readonly IParameter[]>>> = {
  power: [{ name: 'power', label: 'Puissance', min: 0.1, max: 20, value: 2 }],
  exponential: [{ name: 'exponent', label: 'Exposant', min: 0, max: 30, value: 2 }],
  back: [{ name: 'amplitude', label: 'Amplitude', min: 0, max: 10, value: 1 }],
  bounce: [{ name: 'bounces', label: 'Rebonds', min: 0, max: 32, value: 3, step: 1 }, { name: 'bounciness', label: 'Rapport des rebonds', min: 1, max: 10, value: 2 }],
  elastic: [{ name: 'oscillations', label: 'Oscillations', min: 0, max: 32, value: 3, step: 1 }, { name: 'springiness', label: 'Tension', min: 0, max: 30, value: 3 }],
  bezier: [{ name: 'x1', label: 'X1', min: 0, max: 1, value: 0.25 }, { name: 'y1', label: 'Y1', min: -100, max: 100, value: 0.1 },
    { name: 'x2', label: 'X2', min: 0, max: 1, value: 0.25 }, { name: 'y2', label: 'Y2', min: -100, max: 100, value: 1 }]
};

/** Rebuild local draft controls; no document command is issued. */
export function renderPropertyEffectParameters(fields: HTMLElement, family: string, easing?: PropertyEasing): void {
  fields.replaceChildren();
  const choice = PROPERTY_EFFECTS.find(({ value }) => value === family);
  if (choice === undefined) return;
  for (const parameter of PARAMETERS[choice.value] ?? []) {
    const label = fields.ownerDocument.createElement('label'); label.textContent = parameter.label;
    const input = fields.ownerDocument.createElement('input'); input.type = 'number'; input.name = parameter.name;
    input.setAttribute('aria-label', parameter.label);
    input.min = String(parameter.min); input.max = String(parameter.max); input.step = String(parameter.step ?? 'any');
    const supplied = easing?.kind === 'bezier' && ['x1', 'y1', 'x2', 'y2'].includes(parameter.name)
      ? easing[parameter.name as 'x1' | 'y1' | 'x2' | 'y2']
      : easing?.kind === 'effect' ? easing.parameters?.[parameter.name as keyof IEffectParameters] : undefined;
    input.value = String(supplied ?? parameter.value); label.append(input); fields.append(label);
  }
}

export function readPropertyEffect(family: string, mode: string, fields: HTMLElement): PropertyEasing | undefined {
  const parameters = Object.fromEntries([...fields.querySelectorAll('input')].map((field) => [field.name, field.valueAsNumber]));
  const candidate: unknown = family === 'bezier' ? { kind: 'bezier', ...parameters }
    : { kind: 'effect', family, mode, ...(Object.keys(parameters).length === 0 ? {} : { parameters }) };
  return isPropertyEasing(candidate) ? candidate : undefined;
}
