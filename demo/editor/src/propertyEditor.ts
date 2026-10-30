// demo/editor/src/propertyEditor.ts
import { createEditor, createPropertiesPanelPlugin } from '@kazo-ca/timeline-editor';
import type { IEditor, PropertyChangedEvent } from '@kazo-ca/timeline-editor';
import { createObjectStage } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument, TimelinePropertyValue, TimelinePropertyValues } from '@kazo-ca/timeline-runtime';
import './propertyEditor.less';

function node<T extends HTMLElement>(id: string, constructor: { new(...args: never[]): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof constructor)) throw new Error(`Missing demo element: ${id}`);
  return found;
}
const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const initial: ITimelineDocument = {
  version: '2.0.0', settings: { fps: 24, totalFrames: 100 }, layers: [
    { id: 'card', type: 'layer', name: 'Carte', target: { ref: 'card' }, spans: [], propertyTimelines: {
      opacity: { label: 'Opacité', initialValue: number(1), keys: [{ frame: 1, value: number(0.2) }, { frame: 100, value: number(1) }] },
      x: { label: 'Position X', initialValue: number(0), keys: [{ frame: 1, value: number(0) }, { frame: 100, value: number(220) }] },
      rotation: { label: 'Rotation', initialValue: number(0), keys: [{ frame: 1, value: number(0) }] }
    } },
    { id: 'orb', type: 'layer', name: 'Orbe', target: { ref: 'orb' }, spans: [], propertyTimelines: {
      x: { label: 'Position X', initialValue: number(0), keys: [{ frame: 1, value: number(0) }, { frame: 100, value: number(140) }],
        transitions: [{ id: 'orb-motion', fromFrame: 1, toFrame: 100, easing: { kind: 'effect', family: 'elastic', mode: 'out' } }] }
    } }
  ]
};
const canvas = node('preview', HTMLCanvasElement);
const drawing = canvas.getContext('2d');
if (drawing === null) throw new Error('Canvas unavailable.');
const context = drawing;
const values = new Map<string, TimelinePropertyValues>();
function value(id: string, property: string, fallback = 0): number {
  const sample = values.get(id)?.[property];
  return sample?.kind === 'number' ? sample.value : fallback;
}
function draw(): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#d9e4e0';
  for (let x = 0; x < canvas.width; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 160); context.stroke(); }
  context.save(); context.translate(90 + value('card', 'x'), 80);
  context.rotate(value('card', 'rotation') * Math.PI / 180); context.globalAlpha = value('card', 'opacity', 1);
  context.fillStyle = '#176c63'; context.fillRect(-45, -30, 90, 60);
  context.fillStyle = 'white'; context.font = '600 18px Segoe UI'; context.fillText('Carte', -24, 6); context.restore();
  context.fillStyle = '#cf642f'; context.beginPath(); context.arc(580 + value('orb', 'x'), 80, 25, 0, 2 * Math.PI); context.fill();
}
const stage = createObjectStage({ id: 'property-editor-objects', unscoped: true,
  objects: [{ id: 'card', label: 'Carte', object: { id: 'card' } }, { id: 'orb', label: 'Orbe', object: { id: 'orb' } }],
  apply(object, _numeric, state) { values.set(object.id, state.propertyValues ?? {}); }, endFrame: draw
});
const editor = createEditor(node('editor-host', HTMLDivElement), { data: initial, stage, plugins: [createPropertiesPanelPlugin()] });
let saved = JSON.stringify(initial);
const changes: PropertyChangedEvent[] = [];
const status = node('status', HTMLParagraphElement);
const json = node('document-json', HTMLPreElement);
function renderDocument(): void { json.textContent = JSON.stringify(editor.document, null, 2); }
editor.on('document:changed', renderDocument);
editor.on('document:loaded', renderDocument);
editor.on('property:changed', (event) => { changes.push(event); status.textContent = `${event.property} · ${event.label}`; });
editor.on('command:refused', ({ reason }) => { status.textContent = reason; });
node('save-document', HTMLButtonElement).addEventListener('click', () => { saved = JSON.stringify(editor.document); status.textContent = 'Copie mémorisée.'; });
node('reload-document', HTMLButtonElement).addEventListener('click', () => { editor.load(JSON.parse(saved) as ITimelineDocument); status.textContent = 'Copie rechargée.'; });
node('reset-document', HTMLButtonElement).addEventListener('click', () => { editor.load(initial); editor.playback.seek(1); status.textContent = 'Démonstration réinitialisée.'; });
renderDocument(); draw();
window.propertyEditorFixture = { ready: true, editor, events: () => changes };
window.addEventListener('pagehide', (event) => { if (!event.persisted) editor.destroy(); });

/** Observation bridge for reusable browser demonstrations. */
export interface IPropertyEditorFixture {
  readonly ready: true;
  readonly editor: IEditor;
  events(): readonly PropertyChangedEvent[];
}
declare global { interface Window { propertyEditorFixture?: IPropertyEditorFixture; } }
