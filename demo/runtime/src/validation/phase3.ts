// demo/runtime/src/validation/phase3.ts
/** Preserved phase-3 demonstration, using only the existing editor public API. */
import { createEditor } from '@kazo-ca/timeline-editor';
import type { ISpan, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type {} from './phase3Types';
import './phase3.less';

const TOTAL_FRAMES = 180;
const staticSpan = (id: string): ISpan => ({ id: `${id}-static`, start: 1, end: TOTAL_FRAMES, kind: 'static' });

function createInitialDocument(): ITimelineDocument {
  const supportLayers: ITimelineDocument['layers'] = Array.from({ length: 19 }, (_, index) => ({
    id: `detail-${index + 1}`, type: 'layer', name: `Détail du décor ${String(index + 1).padStart(2, '0')}`,
    color: index % 2 === 0 ? '#8ca7c3' : '#81b8a9', spans: [staticSpan(`detail-${index + 1}`)]
  }));
  return {
    version: '2.0.0', settings: { fps: 24, totalFrames: TOTAL_FRAMES }, layers: [
      { id: 'characters', type: 'folder', name: 'Personnages', color: '#7965dc', children: [
        { id: 'hero', type: 'layer', name: 'Héros', color: '#7965dc', target: { selector: '#hero-object' }, spans: [
          { id: 'hero-motion', start: 1, end: 90, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 90, value: 265 }] } },
          { id: 'hero-hold', start: 91, end: TOTAL_FRAMES, kind: 'static' }
        ] },
        { id: 'orb', type: 'layer', name: 'Orbe dorée', color: '#e8b459', target: { selector: '#orb-object' }, spans: [staticSpan('orb')] }
      ] },
      { id: 'decor', type: 'folder', name: 'Décor et accessoires', color: '#78ad9d', children: [
        { id: 'cloud', type: 'layer', name: 'Nuage', color: '#7ca7d0', target: { selector: '#cloud-object' }, spans: [staticSpan('cloud')] },
        ...supportLayers
      ] },
      { id: 'missing', type: 'layer', name: 'Cible à réassocier', color: '#d78883', target: { selector: '#objet-introuvable' }, spans: [staticSpan('missing')] }
    ]
  };
}

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing phase-3 demo element: ${id}`);
  return found;
}

function startDemo(): void {
  const editor = createEditor(element('editor-host'), { data: createInitialDocument(), root: element('stage') });
  const status = element('review-status');
  const update = (): void => {
    status.textContent = `Image ${editor.playback.frame} / ${TOTAL_FRAMES} · Annuler ${editor.canUndo ? 'disponible' : '—'} · Rétablir ${editor.canRedo ? 'disponible' : '—'}`;
  };
  editor.on('document:changed', update);
  editor.on('playhead:changed', update);
  editor.on('history:changed', update);
  element('reset').addEventListener('click', () => {
    editor.playback.pause();
    editor.load(createInitialDocument());
    editor.playback.seek(1);
    update();
  });
  window.addEventListener('pagehide', () => editor.destroy(), { once: true });
  window.phase3Review = { editor, ready: true };
  update();
}

try {
  startDemo();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  const fatal = element('fatal');
  fatal.hidden = false;
  fatal.textContent = message;
  window.phase3Review = { ready: false, error: message };
  throw error;
}
