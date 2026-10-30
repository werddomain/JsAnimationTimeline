// demo/editor/src/propertyTimelinesEffects.ts
import { isPropertyEasing } from '@kazo-ca/timeline-runtime';
import type { IEffectParameters, PropertyEasing, PropertyEasingFamily } from '@kazo-ca/timeline-runtime';

interface IParameter { readonly name: keyof IEffectParameters | 'x1' | 'y1' | 'x2' | 'y2'; readonly label: string; readonly min: number; readonly max: number; readonly value: number; readonly step?: number; }
interface IEffectOption { readonly value: PropertyEasingFamily | 'bezier'; readonly label: string; }
const EFFECTS: readonly IEffectOption[] = [
  { value: 'linear', label: 'Linéaire' }, { value: 'sine', label: 'Sinus' }, { value: 'circle', label: 'Circulaire' },
  { value: 'quadratic', label: 'Quadratique' }, { value: 'cubic', label: 'Cubique' }, { value: 'quartic', label: 'Quartique' },
  { value: 'quintic', label: 'Quintique' }, { value: 'power', label: 'Puissance' }, { value: 'exponential', label: 'Exponentielle' },
  { value: 'back', label: 'Retour' }, { value: 'bounce', label: 'Rebond' }, { value: 'elastic', label: 'Élastique' },
  { value: 'bezier', label: 'Bézier personnalisée' }
];
const PARAMETERS: Readonly<Partial<Record<IEffectOption['value'], readonly IParameter[]>>> = {
  power: [{ name: 'power', label: 'Puissance', min: 0.1, max: 20, value: 2 }],
  exponential: [{ name: 'exponent', label: 'Exposant', min: 0, max: 30, value: 2 }],
  back: [{ name: 'amplitude', label: 'Amplitude', min: 0, max: 10, value: 1 }],
  bounce: [{ name: 'bounces', label: 'Rebonds', min: 0, max: 32, value: 3, step: 1 }, { name: 'bounciness', label: 'Rapport des rebonds', min: 1, max: 10, value: 2 }],
  elastic: [{ name: 'oscillations', label: 'Oscillations', min: 0, max: 32, value: 3, step: 1 }, { name: 'springiness', label: 'Tension', min: 0, max: 30, value: 3 }],
  bezier: [{ name: 'x1', label: 'X1', min: 0, max: 1, value: 0.25 }, { name: 'y1', label: 'Y1', min: -100, max: 100, value: 0.1 }, { name: 'x2', label: 'X2', min: 0, max: 1, value: 0.25 }, { name: 'y2', label: 'Y2', min: -100, max: 100, value: 1 }]
};

export interface IEffectControls { read(): PropertyEasing | undefined; show(easing: PropertyEasing | undefined): void; }

export function createEffectControls(family: HTMLSelectElement, mode: HTMLSelectElement, fields: HTMLElement, modeLabel: HTMLElement): IEffectControls {
  EFFECTS.forEach(({ value, label }) => family.add(new Option(label, value)));
  function render(easing?: PropertyEasing): void {
    fields.replaceChildren();
    const selected = EFFECTS.find((effect) => effect.value === family.value);
    if (selected === undefined) return;
    modeLabel.hidden = selected.value === 'bezier';
    for (const parameter of PARAMETERS[selected.value] ?? []) {
      const label = document.createElement('label'); label.textContent = parameter.label;
      const input = document.createElement('input'); input.type = 'number'; input.name = parameter.name;
      input.min = String(parameter.min); input.max = String(parameter.max); input.step = String(parameter.step ?? 0.1);
      const supplied = easing?.kind === 'bezier' && ['x1', 'y1', 'x2', 'y2'].includes(parameter.name)
        ? easing[parameter.name as 'x1' | 'y1' | 'x2' | 'y2']
        : easing?.kind === 'effect' ? easing.parameters?.[parameter.name as keyof IEffectParameters] : undefined;
      input.value = String(supplied ?? parameter.value); label.append(input); fields.append(label);
    }
  }
  family.addEventListener('change', () => render());
  return {
    read: () => {
      const parameters = Object.fromEntries([...fields.querySelectorAll('input')].map((field) => [field.name, field.valueAsNumber]));
      const candidate: unknown = family.value === 'bezier' ? { kind: 'bezier', ...parameters }
        : { kind: 'effect', family: family.value, mode: mode.value, parameters };
      return isPropertyEasing(candidate) ? candidate : undefined;
    },
    show: (easing) => {
      family.value = easing?.kind === 'bezier' ? 'bezier' : easing?.family ?? 'linear';
      mode.value = easing?.kind === 'effect' ? easing.mode : 'in';
      render(easing);
    }
  };
}
