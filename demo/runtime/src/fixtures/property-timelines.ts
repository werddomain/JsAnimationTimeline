// demo/runtime/src/fixtures/property-timelines.ts
import { createObjectStage, createPlayer, createPropertyEasingFunction, isPropertyEasing } from '@kazo-ca/timeline-runtime';
import type { IEffectParameters, IPlayer, ITimelineDocument, PropertyEasing, PropertyEasingFamily, PropertyEasingMode, TimelinePropertyValues } from '@kazo-ca/timeline-runtime';
import './property-timelines.less';

interface IEffectOption { readonly value: PropertyEasingFamily | 'bezier'; readonly label: string; }
interface IParameter { readonly name: keyof IEffectParameters | 'x1' | 'y1' | 'x2' | 'y2'; readonly label: string; readonly min: number; readonly max: number; readonly value: number; readonly step?: number; }
interface IPreviewObject { values: TimelinePropertyValues; }
export interface IPropertyTimelinesFixture {
  readonly ready: true;
  readonly player: IPlayer;
  document(): ITimelineDocument;
  values(): TimelinePropertyValues;
}
declare global { interface Window { propertyTimelinesFixture?: IPropertyTimelinesFixture; } }

const EFFECTS: readonly IEffectOption[] = [
  { value: 'linear', label: 'Linéaire' }, { value: 'sine', label: 'Sinus' },
  { value: 'circle', label: 'Circulaire' }, { value: 'quadratic', label: 'Quadratique' },
  { value: 'cubic', label: 'Cubique' }, { value: 'quartic', label: 'Quartique' },
  { value: 'quintic', label: 'Quintique' }, { value: 'power', label: 'Puissance' },
  { value: 'exponential', label: 'Exponentielle' }, { value: 'back', label: 'Retour' },
  { value: 'bounce', label: 'Rebond' }, { value: 'elastic', label: 'Élastique' },
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

function element(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing property timeline fixture element: ${id}`);
  return node;
}
function input(id: string): HTMLInputElement {
  const node = element(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`Expected input: ${id}`);
  return node;
}
function select(id: string): HTMLSelectElement {
  const node = element(id);
  if (!(node instanceof HTMLSelectElement)) throw new Error(`Expected select: ${id}`);
  return node;
}
function svgElement(id: string): SVGElement {
  const node = document.getElementById(id);
  if (!(node instanceof SVGElement)) throw new Error(`Expected SVG element: ${id}`);
  return node;
}

const family = select('effect-family');
EFFECTS.forEach(({ value, label }) => family.add(new Option(label, value)));
family.value = 'sine';
const mode = select('effect-mode');
let easing: PropertyEasing = { kind: 'effect', family: 'sine', mode: 'in' };
let currentFrame = 61;
const object: IPreviewObject = { values: {} };
const canvas = element('object-preview');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Expected preview canvas.');
const context = canvas.getContext('2d');
if (context === null) throw new Error('Canvas drawing unavailable.');

function documentFor(effect: PropertyEasing): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 101 }, layers: [{
    id: 'sample', type: 'layer', name: 'Objet de démonstration', target: { ref: 'sample', stage: 'fixture-objects' }, spans: [],
    propertyTimelines: {
      x: { initialValue: { kind: 'number', value: -20 }, keys: [{ frame: 21, value: { kind: 'number', value: 0 } }, { frame: 101, value: { kind: 'number', value: 100 } }], transitions: [{ id: 'move', fromFrame: 21, toFrame: 101, easing: effect }] },
      opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame: 1, value: { kind: 'number', value: 0.25 } }, { frame: 51, value: { kind: 'number', value: 0.75 } }] },
      caption: { initialValue: { kind: 'text', value: 'Départ' }, keys: [{ frame: 51, value: { kind: 'text', value: 'Arrivée' } }] },
      color: { initialValue: { kind: 'color', r: 0, g: 0.3, b: 1, a: 1 }, keys: [{ frame: 21, value: { kind: 'color', r: 0, g: 0.3, b: 1, a: 1 } }, { frame: 101, value: { kind: 'color', r: 1, g: 0.1, b: 0, a: 1 } }], transitions: [{ id: 'color', fromFrame: 21, toFrame: 101 }] }
    }
  }] };
}
let data = documentFor(easing);

function numeric(name: string): number {
  const value = object.values[name];
  if (value?.kind !== 'number') throw new Error(`Expected numeric sample: ${name}`);
  return value.value;
}
function drawObject(): void {
  const color = object.values.color;
  const caption = object.values.caption;
  if (color?.kind !== 'color' || caption?.kind !== 'text') return;
  const x = numeric('x');
  const opacity = numeric('opacity');
  const cssColor = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`;
  context!.clearRect(0, 0, 800, 150);
  context!.strokeStyle = '#768a7c';
  context!.beginPath(); context!.moveTo(80, 125); context!.lineTo(720, 125); context!.stroke();
  context!.save();
  context!.globalAlpha = opacity;
  context!.fillStyle = cssColor;
  context!.fillRect(125 + x * 4, 30, 100, 70);
  context!.restore();
  context!.font = '16px Segoe UI, sans-serif'; context!.textAlign = 'center'; context!.fillStyle = '#20383d';
  context!.fillText(caption.value, 175 + x * 4, 116);
  element('sample-x').textContent = x.toFixed(4);
  element('sample-opacity').textContent = `${(opacity * 100).toFixed(0)} %`;
  element('sample-caption').textContent = caption.value;
  element('sample-color').style.backgroundColor = cssColor;
  element('sample-color-text').textContent = cssColor;
  element('sample-json').textContent = JSON.stringify(object.values, null, 2);
}

let graphBounds = { min: 0, max: 1 };
function graphY(value: number): number { return 230 - (value - graphBounds.min) / (graphBounds.max - graphBounds.min) * 200; }
function drawCursor(): void {
  const progress = Math.max(0, Math.min(1, (currentFrame - 21) / 80));
  const cursor = svgElement('curve-cursor');
  cursor.setAttribute('cx', String(40 + progress * 380));
  cursor.setAttribute('cy', String(graphY(createPropertyEasingFunction(easing)(progress))));
}
function drawGraph(): void {
  const evaluate = createPropertyEasingFunction(easing);
  const points = Array.from({ length: 401 }, (_, index) => evaluate(index / 400));
  const min = Math.min(0, ...points); const max = Math.max(1, ...points);
  const margin = Math.max(0.05, (max - min) * 0.05);
  graphBounds = { min: min - margin, max: max + margin };
  svgElement('curve-line').setAttribute('d', points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${40 + index / 400 * 380} ${graphY(value)}`).join(' '));
  svgElement('curve-zero').setAttribute('d', `M 40 ${graphY(0)} H 420`);
  svgElement('curve-one').setAttribute('d', `M 40 ${graphY(1)} H 420`);
  element('curve-min').textContent = min.toFixed(3); element('curve-max').textContent = max.toFixed(3);
  drawCursor();
}

const stage = createObjectStage<IPreviewObject>({
  id: 'fixture-objects', objects: [{ id: 'sample', label: 'Objet de démonstration', object }],
  apply(target, _values, state) { target.values = state.propertyValues ?? {}; },
  endFrame(time) {
    currentFrame = time.frame;
    input('frame-number').value = String(Number(time.frame.toFixed(2)));
    input('frame-range').value = String(time.frame);
    drawObject(); drawCursor();
  }
});
const player = createPlayer(data, { stage });

function renderParameters(): void {
  const selected = EFFECTS.find((effect) => effect.value === family.value)!;
  const fields = element('parameter-fields'); fields.replaceChildren();
  const parameters = PARAMETERS[selected.value] ?? [];
  element('effect-parameters').hidden = parameters.length === 0;
  element('mode-label').hidden = selected.value === 'bezier';
  parameters.forEach((parameter) => {
    const label = document.createElement('label'); label.textContent = parameter.label;
    const field = document.createElement('input');
    field.type = 'number'; field.name = parameter.name; field.id = `parameter-${parameter.name}`;
    field.min = String(parameter.min); field.max = String(parameter.max); field.step = String(parameter.step ?? 0.1); field.value = String(parameter.value);
    label.append(field); fields.append(label);
  });
}
function readEasing(): PropertyEasing | undefined {
  const selected = EFFECTS.find((effect) => effect.value === family.value);
  if (selected === undefined) return undefined;
  const parameters = Object.fromEntries((PARAMETERS[selected.value] ?? []).map(({ name }) => [name, input(`parameter-${name}`).valueAsNumber]));
  const candidate: unknown = selected.value === 'bezier' ? { kind: 'bezier', ...parameters }
    : { kind: 'effect', family: selected.value, mode: mode.value as PropertyEasingMode, parameters };
  return isPropertyEasing(candidate) ? candidate : undefined;
}
function applyEffect(): void {
  const next = readEasing();
  if (next === undefined) {
    element('effect-status').textContent = 'Saisissez des paramètres valides dans les limites indiquées.';
    return;
  }
  element('effect-status').textContent = '';
  easing = next; data = documentFor(easing); player.update(data); drawGraph();
}
element('effect-controls').addEventListener('submit', (event) => event.preventDefault());
family.addEventListener('change', () => { renderParameters(); applyEffect(); });
mode.addEventListener('change', applyEffect);
element('parameter-fields').addEventListener('input', applyEffect);
for (const id of ['frame-number', 'frame-range']) input(id).addEventListener('input', () => {
  const at = input(id).valueAsNumber;
  if (Number.isFinite(at)) player.seek(at);
});
element('play-pause').addEventListener('click', () => { if (player.playing) player.pause(); else player.play(); });
element('rewind').addEventListener('click', () => { player.pause(); player.seek(1); });
player.on('play', () => { element('play-pause').textContent = 'Pause'; });
player.on('pause', () => { element('play-pause').textContent = 'Lire'; });
player.on('complete', () => { element('play-pause').textContent = 'Lire'; });
renderParameters(); drawGraph(); player.seek(61);
window.propertyTimelinesFixture = { ready: true, player, document: () => data, values: () => object.values };
window.addEventListener('pagehide', (event) => { if (!event.persisted) player.destroy(); });
