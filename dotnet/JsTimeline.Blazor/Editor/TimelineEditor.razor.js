// dotnet/JsTimeline.Blazor/Editor/TimelineEditor.razor.js
import { createEditor } from '../js/timeline-editor.mjs';

export async function createTimelineEditor(root, json, kind, path, dotnetStage, receiver, revision = 1) {
  let stage;
  if (kind === 'none') stage = false;
  else if (kind === 'dotnet') stage = dotnetStage;
  else if (kind === 'module') stage = (await import(new URL(path, document.baseURI).href)).createStage();
  let destroyed = false;
  const notify = (method, value) => {
    if (!destroyed) receiver.invokeMethodAsync(method, value, revision).catch(error => console.error('TimelineEditor:', error));
  };
  const editor = createEditor(root, {
    data: JSON.parse(json), stage,
    onStageError: error => notify('StageError', error instanceof Error ? error.message : String(error)),
  });
  const off = [
    editor.on('document:changed', event => notify('DocumentChanged', JSON.stringify(event.document))),
    editor.on('playhead:changed', event => notify('FrameChanged', event.frame)),
  ];
  const persistence = editor.getService('persistence.json');
  return {
    load: (value, nextRevision) => { editor.load(JSON.parse(value)); revision = nextRevision; },
    importDocument: value => persistence.importDocument(value).applied,
    exportJson: () => persistence.exportJson(),
    undo: () => editor.undo(),
    redo: () => editor.redo(),
    refreshTargets: layerId => editor.refreshTargets(layerId ?? undefined),
    destroy: () => { if (!destroyed) { destroyed = true; off.forEach(unsubscribe => unsubscribe()); editor.destroy(); } },
  };
}



