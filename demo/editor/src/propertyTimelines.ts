// demo/editor/src/propertyTimelines.ts
import { createEditor } from '@kazo-ca/timeline-editor';
import type { IPropertyTimelineTransaction, PropertyChangedEvent, PropertyTimelineMutationResult } from '@kazo-ca/timeline-editor';
import { collectLayers, createObjectStage } from '@kazo-ca/timeline-runtime';
import type { IPropertyTimeline, ITimelineDocument, TimelinePropertyValue, TimelinePropertyValues } from '@kazo-ca/timeline-runtime';
import { createEffectControls } from './propertyTimelinesEffects';
import type { IPropertyEditingFixture } from './propertyTimelinesTypes';
import './propertyTimelines.less';

function element<T extends Element>(id: string, constructor: { new(...args: never[]): T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof constructor)) throw new Error(`Missing or invalid property API element: ${id}`);
  return node;
}
const input = (id: string): HTMLInputElement => element(id, HTMLInputElement);
const select = (id: string): HTMLSelectElement => element(id, HTMLSelectElement);
const button = (id: string): HTMLButtonElement => element(id, HTMLButtonElement);
const html = (id: string): HTMLElement => element(id, HTMLElement);
const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const initialValues: TimelinePropertyValues = { x: number(0), y: number(0), opacity: number(1) };
const data: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 100 }, layers: [{
  id: 'object', type: 'layer', name: 'Objet de démonstration', target: { ref: 'object', stage: 'property-api-objects' }, spans: [],
  propertyTimelines: { opacity: { initialValue: number(1), keys: [{ frame: 1, value: number(0.2) }, { frame: 100, value: number(1) }],
    transitions: [{ id: 'opacity-fade', fromFrame: 1, toFrame: 100, easing: { kind: 'effect', family: 'sine', mode: 'in' } }] } }
}] };
const object = { values: initialValues };
const canvas = element('object-preview', HTMLCanvasElement);
const canvasContext = canvas.getContext('2d');
if (canvasContext === null) throw new Error('Canvas drawing unavailable.');
const context = canvasContext;
const curve = element('curve-line', SVGPathElement);
const cursor = element('curve-cursor', SVGPathElement);
const transitionSelect = select('transition-id');
let transaction: IPropertyTimelineTransaction | undefined;
let changes: readonly PropertyChangedEvent[] = [];

function numeric(values: TimelinePropertyValues, property: string): number {
  const value = values[property] ?? initialValues[property];
  return value?.kind === 'number' ? value.value : 0;
}
function drawObject(): void {
  const x = numeric(object.values, 'x'); const y = numeric(object.values, 'y'); const opacity = numeric(object.values, 'opacity');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#c1cbc1'; context.lineWidth = 1;
  for (let at = 0; at <= 1000; at += 50) { context.beginPath(); context.moveTo(at, 0); context.lineTo(at, 180); context.stroke(); }
  for (let at = 0; at <= 180; at += 30) { context.beginPath(); context.moveTo(0, at); context.lineTo(1000, at); context.stroke(); }
  context.save(); context.translate(160 + x * 3, 55 + y); context.globalAlpha = opacity;
  context.fillStyle = '#11695f'; context.fillRect(0, 0, 110, 70);
  context.fillStyle = '#ffffff'; context.font = 'bold 22px Segoe UI, sans-serif'; context.fillText('JST', 34, 43); context.restore();
  html('value-x').textContent = x.toFixed(2); html('value-y').textContent = y.toFixed(2);
  html('value-opacity').textContent = `${(opacity * 100).toFixed(2)} %`;
}
function drawCursor(frame: number): void {
  const x = 40 + (frame - 1) / 99 * 395;
  cursor.setAttribute('d', `M ${x} 20 V 195`);
}
const stage = createObjectStage<typeof object>({
  id: 'property-api-objects', objects: [{ id: 'object', label: 'Objet de démonstration', object }],
  apply(target, _values, state) { target.values = { ...initialValues, ...state.propertyValues }; },
  endFrame(time) {
    input('frame-number').value = String(time.integerFrame);
    input('frame-range').value = String(time.integerFrame);
    drawObject(); drawCursor(time.frame);
  }
});
const editor = createEditor(html('editor-host'), { data, stage, defaultPlugins: false });
const effects = createEffectControls(select('effect-family'), select('effect-mode'), html('parameter-fields'), html('mode-label'));

