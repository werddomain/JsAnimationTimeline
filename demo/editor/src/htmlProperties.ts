// demo/editor/src/htmlProperties.ts
import { createEditor, createEditorHtmlStage, createPropertiesPanelPlugin } from '@kazo-ca/timeline-editor';
import type { PropertyChangedEvent, PropertyTimelineMutationResult } from '@kazo-ca/timeline-editor';
import { composeHtmlDeclarations, resolveHtmlConflict } from '@kazo-ca/timeline-runtime';
import type { IHtmlAnimationContext, IHtmlGradientDefinition, IHtmlResolutionDiagnostic, IPropertyTimeline,
  ITimelineDocument, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
import './htmlProperties.less';

function node<T extends HTMLElement>(id: string, constructor: { new(...args: never[]): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) throw new Error(`Missing demo element: ${id}`);
  return element;
}
const n = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const color = (r: number, g: number, b: number): TimelinePropertyValue => ({ kind: 'color', r, g, b, a: 1 });
const held = (initialValue: TimelinePropertyValue, frame: number, value: TimelinePropertyValue, label: string): IPropertyTimeline => ({
  initialValue, keys: [{ frame, value }], label
});
const gradient: IHtmlGradientDefinition = { id: 'fill', cssName: 'background-image', type: 'linear', angle: 90,
  centerX: 50, centerY: 50, radiusX: 50, radiusY: 50, stops: [
    { id: 'left', color: { kind: 'color', r: 1, g: 0, b: 0, a: 1 }, opacity: 1, position: 0, present: true },
    { id: 'middle', color: { kind: 'color', r: 0, g: 1, b: 0, a: 1 }, opacity: .5, position: 50, present: false },
    { id: 'right', color: { kind: 'color', r: 0, g: 0, b: 1, a: 1 }, opacity: 1, position: 100, present: true }
  ] };
const initialContext: IHtmlAnimationContext = { version: 1, gradients: { gradient: [gradient] }, bindings: {
  buttons: { 'margin-top': { kind: 'style', cssName: 'margin-top', unit: 'px' } },
  transform: { zIndex: { kind: 'style', cssName: 'z-index', unit: '' } },
  gradient: {
    gradientAngle: { kind: 'gradient', gradientId: 'fill', component: 'angle' },
    leftColor: { kind: 'gradient', gradientId: 'fill', stopId: 'left', component: 'color' },
    leftPresent: { kind: 'gradient', gradientId: 'fill', stopId: 'left', component: 'present' },
    middlePresent: { kind: 'gradient', gradientId: 'fill', stopId: 'middle', component: 'present' },
    middleOpacity: { kind: 'gradient', gradientId: 'fill', stopId: 'middle', component: 'opacity' },
    rightPosition: { kind: 'gradient', gradientId: 'fill', stopId: 'right', component: 'position' }
  }
} };
const initial: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 100 }, layers: [
  { id: 'buttons', type: 'layer', name: '.button — groupe', target: { selector: '.button' }, spans: [],
    propertyTimelines: { opacity: held(n(1), 1, n(.5), 'Opacité') } },
  { id: 'specific', type: 'layer', name: '#button-2 — spécifique', target: { selector: '#button-2' }, spans: [],
    propertyTimelines: { opacity: held(n(1), 50, n(.8), 'Opacité') } },
  { id: 'conflict-a', type: 'layer', name: '.conflict-a — 30 %', target: { selector: '.conflict-a' }, spans: [],
    propertyTimelines: { opacity: held(n(1), 1, n(.3), 'Opacité') } },
  { id: 'conflict-b', type: 'layer', name: '.conflict-b — 70 %', target: { selector: '.conflict-b' }, spans: [],
    propertyTimelines: { opacity: held(n(1), 1, n(.7), 'Opacité') } },
  { id: 'gradient', type: 'layer', name: 'Dégradé', target: { selector: '#gradient-box' }, spans: [], propertyTimelines: {
    gradientAngle: { initialValue: n(90), label: 'Angle', group: 'Dégradé', keys: [{ frame: 1, value: n(90) }, { frame: 100, value: n(270) }],
      transitions: [{ id: 'gradient-angle-motion', fromFrame: 1, toFrame: 100 }] },
    leftColor: { initialValue: color(1, 0, 0), label: 'Couleur gauche', group: 'Dégradé',
      keys: [{ frame: 1, value: color(1, 0, 0) }, { frame: 100, value: color(1, 1, 0) }],
      transitions: [{ id: 'gradient-color-motion', fromFrame: 1, toFrame: 100 }] },
    leftPresent: { ...held({ kind: 'boolean', value: true }, 1, { kind: 'boolean', value: true }, 'Présence du point gauche'), group: 'Dégradé' },
    middlePresent: { ...held({ kind: 'boolean', value: false }, 1, { kind: 'boolean', value: false }, 'Présence du point central'), group: 'Dégradé' },
    middleOpacity: { ...held(n(.5), 1, n(.5), 'Opacité du point central'), group: 'Dégradé' },
    rightPosition: { ...held(n(100), 1, n(100), 'Position du point droit'), group: 'Dégradé' }
  } },
  { id: 'transform', type: 'layer', name: 'Carré incliné', target: { selector: '#transform-box' }, spans: [],
    propertyTimelines: { x: held(n(12), 1, n(12), 'Position X'),
      zIndex: { initialValue: n(1), label: 'Ordre de superposition', keys: [{ frame: 1, value: n(1) }, { frame: 100, value: n(2) }] } } }
] };
const gradientBox = node('gradient-box', HTMLDivElement);
const initialGradient = composeHtmlDeclarations(gradientBox, { angle: n(90) }, {
  angle: { binding: { kind: 'gradient', gradientId: 'fill', component: 'angle' }, valueKind: 'number' }
}, [gradient]);
gradientBox.style.backgroundImage = initialGradient.declarations['background-image'];
const host = node('editor-host', HTMLDivElement);
const stage = createEditorHtmlStage(host, { root: node('html-scene', HTMLElement), animationContext: initialContext });
const editor = createEditor(host, { data: initial, stage, plugins: [createPropertiesPanelPlugin()] });
const status = node('status', HTMLParagraphElement);
const frameInput = node('frame-input', HTMLInputElement);
const frameOutput = node('frame-output', HTMLOutputElement);
const projectJson = node('project-json', HTMLPreElement);
const changes: PropertyChangedEvent[] = [];
const undoDecisions: IHtmlAnimationContext[] = [];
const redoDecisions: IHtmlAnimationContext[] = [];
let destroyed = false;
let saved = JSON.stringify({ timeline: initial, html: initialContext });
let lastDocument = initial;
let lastContext = initialContext;
let lastFrame = 1;

