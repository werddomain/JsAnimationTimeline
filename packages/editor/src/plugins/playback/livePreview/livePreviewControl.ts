// packages/editor/src/plugins/playback/livePreview/livePreviewControl.ts
/**
 * Liste « Aperçu » de `playback.livePreview` dans la barre d'outils : un
 * `<select>` des modes, qui change le mode par le service et suit
 * `playback:previewChanged` (changements faits ailleurs, fréquence comprise).
 */

import type { IEditorEvents } from '../../../core/context/IEditorContext';
import { LIVE_PREVIEW_MODES, modeLabel } from './previewSettings';
import type { ILivePreviewApi } from './types';
import './LivePreview.less';

/** Classe de la liste. */
export const LIVE_PREVIEW_CLASS = 'jt-livePreview';

/** Dessine la liste dans `element` ; retourne son nettoyage. */
export function renderLivePreviewControl(element: HTMLElement, api: ILivePreviewApi, events: IEditorEvents): () => void {
  const select = element.ownerDocument.createElement('select');
  select.classList.add(LIVE_PREVIEW_CLASS);
  select.setAttribute('aria-label', 'Aperçu pendant le glisser');
  select.title = 'Aperçu pendant le glisser de la tête de lecture';
  LIVE_PREVIEW_MODES.forEach((mode) => {
    const option = element.ownerDocument.createElement('option');
    option.value = mode;
    select.appendChild(option);
  });
  element.appendChild(select);

  const update = (): void => {
    Array.from(select.options).forEach((option) => {
      const mode = LIVE_PREVIEW_MODES.find((known) => known === option.value);
      if (mode !== undefined) option.textContent = modeLabel(mode, api.maxFps);
    });
    select.value = api.mode;
  };
  const onChange = (): void => {
    const mode = LIVE_PREVIEW_MODES.find((known) => known === select.value);
    if (mode !== undefined) api.setMode(mode);
    update();
  };
  select.addEventListener('change', onChange);
  const unsubscribe = events.on('playback:previewChanged', update);
  update();
  return () => {
    select.removeEventListener('change', onChange);
    unsubscribe();
  };
}
