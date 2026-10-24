// packages/editor/src/plugins/toolbar/zoomControl/ZoomControlPlugin.ts
/**
 * Plugin : toolbar.zoomControl
 * Epic : toolbar
 * Dépend de : toolbar, toolbar.main, layout.zoom, layout.shell
 * Écoute : zoom:changed
 * Émet : —
 *
 * Zoom de la règle dans la barre d'outils (groupe `zoom`) :
 * - une liste déroulante des préréglages (25 % à 400 %) et « Ajuster à la
 *   fenêtre », qui fait tenir toute la durée du document dans la largeur
 *   visible de la zone des images ;
 * - un curseur continu sur la même plage (échelle logarithmique), dont les
 *   graduations sont les paliers du service `layout.zoom`.
 *
 * Le zoom passe uniquement par le service `layout.zoom` : ce plugin ne
 * connaît pas la largeur d'une image. C'est un réglage de vue, sans commande
 * ni entrée d'historique. Les deux contrôles suivent `zoom:changed` : un zoom
 * fait ailleurs (Ctrl + molette, raccourci, autre plugin) s'y affiche aussi.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { IZoomApi } from '../../layout/zoom/ZoomPlugin';
import '../../layout/zoom/zoomEvents';
import { ToolbarGroupOrders } from '../main/ToolbarItems';
import {
  fitZoom,
  formatZoom,
  presetsWithin,
  sameZoom,
  sliderRange,
  sliderToZoom,
  zoomToSlider
} from './zoomControlMath';
import './ZoomControl.less';

/** Identifiant du plugin (et de son contrôle dans la barre d'outils). */
export const ZOOM_CONTROL_PLUGIN_ID = 'toolbar.zoomControl';

/** Classe du contrôle de zoom. */
export const ZOOM_CONTROL_CLASS = 'jt-zoomControl';

/** Valeur de l'option « Ajuster à la fenêtre » dans la liste. */
export const FIT_OPTION_VALUE = 'fit';

/** Valeur de l'option qui affiche un zoom hors préréglages. */
const CUSTOM_OPTION_VALUE = 'custom';

/** Compteur des identifiants de la liste de graduations (un par contrôle rendu). */
let ticksCount = 0;

/** Éléments du contrôle rendu. */
interface IZoomControlView {
  readonly select: HTMLSelectElement;
  readonly custom: HTMLOptionElement;
  readonly slider: HTMLInputElement;
}

function option(doc: Document, value: string, text: string): HTMLOptionElement {
  const element = doc.createElement('option');
  element.value = value;
  element.textContent = text;
  return element;
}

/** Plugin `toolbar.zoomControl` : liste et curseur du zoom de la règle. */
export class ZoomControlPlugin implements EditorPlugin {
  readonly id = 'toolbar.zoomControl';
  readonly dependencies: readonly string[] = ['toolbar', 'toolbar.main', 'layout.zoom', 'layout.shell'];

  private ctx: IEditorContext | null = null;
  private view: IZoomControlView | null = null;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const cleanups: Array<() => void> = [];
    try {
      cleanups.push(ctx.events.on('zoom:changed', () => this.update()));
      cleanups.push(
        ctx.services.require('toolbar.main').addControl({
          id: ZOOM_CONTROL_PLUGIN_ID,
          label: 'Zoom de la règle',
          group: 'zoom',
          order: ToolbarGroupOrders.zoom + 1,
          render: (element) => this.renderControl(element, ctx.services.require('layout.zoom'))
        })
      );
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      throw error;
    }
    this.ctx = ctx;
    this.cleanups = cleanups;
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.view = null;
    this.ctx = null;
  }

  private renderControl(element: HTMLElement, zoom: IZoomApi): () => void {
    const doc = element.ownerDocument;
    element.classList.add(ZOOM_CONTROL_CLASS);
    const range = zoom.range();

    const select = doc.createElement('select');
    select.classList.add(`${ZOOM_CONTROL_CLASS}__select`);
    select.setAttribute('aria-label', 'Niveau de zoom');
    select.title = 'Niveau de zoom';
    const custom = option(doc, CUSTOM_OPTION_VALUE, '');
    custom.hidden = true;
    select.appendChild(custom);
    presetsWithin(range).forEach((preset) => select.appendChild(option(doc, String(preset), formatZoom(preset))));
    select.appendChild(option(doc, FIT_OPTION_VALUE, 'Ajuster à la fenêtre'));

    const bounds = sliderRange(range);
    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.classList.add(`${ZOOM_CONTROL_CLASS}__slider`);
    slider.min = String(zoomToSlider(bounds.min));
    slider.max = String(zoomToSlider(bounds.max));
    slider.step = '1';
    slider.setAttribute('aria-label', 'Zoom de la règle');
    ticksCount += 1;
    const ticks = doc.createElement('datalist');
    ticks.id = `${ZOOM_CONTROL_CLASS}-ticks-${ticksCount}`;
    zoom
      .levels()
      .filter((level) => level >= bounds.min && level <= bounds.max)
      .forEach((level) => ticks.appendChild(option(doc, String(zoomToSlider(level)), formatZoom(level))));
    slider.setAttribute('list', ticks.id);
    element.append(select, slider, ticks);

    const onSelect = (): void => {
      if (select.value === FIT_OPTION_VALUE) this.fit(zoom);
      else if (select.value !== CUSTOM_OPTION_VALUE) zoom.setZoom(Number(select.value), 'playhead');
      // Toujours resynchroniser : un choix sans effet (déjà à ce zoom, vue non
      // affichée) n'émet pas `zoom:changed`.
      this.update();
    };
    const onSlide = (): void => {
      zoom.setZoom(sliderToZoom(Number(slider.value)), 'playhead');
      this.update();
    };
    select.addEventListener('change', onSelect);
    slider.addEventListener('input', onSlide);
    this.view = { select, custom, slider };
    this.update();
    return () => {
      select.removeEventListener('change', onSelect);
      slider.removeEventListener('input', onSlide);
      this.view = null;
    };
  }

  /** Zoom qui fait tenir toute la durée du document dans la largeur visible des images. */
  private fit(zoom: IZoomApi): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    const frames = ctx.services.get('layout.shell')?.zone('frames');
    const target = fitZoom(
      frames?.clientWidth ?? 0,
      ctx.document.settings.totalFrames,
      zoom.baseFrameWidth(),
      zoom.range()
    );
    if (target !== undefined) zoom.setZoom(target, 'center');
  }

  /** Recopie le zoom courant dans la liste et le curseur. */
  private update(): void {
    const view = this.view;
    const zoom = this.ctx?.services.get('layout.zoom');
    if (view === null || zoom === undefined) return;
    const current = zoom.zoom();
    const label = formatZoom(current);
    const preset = Array.from(view.select.options).find(
      (item) => item !== view.custom && item.value !== FIT_OPTION_VALUE && sameZoom(Number(item.value), current)
    );
    view.custom.hidden = preset !== undefined;
    view.custom.textContent = label;
    view.select.value = preset?.value ?? CUSTOM_OPTION_VALUE;
    view.slider.value = String(zoomToSlider(current));
    view.slider.setAttribute('aria-valuetext', label);
    view.slider.title = `Zoom : ${label}`;
  }
}

/** Crée le plugin `toolbar.zoomControl`. */
export function createZoomControlPlugin(): ZoomControlPlugin {
  return new ZoomControlPlugin();
}
