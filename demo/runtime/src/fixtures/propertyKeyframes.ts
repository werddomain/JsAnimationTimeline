// demo/runtime/src/fixtures/propertyKeyframes.ts
import { createEditor, createEditorHtmlStage } from '@werddomain/timeline-editor';
import { createObjectStage } from '@werddomain/timeline-runtime';
import type { IStage, ITargetInfo, ITimelineDocument } from '@werddomain/timeline-runtime';
import type { IPropertyKeyframesFixture, IPropertyKeyframesMetrics } from './propertyKeyframesTypes';
import './propertyKeyframes.less';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Élément « ${id} » introuvable.`);
  return found as T;
}

function initialDocument(): ITimelineDocument {
  return {
    version: '2.0.0', settings: { fps: 24, totalFrames: 20 }, layers: [
      { id: 'logo', type: 'layer', name: 'Logo animé', target: { selector: '#keyframes-logo' }, spans: [
        { id: 'motion', kind: 'tween', start: 1, end: 11, easing: 'linear', tracks: {
          x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }],
          y: [{ frame: 1, value: 0 }, { frame: 11, value: 10 }]
        } },
        { id: 'blank', kind: 'blank', start: 12, end: 14 },
        { id: 'last', kind: 'static', start: 15, end: 20, tracks: { x: [{ frame: 15, value: 100 }] } }
      ] },
      { id: 'still', type: 'layer', name: 'Objet fixe', target: { selector: '#keyframes-still' },
        spans: [{ id: 'still-span', kind: 'static', start: 1, end: 20, tracks: { x: [{ frame: 1, value: 5 }] } }] },
      { id: 'object', type: 'layer', name: 'Volume de l’objet', target: { ref: 'object' },
        spans: [{ id: 'object-span', kind: 'tween', start: 1, end: 20, tracks: { volume: [{ frame: 1, value: 0 }] } }] },
      { id: 'locked-folder', type: 'folder', name: 'Dossier verrouillé', locked: true, children: [
        { id: 'locked', type: 'layer', name: 'Objet verrouillé', target: { selector: '#keyframes-locked' },
          spans: [{ id: 'locked-span', kind: 'static', start: 1, end: 20 }] }
      ] }
    ]
  };
}

const metrics: IPropertyKeyframesMetrics = { htmlRenders: 0, objectRenders: 0 };
function showMetrics(): void {
  element('keyframes-renders').textContent = `Rendus réels : HTML ${metrics.htmlRenders} · objet ${metrics.objectRenders}`;
}
const host = element('keyframes-editor');
const html = createEditorHtmlStage(host, { root: element('keyframes-scene') });
const htmlStage: IStage<Element> = {
  ...html,
  render(time, states): void {
    html.render?.(time, states);
    metrics.htmlRenders += 1;
    showMetrics();
  }
};
const object = { volume: 0 };
const objects = createObjectStage({
  id: 'values', unscoped: true,
  properties: [{ name: 'volume', kind: 'value', unit: '', defaultValue: 0 }],
  objects: [{ id: 'object', label: 'Volume de l’objet', object, properties: [{ name: 'volume', unit: 'dB' }] }],
  apply: (target, values) => {
    target.volume = values.volume ?? 0;
    element('keyframes-volume').textContent = String(target.volume);
  }
});
const objectStage: IStage<{ volume: number }> = {
  ...objects,
  // A real list-only stage exercises scoped/unscoped metadata fallback.
  targets: { ...objects.targets, list: () => objects.targets?.list() ?? [], describe: undefined },
  render(time, states): void {
    objects.render?.(time, states);
    metrics.objectRenders += 1;
    showMetrics();
  }
};
const editor = createEditor(host, { data: initialDocument(), stage: [htmlStage, objectStage] });
const service = editor.getService('tweens.propertyKeyframes');
if (service === undefined) throw new Error('Le service de clés de propriété est indisponible.');
const refusals: string[] = [];
const changes: string[] = [];
editor.on('command:refused', ({ reason }) => { refusals.push(reason); element('keyframes-status').textContent = reason; });
editor.on('document:changed', ({ cause }) => changes.push(cause));

function showCapabilities(): void {
  element('keyframes-capabilities').textContent = service?.propertiesFor(element<HTMLSelectElement>('edit-layer').value)
    .map(({ name }) => name).join(', ') ?? '';
}
element('edit-layer').addEventListener('change', showCapabilities);
showCapabilities();
element<HTMLFormElement>('keyframes-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const layerId = element<HTMLSelectElement>('edit-layer').value;
  const name = element<HTMLSelectElement>('edit-property').value;
  const value = element<HTMLInputElement>('edit-value').valueAsNumber;
  const frame = element<HTMLInputElement>('edit-frame').valueAsNumber;
  const beforeRefusals = refusals.length;
  const viaService = event.submitter?.id === 'write-service';
  const changed = viaService ? service.setProperty(layerId, name, value, { frame }) : editor.setProperty(layerId, name, value, { frame });
  if (changed) element('keyframes-status').textContent = 'Propriété enregistrée.';
  else if (beforeRefusals === refusals.length) element('keyframes-status').textContent = 'Valeur identique : aucune modification.';
});

const fixture: IPropertyKeyframesFixture = {
  ready: true, editor, service, object, metrics, refusals, changes,
  async seek(frame: number): Promise<void> {
    editor.playback.seek(frame);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  },
  setObjectProperties(properties: ITargetInfo['properties']): void {
    objects.remove('object');
    objects.add({ id: 'object', label: 'Volume de l’objet', object, properties });
    showCapabilities();
  }
};
window.propertyKeyframes = fixture;
window.addEventListener('pagehide', (event) => { if (!event.persisted) editor.destroy(); });
