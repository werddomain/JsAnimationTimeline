// demo/runtime/src/validation/phase4.ts
/** Phase-4 review, using only existing public editor APIs. */
import { createEditor } from '@kazo-ca/timeline-editor';
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type {} from './phase4Types';
import './phase4.less';

const TOTAL_FRAMES = 24;

function createInitialDocument(): ITimelineDocument {
  return {
    version: '2.0.0', settings: { fps: 12, totalFrames: TOTAL_FRAMES }, layers: [
      { id: 'target', type: 'layer', name: 'Carré · report de position', color: '#7965dc', target: { selector: '#target-object' }, spans: [
        { id: 'target-zero', start: 1, end: 4, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
        { id: 'target-hundred', start: 5, end: 8, kind: 'static', tracks: { x: [{ frame: 5, value: 100 }] } },
        { id: 'target-carry', start: 9, end: TOTAL_FRAMES, kind: 'static' }
      ] },
      { id: 'blank-source', type: 'layer', name: 'Source vide · images 1 à 4', color: '#789ea9', target: { selector: '#source-object' }, spans: [
        { id: 'source-blank', start: 1, end: 4, kind: 'blank' },
        { id: 'source-hold', start: 5, end: TOTAL_FRAMES, kind: 'static' }
      ] },
      { id: 'motion', type: 'layer', name: 'Orbe · deux images clés', color: '#e8b459', target: { selector: '#motion-object' }, spans: [
        { id: 'motion-from', start: 1, end: 12, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
        { id: 'motion-to', start: 13, end: TOTAL_FRAMES, kind: 'static', tracks: { x: [{ frame: 13, value: 180 }] } }
      ] }
    ]
  };
}

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing phase-4 demo element: ${id}`);
  return found;
}

function button(id: string): HTMLButtonElement {
  const found = element(id);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Expected phase-4 button: ${id}`);
  return found;
}

function startDemo(): void {
  const editor = createEditor(element('editor-host'), { data: createInitialDocument(), root: element('stage') });
  const clipboard = editor.getService('frames.clipboard');
  const selection = editor.getService('frames.selection');
  const motion = editor.getService('tweens.motion');
  if (clipboard === undefined || selection === undefined || motion === undefined) throw new Error('Required phase-4 services are missing.');
  const create = button('create-tween');
  const remove = button('remove-tween');
  const update = (): void => {
    element('review-status').textContent = `Image ${editor.playback.frame} / ${editor.document.settings.totalFrames} · Annuler ${editor.canUndo ? 'disponible' : '—'} · Rétablir ${editor.canRedo ? 'disponible' : '—'}`;
    const cells = selection.cells();
    element('selection-status').textContent = `${cells.length} images sélectionnées · ${selection.keyframes().length} clés · Presse-papiers ${clipboard.hasContent() ? 'rempli' : 'vide'}`;
    const canCreate = motion.canCreate();
    const canRemove = motion.canRemove();
    create.disabled = !canCreate.enabled;
    create.title = canCreate.reason ?? 'Interpoler les images clés sélectionnées';
    remove.disabled = !canRemove.enabled;
    remove.title = canRemove.reason ?? 'Supprimer les interpolations sélectionnées';
    element('tween-status').textContent = canCreate.enabled ? 'Création disponible pour la sélection.' : canCreate.reason ?? '';
  };
  editor.on('document:changed', update);
  editor.on('playhead:changed', update);
  editor.on('history:changed', update);
  editor.on('frames:selectionChanged', update);
  editor.on('frames:clipboardChanged', update);
  editor.on('tweens:motionAvailabilityChanged', update);
  create.addEventListener('click', () => { motion.create(); });
  remove.addEventListener('click', () => { motion.remove(); });
  button('reset').addEventListener('click', () => {
    editor.playback.pause();
    editor.load(createInitialDocument());
    clipboard.clear();
    editor.playback.seek(1);
    document.querySelectorAll<HTMLInputElement>('.checks input').forEach((input) => { input.checked = false; });
    update();
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) editor.destroy();
  });
  window.phase4Review = { editor, ready: true };
  update();
}

try {
  startDemo();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  const fatal = element('fatal');
  fatal.hidden = false;
  fatal.textContent = message;
  window.phase4Review = { ready: false, error: message };
  throw error;
}