function track(property: string): IPropertyTimeline | undefined {
  return collectLayers(editor.document)[0].propertyTimelines?.[property];
}
function report(result: PropertyTimelineMutationResult): void {
  html('command-status').textContent = result.status === 'refused' ? result.reason
    : result.status === 'noop' ? 'Aucune modification nécessaire.' : 'Modification enregistrée. Vous pouvez l’annuler.';
}
function currentValue(): void {
  const values = editor.sample().layer('object')?.propertyValues ?? initialValues;
  input('property-value').value = String(Number(numeric(values, select('property-name').value).toFixed(6)));
}
function renderCurve(): void {
  const points = Array.from({ length: 199 }, (_, index) => {
    const value = editor.sample(1 + index / 2).layer('object')?.propertyValues?.opacity;
    return value?.kind === 'number' ? value.value : 1;
  });
  curve.setAttribute('d', points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${40 + index / 198 * 395} ${195 - value * 170}`).join(' '));
}
function renderTracks(): void {
  const rows = html('track-rows'); rows.replaceChildren();
  for (const [property, label] of [['opacity', 'Opacité'], ['x', 'Position X'], ['y', 'Position Y']]) {
    const timeline = track(property); const row = document.createElement('tr'); row.id = `track-${property}`;
    const name = document.createElement('th'); name.scope = 'row'; name.textContent = label;
    const keys = document.createElement('td'); keys.textContent = timeline?.keys.map((key) => String(key.frame)).join(' · ') || 'Aucune clé';
    const transitions = document.createElement('td'); transitions.textContent = timeline?.transitions?.map((entry) => `${entry.fromFrame} → ${entry.toFrame}`).join(' · ') || 'Maintien';
    row.append(name, keys, transitions); rows.append(row);
  }
}
function showSelectedEffect(): void {
  const transition = track('opacity')?.transitions?.find((entry) => entry.id === transitionSelect.value);
  effects.show(transition?.source?.easing ?? transition?.easing);
}
function renderTransitionOptions(): void {
  const previous = transitionSelect.value;
  transitionSelect.replaceChildren();
  for (const transition of track('opacity')?.transitions ?? []) {
    transitionSelect.add(new Option(`${transition.fromFrame} → ${transition.toFrame}${transition.source ? ' · courbe préservée' : ''}`, transition.id));
  }
  if ([...transitionSelect.options].some((option) => option.value === previous)) transitionSelect.value = previous;
  if (transitionSelect.options.length > 0) showSelectedEffect();
  button('apply-effect').disabled = transitionSelect.options.length === 0;
  button('remove-transition').disabled = transitionSelect.options.length === 0;
}
function renderTransaction(): void {
  const active = transaction?.active ?? false;
  element('gesture-fields', HTMLFieldSetElement).disabled = !active;
  element('property-edit-fields', HTMLFieldSetElement).disabled = active;
  element('effect-edit-fields', HTMLFieldSetElement).disabled = active;
  button('begin-gesture').disabled = active;
  button('undo').disabled = !editor.canUndo; button('redo').disabled = !editor.canRedo;
}
function renderDocument(): void {
  renderTracks(); renderTransitionOptions(); renderCurve(); renderTransaction(); currentValue();
  html('document-json').textContent = JSON.stringify(editor.toJSON(), null, 2);
}
function seek(frame: number): void {
  if (!Number.isInteger(frame) || frame < 1 || frame > 100) return;
  editor.playback.pause(); editor.playback.seek(frame); currentValue();
}
function editProperty(capture: boolean): void {
  const property = select('property-name').value;
  const options = { initialValue: initialValues[property] };
  report(capture ? editor.propertyTimelines.capture('object', property, options)
    : editor.propertyTimelines.set('object', property, number(input('property-value').valueAsNumber), options));
}
function applyEffect(create: boolean): void {
  const easing = effects.read();
  if (easing === undefined) { html('command-status').textContent = 'Saisissez des paramètres d’accélération valides.'; return; }
  report(create ? editor.propertyTimelines.createTransition('object', 'opacity', input('transition-frames').value.split(',').map((value) => Number(value.trim())), easing)
    : editor.propertyTimelines.setEasing('object', 'opacity', transitionSelect.value, easing));
}
function cancelGesture(): void {
  if (transaction?.active !== true) return;
  transaction.cancel(); transaction = undefined; renderTransaction();
  html('command-status').textContent = 'Déplacement annulé. Le document et l’historique précédent sont conservés.';
}

editor.on('document:changed', renderDocument);
editor.on('history:changed', renderTransaction);
editor.on('property:changed', (event) => {
  changes = [...changes.slice(-19), event];
  html('last-change').textContent = `${event.property} · ${event.cause}${event.frame === undefined ? '' : ` · image ${event.frame}`} · ${event.label}`;
});
for (const id of ['frame-number', 'frame-range']) input(id).addEventListener('input', () => seek(input(id).valueAsNumber));
select('property-name').addEventListener('change', currentValue);
transitionSelect.addEventListener('change', showSelectedEffect);
button('set-value').addEventListener('click', () => editProperty(false));
button('capture-key').addEventListener('click', () => editProperty(true));
button('apply-effect').addEventListener('click', () => applyEffect(false));
button('create-transition').addEventListener('click', () => applyEffect(true));
button('remove-transition').addEventListener('click', () => report(editor.propertyTimelines.removeTransition('object', 'opacity', transitionSelect.value)));
button('undo').addEventListener('click', () => { editor.undo(); html('command-status').textContent = 'Modification annulée.'; });
button('redo').addEventListener('click', () => { editor.redo(); html('command-status').textContent = 'Modification rétablie.'; });
button('rewind').addEventListener('click', () => seek(1));
button('play-pause').addEventListener('click', () => editor.playback.toggle());
editor.on('playback:play', () => { button('play-pause').textContent = 'Pause'; });
editor.on('playback:pause', () => { button('play-pause').textContent = 'Lire'; });
editor.on('playback:complete', () => { button('play-pause').textContent = 'Lire'; });
button('begin-gesture').addEventListener('click', () => {
  editor.playback.pause();
  transaction = editor.propertyTimelines.beginTransaction('Déplacer X/Y');
  renderTransaction(); input('gesture-x').focus();
  html('command-status').textContent = 'Déplacement commencé. Prévisualisez les valeurs, puis validez ou appuyez sur Échap.';
});
button('preview-gesture').addEventListener('click', () => {
  if (transaction?.active !== true) return;
  const x = input('gesture-x').valueAsNumber; const y = input('gesture-y').valueAsNumber;
  if (!Number.isFinite(x) || !Number.isFinite(y)) { html('command-status').textContent = 'Saisissez deux positions numériques.'; return; }
  const first = editor.propertyTimelines.set('object', 'x', number(x), { initialValue: initialValues.x });
  if (first.status === 'refused') { report(first); return; }
  report(editor.propertyTimelines.set('object', 'y', number(y), { initialValue: initialValues.y }));
});
button('commit-gesture').addEventListener('click', () => {
  if (transaction?.active !== true) return;
  transaction.commit(); transaction = undefined; renderTransaction();
  html('command-status').textContent = 'Déplacement validé : une seule annulation pour X et Y.';
});
button('cancel-gesture').addEventListener('click', cancelGesture);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && transaction?.active === true) { event.preventDefault(); cancelGesture(); }
});
renderDocument(); editor.playback.seek(50); currentValue();
const fixture: IPropertyEditingFixture = { ready: true, editor, objectValues: () => object.values,
  events: () => changes, transactionActive: () => transaction?.active ?? false };
window.propertyEditingFixture = fixture;
window.addEventListener('pagehide', (event) => { if (!event.persisted) editor.destroy(); });
