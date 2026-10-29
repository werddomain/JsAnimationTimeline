// packages/editor/src/plugins/layers/list/__tests__/fixtures.ts
/**
 * Fixtures des tests de `layers.list` : nœuds et documents de test, et
 * montage d'un éditeur avec le jeu de plugins par défaut.
 */

import type { IFolder, ILayer, ITimelineDocument, LayerNode } from '@kazo-ca/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import type { EditorPlugin } from '../../../../core/context/IEditorContext';
import type { ILayerListService } from '../types';

/** Calque `id` (nom = id) sans plage. */
export function layer(id: string, extra: Partial<Omit<ILayer, 'id' | 'type' | 'spans'>> = {}): ILayer {
  return { id, type: 'layer', name: id, spans: [], ...extra };
}

/** Dossier `id` (nom = id). */
export function folder(
  id: string,
  children: readonly LayerNode[],
  extra: Partial<Omit<IFolder, 'id' | 'type' | 'children'>> = {}
): IFolder {
  return { id, type: 'folder', name: id, children, ...extra };
}

/** Document v2 avec les nœuds donnés. */
export function doc(layers: readonly LayerNode[]): ITimelineDocument {
  return { version: '2.0.0', settings: { fps: 24, totalFrames: 24 }, layers };
}

/** Éditeur monté dans un conteneur et service `layers.list`. */
export interface IListHarness {
  readonly editor: IEditor;
  readonly host: HTMLElement;
  readonly list: ILayerListService;
}

const editors: IEditor[] = [];

/** Monte un éditeur (plugins par défaut, plus `plugins`) sur `data`. */
export function mount(data: ITimelineDocument, plugins: readonly EditorPlugin[] = []): IListHarness {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const editor = createEditor(host, { data, plugins });
  editors.push(editor);
  const list = editor.getService('layers.list');
  if (list === undefined) throw new Error('service layers.list absent');
  return { editor, host, list };
}

/** Détruit les éditeurs montés et vide le corps du document (à appeler dans `afterEach`). */
export function unmountAll(): void {
  editors.splice(0).forEach((editor) => {
    if (!editor.isDestroyed) editor.destroy();
  });
  document.body.innerHTML = '';
}

/** Ids des lignes affichées, dans l'ordre du DOM. */
export function domRowIds(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll<HTMLElement>('.jt-layer-row')).map((row) => row.dataset.rowId ?? '');
}
