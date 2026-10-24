// packages/editor/src/plugins/layout/zoom/__tests__/ZoomPlugin.test.ts
/**
 * Tests de `layout.zoom` : service (lecture, réglage, paliers, bornes),
 * largeur transmise à la règle et à la tête, `zoom:changed`, défilement
 * ancré (milieu, tête de lecture, pointeur), Ctrl + molette, options et
 * nettoyage.
 */

import { cleanBody, makeScrollable, mountLayout, placeAt, timelineDocument } from '../../__tests__/layoutFixtures';
import type { IMountOptions, IMountedLayout } from '../../__tests__/layoutFixtures';
import { PLAYHEAD_HEAD_CLASS } from '../../playhead/PlayheadPlugin';
import { FRAME_WIDTH_VAR, RULER_CLASS } from '../../ruler/RulerPlugin';
import type { ZoomChangedEvent } from '../zoomEvents';
import { ZoomPlugin } from '../ZoomPlugin';
import type { IZoomApi } from '../ZoomPlugin';

afterEach(cleanBody);

interface IZoomSetup extends IMountedLayout {
  readonly api: IZoomApi;
  readonly events: ZoomChangedEvent[];
}

/** 200 images de 15 px (3000 px), vue de 300 px qui commence à x = 100. */
function setup(options: IMountOptions = {}): IZoomSetup {
  const mounted = mountLayout([], { data: timelineDocument(200), ...options });
  makeScrollable(mounted.zone('frames'), { scrollWidth: 6000, scrollHeight: 300, clientWidth: 300, clientHeight: 300 });
  placeAt(mounted.zone('frames'), 100);
  const api = mounted.editor.getService('layout.zoom');
  if (api === undefined) throw new Error('Service layout.zoom absent.');
  const events: ZoomChangedEvent[] = [];
  mounted.editor.on('zoom:changed', (event) => events.push(event));
  return { ...mounted, api, events };
}

function ctrlWheel(deltaY: number, clientX: number, init: WheelEventInit = { ctrlKey: true }): WheelEvent {
  return new WheelEvent('wheel', { deltaY, clientX, cancelable: true, bubbles: true, ...init });
}

