// demo/runtime/src/validation/phase5.ts
/** Narrow phase-5 review using existing toolbar controls and a real HTML stage. */
import { createEditor } from '@kazo-ca/timeline-editor';
import type { IEditor } from '@kazo-ca/timeline-editor';
import { createHtmlStage } from '@kazo-ca/timeline-runtime';
import type { IStage, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { Phase5DrawMetrics } from './phase5Types';
import './phase5.less';

function createInitialDocument(): ITimelineDocument {
  return {
    version: '2.0.0', settings: { fps: 12, totalFrames: 24 }, layers: [
      { id: 'content', type: 'layer', name: 'Carré · clés 1 et 13', color: '#7965dc', target: { selector: '#content-object' }, spans: [
        { id: 'content-from', start: 1, end: 12, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
        { id: 'content-to', start: 13, end: 24, kind: 'static', tracks: { x: [{ frame: 13, value: 180 }] } }
      ] },
      { id: 'motion', type: 'layer', name: 'Orbe · interpolation et clé 17', color: '#e8b459', target: { selector: '#motion-object' }, spans: [
        { id: 'motion-hold', start: 1, end: 12, kind: 'static' },
        { id: 'motion-tween', start: 13, end: 24, kind: 'tween', tracks: { x: [{ frame: 13, value: 0 }, { frame: 17, value: 60 }, { frame: 24, value: 180 }] } }
      ] },
      { id: 'locked', type: 'layer', name: 'Témoin · verrouillé et masqué', color: '#789ea9', locked: true, visible: false, target: { selector: '#locked-object' }, spans: [
        { id: 'locked-hold', start: 1, end: 24, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } }
      ] }
    ]
  };
}

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing phase-5 element: ${id}`);
  return found;
}

function observeStage(metrics: Phase5DrawMetrics, update: () => void): IStage<Element> {
  const stage = createHtmlStage({ root: element('stage'), mode: 'frame' });
  // Forward the complete HTML-stage contract, observing only actual render calls.
  return {
    ...stage,
    render(time, states): void {
      stage.render?.(time, states);
      metrics.drawCount += 1;
      metrics.drawnFrame = time.integerFrame;
      update();
    }
  };
}

function resetReview(editor: IEditor, metrics: Phase5DrawMetrics): void {
  editor.playback.pause();
  editor.load(createInitialDocument());
  editor.getService('frames.selection')?.clear();
  editor.getService('layers.selection')?.clear();
  editor.getService('frames.clipboard')?.clear();
  editor.playback.speed = 1;
  editor.playback.loop = false;
  editor.playback.seek(1);
  editor.getService('playback.livePreview')?.setMode('live');
  editor.getService('playback.livePreview')?.setMaxFps(10);
  editor.getService('layout.zoom')?.setZoom(1);
  editor.getService('layout.scrollSync')?.scrollTo({ left: 0, top: 0 });
  metrics.drawCount = 0;
  metrics.drawnFrame = null;
  element('edit-status').textContent = 'Aucune demande de modification.';
  document.querySelectorAll<HTMLInputElement>('.checks input').forEach((input) => { input.checked = false; });
}

function startDemo(): void {
  const metrics: Phase5DrawMetrics = { drawCount: 0, drawnFrame: null };
  const current: { editor?: IEditor } = {};
  const update = (): void => {
    element('draw-status').textContent = `Image demandée ${current.editor?.playback.frame ?? 1} · dessinée ${metrics.drawnFrame ?? '—'} · ${metrics.drawCount} rendus réels`;
    const editor = current.editor;
    if (editor === undefined) return;
    element('review-status').textContent = `${editor.playback.playing ? 'Lecture' : 'Pause'} · ${editor.document.settings.fps} img/s · ${editor.document.settings.totalFrames} images · Annuler ${editor.canUndo ? 'disponible' : '—'} · Rétablir ${editor.canRedo ? 'disponible' : '—'}`;
  };
  const editor = createEditor(element('editor-host'), { data: createInitialDocument(), stage: observeStage(metrics, update) });
  current.editor = editor;
  const activeEditor = editor;
  activeEditor.on('document:changed', update);
  activeEditor.on('playhead:changed', update);
  activeEditor.on('history:changed', update);
  activeEditor.on('playback:play', update);
  activeEditor.on('playback:pause', update);
  activeEditor.on('playback:complete', update);
  activeEditor.on('toolbar:editKeyframe', (event) => {
    element('edit-status').textContent = `Demande : ${event.layerId} · image ${event.frame} · ${event.inTween ? 'interpolation' : 'contenu'}. Aucun panneau de propriétés dans cette revue.`;
  });
  element('reset').addEventListener('click', () => { resetReview(activeEditor, metrics); update(); });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) activeEditor.destroy();
  });
  window.phase5Review = { ready: true, editor: activeEditor, metrics };
  update();
}

try { startDemo(); }
catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  const fatal = element('fatal');
  fatal.hidden = false;
  fatal.textContent = message;
  window.phase5Review = { ready: false, error: message };
  throw error;
}
