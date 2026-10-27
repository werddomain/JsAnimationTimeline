// demo/runtime/src/fixtures/propertiesPanel.ts
import { createEditor, createEditorHtmlStage, createPropertiesPanelPlugin } from '@werddomain/timeline-editor';
import { createObjectStage } from '@werddomain/timeline-runtime';
import type { IStage, ITimelineDocument } from '@werddomain/timeline-runtime';
import type { IPropertiesPanelFixture, IPropertiesPanelMetrics } from './propertiesPanelTypes';
import './propertiesPanel.less';

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error('Élément introuvable : ' + id);
  return found;
}
function data(): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 20 }, layers: [
    { id: 'logo', type: 'layer', name: 'Logo animé', target: { selector: '#panel-logo' }, spans: [
      { id: 'motion', kind: 'tween', start: 1, end: 11, easing: 'linear', tracks: {
        x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }],
        y: [{ frame: 1, value: 0 }, { frame: 11, value: 10 }]
      } },
      { id: 'blank', kind: 'blank', start: 12, end: 14 },
      { id: 'last', kind: 'static', start: 15, end: 18, tracks: { x: [{ frame: 15, value: 100 }] } }
    ] },
    { id: 'still', type: 'layer', name: 'Objet fixe', target: { selector: '#panel-still' },
      spans: [{ id: 'still-span', kind: 'static', start: 1, end: 20, tracks: { x: [{ frame: 1, value: 5 }] } }] },
    { id: 'object', type: 'layer', name: 'Objet audio', target: { ref: 'audio' },
      spans: [{ id: 'object-span', kind: 'tween', start: 1, end: 20 }] },
    { id: 'locked-folder', type: 'folder', name: 'Dossier verrouillé', locked: true, children: [
      { id: 'locked', type: 'layer', name: 'Objet verrouillé', target: { selector: '#panel-locked' },
        spans: [{ id: 'locked-span', kind: 'static', start: 1, end: 20 }] }
    ] }
  ] };
}

const metrics: IPropertiesPanelMetrics = { htmlRenders: 0, objectRenders: 0 };
function showMetrics(): void {
  element('panel-metrics').textContent = 'Rendus réels · HTML ' + metrics.htmlRenders + ' / objet ' + metrics.objectRenders;
}
const host = element('panel-editor');
const html = createEditorHtmlStage(host, { root: element('panel-scene') });
const htmlStage: IStage<Element> = { ...html, render(time, states): void {
  html.render?.(time, states); ++metrics.htmlRenders; showMetrics();
} };
const object = { volume: 0.5 };
const objects = createObjectStage({
  id: 'audio', unscoped: true,
  properties: [{ name: 'volume', kind: 'value', label: 'Volume audio', unit: 'dB', defaultValue: 0.5, min: 0, max: 1 }],
  objects: [{ id: 'audio', label: 'Objet audio', object, properties: ['volume'] }],
  apply(target, values): void {
    target.volume = values.volume ?? 0.5;
    element('panel-volume').textContent = String(target.volume);
  }
});
let pendingCommandQuery: (() => void) | undefined;
let pendingCommandQueryReads = 0;
let secondReadCallbackRuns = 0;
const objectStage: IStage<{ volume: number }> = { ...objects,
  targets: { ...objects.targets,
    list: () => objects.targets?.list() ?? [],
    describe(target) {
      if (pendingCommandQuery !== undefined && --pendingCommandQueryReads === 0) {
        const callback = pendingCommandQuery;
        pendingCommandQuery = undefined;
        ++secondReadCallbackRuns;
        callback();
      }
      return objects.targets?.describe?.(target);
    }
  },
  render(time, states): void {
    objects.render?.(time, states); ++metrics.objectRenders; showMetrics();
  }
};
const editor = createEditor(host, { data: data(), stage: [htmlStage, objectStage], plugins: [createPropertiesPanelPlugin()] });
const secondary = createEditor(element('panel-secondary'), { data: data(), stage: false, plugins: [createPropertiesPanelPlugin()] });
const service = editor.getService('properties.panel');
const secondService = secondary.getService('properties.panel');
if (service === undefined || secondService === undefined) throw new Error('Panneau optionnel indisponible.');
const changes: string[] = [];
const refusals: string[] = [];
editor.on('document:changed', ({ cause }) => changes.push(cause));
editor.on('command:refused', ({ reason }) => refusals.push(reason));
const fixture: IPropertiesPanelFixture = {
  ready: true, editor, secondary, service, secondService, object, metrics, changes, refusals,
  get secondReadCallbackRuns(): number { return secondReadCallbackRuns; },
  armSecondPropertyRead(callback: () => void): void {
    // Enter reads once in S1 and again inside the real W2 command.
    pendingCommandQueryReads = 2;
    pendingCommandQuery = callback;
  },
  async seek(frame: number): Promise<void> {
    editor.playback.seek(frame);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  },
  setCapabilities(properties): void {
    objects.remove('audio');
    objects.add({ id: 'audio', label: 'Objet audio', object, properties });
  }
};
window.propertiesPanel = fixture;
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) { editor.destroy(); secondary.destroy(); }
});
