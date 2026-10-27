// demo/runtime/src/fixtures/propertyApi.ts
import { createEditor } from '@werddomain/timeline-editor';
import { createObjectStage, createPropertyRegistry } from '@werddomain/timeline-runtime';
import type { ITargetInfo, ITimelineDocument } from '@werddomain/timeline-runtime';
import type { IPropertyApiFixture } from './propertyApiTypes';

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Élément « ${id} » introuvable.`);
  return found;
}

const data: ITimelineDocument = {
  version: '2.0.0', settings: { fps: 24, totalFrames: 20 },
  layers: [
    {
      id: 'logo', type: 'layer', name: 'Logo', target: { selector: '#property-logo' },
      spans: [
        { id: 'motion', start: 1, end: 11, kind: 'tween', easing: 'linear', tracks: {
          x: [{ frame: 1, value: 0 }, { frame: 11, value: 100 }],
          y: [{ frame: 1, value: 10 }, { frame: 11, value: 30 }]
        } },
        { id: 'blank', start: 12, end: 14, kind: 'blank' },
        { id: 'last', start: 15, end: 20, kind: 'static', tracks: { x: [{ frame: 15, value: 100 }] } }
      ]
    },
    {
      id: 'still', type: 'layer', name: 'Fixe', target: { selector: '#property-still' },
      spans: [{ id: 'still-content', start: 1, end: 20, kind: 'static', tracks: { x: [{ frame: 1, value: 5 }] } }]
    },
    {
      id: 'locked-folder', type: 'folder', name: 'Dossier verrouillé', locked: true, children: [{
        id: 'locked', type: 'layer', name: 'Verrouillé', target: { selector: '#property-locked' },
        spans: [{ id: 'locked-content', start: 1, end: 20, kind: 'static' }]
      }]
    }
  ]
};

const editor = createEditor(element('property-editor'), {
  defaultPlugins: false, root: element('property-stage'), data
});
const registry = createPropertyRegistry([
  { name: 'volume', kind: 'value', unit: '', defaultValue: 0 },
  { name: 'toString', kind: 'value', unit: '', defaultValue: 0 }
]);
const plainData: ITimelineDocument = {
  version: '2.0.0', settings: { fps: 24, totalFrames: 20 },
  layers: [{
    id: 'object', type: 'layer', name: 'Objet', target: { ref: 'object' },
    spans: [{ id: 'object-content', start: 1, end: 20, kind: 'static' }]
  }]
};
const stageFree = createEditor(element('property-stage-free'), {
  defaultPlugins: false, stage: false, registry, data: structuredClone(plainData)
});
const object = { volume: 0 };
const objectStage = createObjectStage({
  id: 'values', unscoped: true,
  objects: [{ id: 'object', label: 'Objet', object, properties: [{ name: 'volume', label: 'Volume', unit: 'dB' }] }],
  apply: (target, values) => {
    target.volume = values.volume ?? 0;
    element('property-volume').textContent = String(target.volume);
  }
});
let loadOnMetadata: ITimelineDocument | undefined;
const objectEditor = createEditor(element('property-object-editor'), {
  defaultPlugins: false,
  stage: {
    ...objectStage,
    // Exercise the real stage's list/subscribe fallback for an unscoped ref.
    targets: { ...objectStage.targets, list: () => {
      const loaded = loadOnMetadata;
      if (loaded !== undefined) {
        loadOnMetadata = undefined;
        objectEditor.load(loaded);
        objectEditor.setProperty('object', 'volume', 0.4);
      }
      return objectStage.targets?.list() ?? [];
    }, describe: undefined }
  },
  registry, data: plainData
});
const refusals: string[] = [];
const changes: string[] = [];
editor.on('command:refused', ({ reason }) => refusals.push(reason));
editor.on('document:changed', ({ cause }) => changes.push(cause));

const fixture: IPropertyApiFixture = {
  ready: true, editor, stageFree, objectEditor, object, refusals, changes,
  async seek(frame: number): Promise<void> {
    editor.playback.seek(frame);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  },
  loadObjectOnMetadata(document: ITimelineDocument): void {
    loadOnMetadata = document;
  },
  setObjectProperties(properties: ITargetInfo['properties']): void {
    objectStage.remove('object');
    objectStage.add({ id: 'object', label: 'Objet', object, properties });
  }
};
window.propertyApi = fixture;
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) { editor.destroy(); stageFree.destroy(); objectEditor.destroy(); }
});
