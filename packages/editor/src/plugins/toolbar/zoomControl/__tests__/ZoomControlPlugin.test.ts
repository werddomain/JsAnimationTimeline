// packages/editor/src/plugins/toolbar/zoomControl/__tests__/ZoomControlPlugin.test.ts
/**
 * Tests de `toolbar.zoomControl` : liste et curseur dans le groupe `zoom` de
 * la barre d'outils, zoom par la liste, le curseur et « Ajuster à la
 * fenêtre », suivi d'un zoom fait ailleurs (`zoom:changed`), aucune entrée
 * d'historique, place dans le jeu par défaut et nettoyage.
 */

import { createEditor } from '../../../../core/editor/createEditor';
import type { IEditor } from '../../../../core/editor/types';
import { createEmptyDocument } from '../../../../core/editor/emptyDocument';
import { makeScrollable } from '../../../layout/__tests__/layoutFixtures';
import type { IZoomApi } from '../../../layout/zoom/ZoomPlugin';
import { toolbarBasePlugins } from '../../__tests__/toolbarFixtures';
import { ToolbarPlugin } from '../../ToolbarPlugin';
import { FIT_OPTION_VALUE, ZOOM_CONTROL_PLUGIN_ID, ZoomControlPlugin } from '../ZoomControlPlugin';

afterEach(() => {
  document.body.innerHTML = '';
});

interface IMounted {
  readonly editor: IEditor;
  readonly zoom: IZoomApi;
  readonly select: HTMLSelectElement;
  readonly slider: HTMLInputElement;
}

function mount(visibleWidth = 300): IMounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = createEditor(container, {
    data: createEmptyDocument(),
    defaultPlugins: toolbarBasePlugins({}, [new ZoomControlPlugin()])
  });
  const frames = editor.container.querySelector<HTMLElement>('[data-zone="frames"]') as HTMLElement;
  makeScrollable(frames, { scrollWidth: 3000, scrollHeight: 300, clientWidth: visibleWidth, clientHeight: 300 });
  const zoom = editor.getService('layout.zoom') as IZoomApi;
  const control = editor.container.querySelector(`[data-toolbar-item="${ZOOM_CONTROL_PLUGIN_ID}"]`) as HTMLElement;
  return {
    editor,
    zoom,
    select: control.querySelector('select') as HTMLSelectElement,
    slider: control.querySelector('input[type="range"]') as HTMLInputElement
  };
}