describe('layout.zoom service', () => {
  it('starts at zoom 1 with the ruler width as base', () => {
    // Act
    const { api } = setup();

    // Assert
    expect(api.zoom()).toBe(1);
    expect(api.frameWidth()).toBe(15);
    expect(api.baseFrameWidth()).toBe(15);
    expect(api.range()).toEqual({ min: 0.1, max: 8 });
    expect(api.levels()).toEqual([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);
  });

  it('gives the new width to the ruler, the shell variable and the playhead, then emits zoom:changed', () => {
    // Arrange
    const { editor, api, zone, events } = setup();

    // Act
    api.setZoom(2);

    // Assert
    expect(editor.getService('layout.ruler')?.frameWidth()).toBe(30);
    expect(editor.getService('layout.shell')?.element()?.style.getPropertyValue(FRAME_WIDTH_VAR)).toBe('30px');
    expect(zone('ruler').querySelector<HTMLElement>(`.${RULER_CLASS}`)?.style.width).toBe('6000px');
    expect(zone('ruler').querySelector<HTMLElement>(`.${PLAYHEAD_HEAD_CLASS}`)?.style.width).toBe('30px');
    expect(events).toEqual([{ zoom: 2, frameWidth: 30, previousZoom: 1, previousFrameWidth: 15 }]);
  });

  it('clamps to the range, ignores an unchanged zoom and refuses an invalid one', () => {
    // Arrange
    const { api, events } = setup();

    // Act
    api.setZoom(100);
    api.setZoom(8);
    const act = (): void => api.setZoom(Number.NaN);

    // Assert
    expect(api.zoom()).toBe(8);
    expect(events).toHaveLength(1);
    expect(act).toThrow(RangeError);
  });

  it('zooms in and out by levels, and resets to 1', () => {
    // Arrange
    const { api } = setup();

    // Act
    api.zoomIn();
    const zoomedIn = api.zoom();
    api.zoomOut();
    api.zoomOut();
    const zoomedOut = api.zoom();
    api.reset();

    // Assert
    expect([zoomedIn, zoomedOut, api.zoom()]).toEqual([1.5, 0.75, 1]);
  });
});

describe('layout.zoom anchor', () => {
  it('keeps the middle of the view still', () => {
    // Arrange
    const { api, editor, zone } = setup();
    editor.getService('layout.scrollSync')?.scrollTo({ left: 150 });

    // Act
    api.setZoom(2, 'center');

    // Assert : image 20 (en largeurs) au milieu de la vue, avant comme après.
    expect(zone('frames').scrollLeft).toBe(20 * 30 - 150);
    expect(zone('ruler').scrollLeft).toBe(20 * 30 - 150);
  });

  it('keeps a visible playhead still by default, else the middle', () => {
    // Arrange
    const first = setup();
    first.editor.getService('layout.scrollSync')?.scrollTo({ left: 150 });
    first.editor.playback.seek(15);
    const second = setup();
    second.editor.playback.seek(100);

    // Act
    first.api.setZoom(2);
    second.api.setZoom(2);

    // Assert : milieu de l'image 15 à 217,5 px, soit 67,5 px dans la vue.
    expect(first.zone('frames').scrollLeft).toBe((217.5 / 15) * 30 - 67.5);
    expect(second.zone('frames').scrollLeft).toBe(150);
  });

  it('keeps the point under the pointer still on Ctrl + wheel', () => {
    // Arrange
    const { zone, api } = setup();
    const event = ctrlWheel(-100, 250);

    // Act
    zone('frames').dispatchEvent(event);

    // Assert : 150 px dans la vue = image 10 (en largeurs), gardée à 150 px.
    expect(event.defaultPrevented).toBe(true);
    expect(api.zoom()).toBe(1.5);
    expect(zone('frames').scrollLeft).toBe(10 * 22.5 - 150);
  });
});

describe('layout.zoom wheel', () => {
  it('zooms out with Ctrl or Cmd + wheel down, over the frames or the ruler', () => {
    // Arrange
    const { zone, api } = setup();

    // Act
    zone('ruler').dispatchEvent(ctrlWheel(100, 150));
    zone('frames').dispatchEvent(ctrlWheel(100, 150, { metaKey: true }));

    // Assert
    expect(api.zoom()).toBe(0.5);
  });

  it('ignores a wheel without Ctrl or Cmd, or without vertical movement', () => {
    // Arrange
    const { zone, api } = setup();
    const plain = ctrlWheel(-100, 150, {});

    // Act
    zone('frames').dispatchEvent(plain);
    zone('frames').dispatchEvent(ctrlWheel(0, 150));

    // Assert
    expect(api.zoom()).toBe(1);
    expect(plain.defaultPrevented).toBe(false);
  });

  it('can be turned off', () => {
    // Arrange
    const { zone, api } = setup({ zoom: { wheel: false } });

    // Act
    zone('frames').dispatchEvent(ctrlWheel(-100, 150));

    // Assert
    expect(api.zoom()).toBe(1);
  });
});

describe('layout.zoom options and lifecycle', () => {
  it('applies the initial zoom without emitting zoom:changed', () => {
    // Arrange
    const events: ZoomChangedEvent[] = [];

    // Act
    const { editor } = mountLayout(
      [
        {
          id: 'test.listener',
          dependencies: ['core'],
          init: (ctx) => void ctx.events.on('zoom:changed', (event) => events.push(event)),
          destroy: () => {}
        }
      ],
      { zoom: { initialZoom: 2 } }
    );

    // Assert
    expect(editor.getService('layout.zoom')?.zoom()).toBe(2);
    expect(editor.getService('layout.ruler')?.frameWidth()).toBe(30);
    expect(editor.getService('layout.shell')?.element()?.style.getPropertyValue(FRAME_WIDTH_VAR)).toBe('30px');
    expect(events).toEqual([]);
  });

  it('refuses invalid options', () => {
    // Assert
    expect(() => new ZoomPlugin({ minZoom: 0 })).toThrow(RangeError);
    expect(() => new ZoomPlugin({ minZoom: 2, maxZoom: 1 })).toThrow(RangeError);
    expect(() => new ZoomPlugin({ levels: [1, -1] })).toThrow(RangeError);
    expect(() => new ZoomPlugin({ initialZoom: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('sorts the levels and clamps the initial zoom', () => {
    // Act
    const { api } = setup({ zoom: { levels: [3, 1, 2], initialZoom: 50, maxZoom: 3 } });

    // Assert
    expect(api.levels()).toEqual([1, 2, 3]);
    expect(api.zoom()).toBe(3);
  });

  it('stops listening to the wheel on destroy', () => {
    // Arrange
    const { editor, zone, api } = setup();
    const frames = zone('frames');

    // Act
    editor.destroy();
    frames.dispatchEvent(ctrlWheel(-100, 150));
    api.setZoom(2);

    // Assert
    expect(api.zoom()).toBe(1);
  });

  it('refuses to render before init', () => {
    // Arrange
    const plugin = new ZoomPlugin();

    // Act
    const act = (): void => plugin.render(document.createElement('div'));

    // Assert
    expect(act).toThrow('layout.zoom : render appelé avant init.');
  });
});

describe('layout.zoom gestures and re-entrancy', () => {
  it('adds up small pinch movements before stepping one level', () => {
    // Arrange
    const { zone, api } = setup();

    // Act
    [-10, -10, -10, -10].forEach((deltaY) => zone('frames').dispatchEvent(ctrlWheel(deltaY, 150)));
    const before = api.zoom();
    zone('frames').dispatchEvent(ctrlWheel(-10, 150));
    zone('frames').dispatchEvent(ctrlWheel(30, 150));

    // Assert
    expect(before).toBe(1);
    expect(api.zoom()).toBe(1.5);
  });

  it('counts wheel lines as 16 pixels', () => {
    // Arrange
    const { zone, api } = setup();

    // Act
    zone('frames').dispatchEvent(ctrlWheel(-4, 150, { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE }));

    // Assert
    expect(api.zoom()).toBe(1.5);
  });

  it('ignores a zoom asked from a zoom:changed listener', () => {
    // Arrange
    const { editor, api, events } = setup();
    editor.on('zoom:changed', () => api.setZoom(4));

    // Act
    api.setZoom(2);

    // Assert
    expect(api.zoom()).toBe(2);
    expect(events).toHaveLength(1);
  });
});