function project(): IHtmlDemoProject { return { timeline: destroyed ? lastDocument : editor.document, html: destroyed ? lastContext : stage.animationContext }; }
function renderProject(): void { projectJson.textContent = JSON.stringify(project(), null, 2); }
function updateConflict(): void {
  const pending = stage.diagnostics.find((entry) => entry.code === 'priority-conflict');
  node('conflict-summary', HTMLParagraphElement).textContent = pending === undefined ? 'La décision enregistrée fixe la priorité.' : pending.message;
  node('resolve-conflict', HTMLButtonElement).disabled = destroyed || pending === undefined;
  node('undo-decision', HTMLButtonElement).disabled = destroyed || undoDecisions.length === 0;
  node('redo-decision', HTMLButtonElement).disabled = destroyed || redoDecisions.length === 0;
}
function inspectBases(): void {
  const opacity = stage.inspectProperty({ selector: '.button' }, 'opacity', { layerId: 'buttons' });
  const margin = stage.inspectProperty({ selector: '.button' }, 'margin-top', { layerId: 'buttons', valueKind: 'number' });
  const percent = opacity.initialValue?.kind === 'number' ? `${Math.round(opacity.initialValue.value * 100)} %` : 'indisponible';
  node('base-inspection', HTMLParagraphElement).textContent = `${opacity.memberCount} éléments · opacité d’origine : ${percent}. L’aperçu reste inchangé.`;
  node('margin-reason', HTMLParagraphElement).textContent = margin.reason ?? 'La marge possède une valeur commune.';
  node('margin-info', HTMLSpanElement).title = margin.reason ?? '';
  node('animate-margin', HTMLButtonElement).disabled = !margin.editable;
}
function edit(result: PropertyTimelineMutationResult): void {
  status.textContent = result.status === 'refused' ? result.reason : result.status === 'changed' ? 'Clé enregistrée dans l’historique de la Timeline.' : 'La valeur est déjà enregistrée.';
  renderProject();
}
editor.on('property:changed', (event) => { changes.push(event); });
editor.on('command:refused', ({ reason }) => { status.textContent = reason; });
editor.on('document:changed', () => { renderProject(); updateConflict(); });
editor.on('document:loaded', () => { renderProject(); updateConflict(); });
editor.on('frame:render', ({ sample }) => {
  frameInput.value = String(sample.time.integerFrame); frameOutput.value = `Image ${sample.time.integerFrame} / 100`;
  frameOutput.dataset.frame = String(sample.time.integerFrame);
});
node('seek-form', HTMLFormElement).addEventListener('submit', (event) => {
  event.preventDefault(); const frame = Number(frameInput.value);
  if (Number.isInteger(frame) && frame >= 1 && frame <= 100) { editor.playback.pause(); editor.playback.seek(frame); }
});
node('inspect-bases', HTMLButtonElement).addEventListener('click', inspectBases);
node('show-middle', HTMLButtonElement).addEventListener('click', () => edit(editor.propertyTimelines.set('gradient', 'middlePresent', { kind: 'boolean', value: true })));
node('hide-middle', HTMLButtonElement).addEventListener('click', () => edit(editor.propertyTimelines.set('gradient', 'middlePresent', { kind: 'boolean', value: false })));
node('hide-left', HTMLButtonElement).addEventListener('click', () => edit(editor.propertyTimelines.set('gradient', 'leftPresent', { kind: 'boolean', value: false })));
node('quarter-opacity', HTMLButtonElement).addEventListener('click', () => edit(editor.propertyTimelines.set('gradient', 'middleOpacity', n(.25))));
node('gradient-purple', HTMLButtonElement).addEventListener('click', () => edit(editor.propertyTimelines.set('gradient', 'leftColor', color(.5, 0, 1))));
node('transform-form', HTMLFormElement).addEventListener('submit', (event) => {
  event.preventDefault(); const value = Number(node('x-input', HTMLInputElement).value);
  if (Number.isFinite(value)) edit(editor.propertyTimelines.set('transform', 'x', n(value)));
});