function choose(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function slide(slider: HTMLInputElement, value: number): void {
  slider.value = String(value);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

function visibleOptions(select: HTMLSelectElement): Array<string | null> {
  return Array.from(select.options).map((option) => option.textContent);
}

describe('toolbar.zoomControl rendering', () => {
  it('adds a labelled list and slider to the zoom group of the toolbar', () => {
    // Act
    const { editor, select, slider } = mount();

    // Assert
    const control = editor.container.querySelector(`[data-toolbar-item="${ZOOM_CONTROL_PLUGIN_ID}"]`);
    expect(control?.closest('[data-group]')?.getAttribute('data-group')).toBe('zoom');
    expect(control?.getAttribute('aria-label')).toBe('Zoom de la règle');
    expect(select.getAttribute('aria-label')).toBe('Niveau de zoom');
    expect(visibleOptions(select)).toEqual([
      '25\u00a0%',
      '50\u00a0%',
      '100\u00a0%',
      '200\u00a0%',
      '400\u00a0%',
      'Ajuster à la fenêtre'
    ]);
    expect(select.value).toBe('1');
    expect(slider.getAttribute('aria-label')).toBe('Zoom continu');
    expect(slider.step).toBe('5');
    expect([slider.min, slider.max, slider.value]).toEqual(['-200', '200', '0']);
    expect(slider.getAttribute('aria-valuetext')).toBe('100\u00a0%');
  });

  it('marks the zoom service levels as slider ticks', () => {
    // Act
    const { editor, slider, zoom } = mount();

    // Assert
    const ticks = editor.container.querySelector(`#${slider.getAttribute('list') ?? 'none'}`);
    expect(ticks?.children.length).toBe(zoom.levels().filter((level) => level >= 0.25 && level <= 4).length);
  });

  it('is part of the toolbar epic, so of the default set', () => {
    // Assert
    expect(new ToolbarPlugin().children.map((child) => child.id)).toContain(ZOOM_CONTROL_PLUGIN_ID);
  });
});

describe('toolbar.zoomControl changes the zoom', () => {
  it('applies a preset from the list and moves the slider', () => {
    // Arrange
    const { zoom, select, slider } = mount();

    // Act
    choose(select, '2');

    // Assert
    expect(zoom.zoom()).toBe(2);
    expect(slider.value).toBe('100');
    expect(slider.getAttribute('aria-valuetext')).toBe('200\u00a0%');
  });

  it('zooms continuously with the slider and shows the value as a custom entry', () => {
    // Arrange
    const { zoom, select, slider } = mount();

    // Act
    slide(slider, 60);

    // Assert
    expect(zoom.zoom()).toBeCloseTo(2 ** 0.6, 6);
    expect(select.value).toBe('custom');
    expect(select.selectedOptions[0]?.textContent).toBe('152\u00a0%');
    expect(visibleOptions(select).indexOf('152\u00a0%')).toBe(3);
    slide(slider, 0);
    expect(select.value).toBe('1');
    expect(visibleOptions(select)).not.toContain('152\u00a0%');
  });

  it('fits the whole duration in the visible width', () => {
    // Arrange
    const { editor, zoom, select } = mount(300);
    const frames = editor.document.settings.totalFrames;

    // Act
    choose(select, FIT_OPTION_VALUE);

    // Assert
    expect(zoom.zoom()).toBeCloseTo(300 / (frames * zoom.baseFrameWidth()), 6);
    expect(select.value).not.toBe(FIT_OPTION_VALUE);
  });

  it('keeps the zoom when the view has no width yet', () => {
    // Arrange
    const { zoom, select } = mount(0);

    // Act
    choose(select, FIT_OPTION_VALUE);

    // Assert
    expect(zoom.zoom()).toBe(1);
    expect(select.value).toBe('1');
  });

  it('follows a zoom made elsewhere', () => {
    // Arrange
    const { zoom, select, slider } = mount();

    // Act
    zoom.setZoom(0.5);

    // Assert
    expect(select.value).toBe('0.5');
    expect(slider.value).toBe('-100');
  });

  it('adds no history entry and changes no document', () => {
    // Arrange
    const { editor, select } = mount();
    const events: string[] = [];
    editor.on('history:changed', () => events.push('history'));
    editor.on('document:changed', () => events.push('document'));

    // Act
    choose(select, '4');

    // Assert
    expect(events).toEqual([]);
    expect(editor.canUndo).toBe(false);
  });

  it('anchors the list and the slider on the playhead, and fit on the centre', () => {
    // Arrange
    const { zoom, select, slider } = mount();
    const setZoom = jest.spyOn(zoom, 'setZoom');

    // Act
    choose(select, '2');
    slide(slider, 20);
    choose(select, FIT_OPTION_VALUE);

    // Assert
    expect(setZoom.mock.calls.map((call) => call[1])).toEqual(['playhead', 'playhead', 'center']);
  });

  it('labels a zoom close to a preset with a decimal, so it never reads like that preset', () => {
    // Arrange
    const { zoom, select } = mount();

    // Act
    zoom.setZoom(0.998);

    // Assert
    expect(select.selectedOptions[0]?.textContent).toBe('99,8\u00a0%');
  });

  it('fits again when Ajuster is chosen twice, after the duration changed', () => {
    // Arrange
    const { editor, zoom, select } = mount(300);
    choose(select, FIT_OPTION_VALUE);
    const first = zoom.zoom();
    editor.load({ ...editor.document, settings: { ...editor.document.settings, totalFrames: 120 } });

    // Act
    choose(select, FIT_OPTION_VALUE);

    // Assert
    expect(zoom.zoom()).toBeCloseTo(first / 2, 6);
  });
});

describe('toolbar.zoomControl destroy', () => {
  it('stops following the zoom and removes its control', () => {
    // Arrange
    const plugin = new ZoomControlPlugin();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = createEditor(container, { defaultPlugins: toolbarBasePlugins({}, [plugin]) });
    const zoom = editor.getService('layout.zoom') as IZoomApi;

    const select = editor.container.querySelector<HTMLSelectElement>('.jt-zoomControl__select') as HTMLSelectElement;
    const setZoom = jest.spyOn(zoom, 'setZoom');

    // Act
    plugin.destroy();
    zoom.setZoom(2);
    choose(select, '4');

    // Assert
    expect(editor.container.querySelector(`[data-toolbar-item="${ZOOM_CONTROL_PLUGIN_ID}"]`)).toBeNull();
    expect(setZoom).toHaveBeenCalledTimes(1);
    expect(zoom.zoom()).toBe(2);
  });
});
