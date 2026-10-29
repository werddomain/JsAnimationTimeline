// demo/runtime/src/fixtures/contextMenu.ts
/** Permanent context-menu fixture; commands run through real UI controls only. */
import { createEditor } from '@kazo-ca/timeline-editor';
import type { IEditor } from '@kazo-ca/timeline-editor';
import type { ILayer, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { ContextMenuEditorId, IContextMenuSnapshot } from './contextMenuTypes';

function staticLayer(id: string, extra: Partial<ILayer> = {}): ILayer {
  return { id, type: 'layer', name: id === 'target' ? 'Cible animée' : id, spans: [
    { id: `${id}-from`, start: 1, end: 8, kind: 'static', tracks: { x: [{ frame: 1, value: 0 }] } },
    { id: `${id}-to`, start: 9, end: 24, kind: 'static', tracks: { x: [{ frame: 9, value: 120 }] } }
  ], ...extra };
}

function initialDocument(): ITimelineDocument {
  return {
    version: '2.0.0', settings: { fps: 12, totalFrames: 24 }, layers: [
      staticLayer('target', { target: { selector: '#target-object' }, color: '#b5a0ff' }),
      staticLayer('second'),
      { id: 'motion', type: 'layer', name: 'Interpolation avec clé de propriété', spans: [
        { id: 'motion-span', start: 1, end: 24, kind: 'tween', tracks: { x: [
          { frame: 1, value: 0 }, { frame: 6, value: 60 }, { frame: 24, value: 120 }
        ] } }
      ] },
      staticLayer('locked', { locked: true }),
      { id: 'folder', type: 'folder', name: 'Dossier verrouillé', locked: true, children: [staticLayer('child', { target: { selector: '#child-object' } })] },
      staticLayer('last', { visible: false })
    ]
  };
}

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Élément de validation introuvable : ${id}.`);
  return found;
}

function inspect(editor: IEditor): IContextMenuSnapshot {
  const layer = editor.sample().layer('target');
  return {
    document: editor.document,
    cells: editor.getService('frames.selection')?.cells() ?? [],
    keyframes: editor.getService('frames.selection')?.keyframes() ?? [],
    layers: editor.getService('layers.selection')?.selected() ?? [],
    clipboard: editor.getService('frames.clipboard')?.hasContent() ?? false,
    canUndo: editor.canUndo, canRedo: editor.canRedo, destroyed: editor.isDestroyed,
    frame: editor.playback.frame,
    sample: layer === undefined ? undefined : { active: layer.active, x: layer.values.x }
  };
}

function start(): void {
  const editors: Readonly<Record<ContextMenuEditorId, IEditor>> = {
    primary: createEditor(element('primary'), { data: initialDocument(), root: element('stage') }),
    secondary: createEditor(element('secondary'), { data: initialDocument(), stage: false })
  };
  element('reset').addEventListener('click', () => {
    for (const editor of Object.values(editors)) {
      if (editor.isDestroyed) continue;
      editor.playback.pause();
      editor.load(initialDocument());
      editor.getService('frames.clipboard')?.clear();
      editor.playback.seek(1);
    }
  });
  element('destroy').addEventListener('click', () => editors.primary.destroy());
  window.addEventListener('pagehide', (event) => { if (!event.persisted) Object.values(editors).forEach((editor) => editor.destroy()); });
  window.contextMenuReview = Object.freeze({
    ready: true,
    inspect: (id: ContextMenuEditorId) => inspect(editors[id]),
    cellPoint: (id: ContextMenuEditorId, rowId: string, frame: number) => {
      const grid = editors[id].getService('frames.grid');
      const row = grid?.rows().find((candidate) => candidate.id === rowId);
      const rect = grid?.element()?.getBoundingClientRect();
      if (grid === undefined || row === undefined || rect === undefined) throw new Error('Cellule de validation introuvable.');
      return { x: rect.left + (frame - 0.5) * grid.frameWidth(), y: rect.top + (row.index + 0.5) * grid.rowHeight() };
    }
  });
}

try { start(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  element('fatal').hidden = false;
  element('fatal').textContent = message;
  window.contextMenuReview = { ready: false, error: message };
  throw error;
}