const dialog = node('conflict-dialog', HTMLDialogElement);
const choice = node('conflict-choice', HTMLSelectElement);
let pendingConflict: IHtmlResolutionDiagnostic | undefined;
node('resolve-conflict', HTMLButtonElement).addEventListener('click', () => {
  pendingConflict = stage.diagnostics.find((entry) => entry.code === 'priority-conflict');
  if (pendingConflict === undefined) return;
  node('conflict-detail', HTMLParagraphElement).textContent = pendingConflict.message;
  choice.replaceChildren(...pendingConflict.choices.map((id) => {
    const option = document.createElement('option'); option.value = id;
    option.textContent = id === 'conflict-a' ? '.conflict-a : opacité 30 %' : '.conflict-b : opacité 70 %';
    return option;
  }));
  dialog.showModal();
});
node('cancel-conflict', HTMLButtonElement).addEventListener('click', () => { dialog.close(); pendingConflict = undefined; status.textContent = 'Choix annulé ; le projet est inchangé.'; });
dialog.addEventListener('cancel', () => { pendingConflict = undefined; status.textContent = 'Choix annulé ; le projet est inchangé.'; });
node('confirm-conflict', HTMLButtonElement).addEventListener('click', () => {
  const current = stage.diagnostics.find((entry) => entry.id === pendingConflict?.id && entry.signature === pendingConflict.signature);
  if (current === undefined) { status.textContent = 'Le contexte a changé. Ouvrez de nouveau le conflit.'; dialog.close(); return; }
  const previous = stage.animationContext;
  stage.setAnimationContext(resolveHtmlConflict(previous, current, choice.value));
  undoDecisions.push(previous); redoDecisions.length = 0; dialog.close(); pendingConflict = undefined;
  updateConflict(); renderProject(); status.textContent = 'Priorité enregistrée ; aucune clé ajoutée.';
});
node('undo-decision', HTMLButtonElement).addEventListener('click', () => {
  const previous = undoDecisions.pop(); if (previous === undefined) return;
  redoDecisions.push(stage.animationContext); stage.setAnimationContext(previous); updateConflict(); renderProject();
});
node('redo-decision', HTMLButtonElement).addEventListener('click', () => {
  const next = redoDecisions.pop(); if (next === undefined) return;
  undoDecisions.push(stage.animationContext); stage.setAnimationContext(next); updateConflict(); renderProject();
});
node('save-project', HTMLButtonElement).addEventListener('click', () => { saved = JSON.stringify(project()); status.textContent = 'Projet mémorisé : clés, dégradés et décisions de priorité.'; });
node('reload-project', HTMLButtonElement).addEventListener('click', () => {
  const snapshot = JSON.parse(saved) as IHtmlDemoProject;
  editor.playback.pause(); stage.setAnimationContext(snapshot.html); editor.load(snapshot.timeline);
  undoDecisions.length = 0; redoDecisions.length = 0; updateConflict(); renderProject(); inspectBases();
  status.textContent = 'Projet rechargé ; clés et décisions conservées.';
});
node('stop-preview', HTMLButtonElement).addEventListener('click', () => {
  lastDocument = editor.document; lastContext = stage.animationContext; lastFrame = editor.playback.frame;
  editor.destroy(); destroyed = true;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-demo-action]').forEach((control) => { control.disabled = true; });
  status.textContent = 'Aperçu terminé. Les styles d’origine sont restaurés.';
});
inspectBases(); updateConflict(); renderProject();
window.htmlPropertiesFixture = Object.freeze({ ready: true,
  snapshot: () => JSON.parse(JSON.stringify({ ...project(), frame: destroyed ? lastFrame : editor.playback.frame,
    changes, diagnostics: destroyed ? [] : stage.diagnostics })) as IHtmlDemoSnapshot,
  point: (layerId: string, property: string, frame: number) => {
    const grid = editor.getService('frames.grid');
    const row = grid?.rows().find((entry) => entry.kind === 'property' && entry.layerId === layerId && entry.property === property);
    const bounds = grid?.element()?.getBoundingClientRect();
    if (row === undefined || bounds === undefined || grid === undefined) throw new Error('Property row geometry unavailable.');
    return { x: bounds.left + (frame - .5) * grid.frameWidth(), y: bounds.top + (row.index + .5) * grid.rowHeight() };
  }
});
window.addEventListener('pagehide', (event) => { if (!event.persisted && !destroyed) editor.destroy(); });

interface IHtmlDemoProject { readonly timeline: ITimelineDocument; readonly html: IHtmlAnimationContext }
interface IHtmlDemoSnapshot extends IHtmlDemoProject {
  readonly frame: number; readonly changes: readonly PropertyChangedEvent[]; readonly diagnostics: readonly IHtmlResolutionDiagnostic[];
}
/** Read-only observations for browser regression scenarios; edits use visible controls. */
export interface IHtmlPropertiesFixture {
  readonly ready: true;
  snapshot(): IHtmlDemoSnapshot;
  point(layerId: string, property: string, frame: number): { readonly x: number; readonly y: number };
}
declare global { interface Window { htmlPropertiesFixture?: IHtmlPropertiesFixture } }
