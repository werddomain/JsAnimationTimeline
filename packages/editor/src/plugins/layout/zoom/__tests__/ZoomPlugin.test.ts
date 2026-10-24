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
import { WHEEL_IDLE_MS, ZoomPlugin } from '../ZoomPlugin';
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
    expect(() => new ZoomPlugin({ levels: [] })).toThrow(RangeError);
    expect(() => new ZoomPlugin({ levels: [5, 6], maxZoom: 3 })).toThrow(RangeError);
  });

  it('uses the bounds as levels when only bounds outside the default levels are given', () => {
    // Act
    const above = setup({ zoom: { minZoom: 5 } });
    const below = setup({ zoom: { maxZoom: 0.2 } });

    // Assert
    expect(above.api.levels()).toEqual([5, 8]);
    expect(above.api.zoom()).toBe(5);
    expect(below.api.levels()).toEqual([0.1, 0.2]);
    expect(below.api.zoom()).toBe(0.2);
  });

  it('adds the bounds to the default levels they cut, so the wheel can reach them', () => {
    // Arrange
    const { zone, api } = setup({ zoom: { minZoom: 4 } });
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };

    // Act
    zone('frames').dispatchEvent(ctrlWheel(-3, 150, lines));

    // Assert
    expect(api.levels()).toEqual([4, 8]);
    expect(api.zoom()).toBe(8);
  });

  it('keeps the default levels unchanged when the bounds cut none of them', () => {
    // Act
    const { api } = setup();

    // Assert
    expect(api.levels()).toEqual([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);
  });

  it('accepts equal bounds as a single level', () => {
    // Act
    const { api } = setup({ zoom: { minZoom: 2, maxZoom: 2 } });
    api.zoomIn();

    // Assert
    expect(api.levels()).toEqual([2]);
    expect(api.zoom()).toBe(2);
  });

  it('keeps only the levels within the bounds', () => {
    // Act
    const { api } = setup({ zoom: { maxZoom: 3, minZoom: 0.5 } });

    // Assert
    expect(api.levels()).toEqual([0.5, 0.75, 1, 1.5, 2, 3]);
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

  it('steps one level per notch in line or page mode (Firefox: 3 lines per notch)', () => {
    // Arrange
    const { zone, api } = setup();
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };

    // Act
    zone('frames').dispatchEvent(ctrlWheel(-3, 150, lines));
    const afterOne = api.zoom();
    zone('frames').dispatchEvent(ctrlWheel(-3, 150, lines));
    const afterTwo = api.zoom();
    zone('frames').dispatchEvent(ctrlWheel(1, 150, { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_PAGE }));

    // Assert
    expect([afterOne, afterTwo, api.zoom()]).toEqual([1.5, 2, 1.5]);
  });

  it('forgets a leftover pixel movement after a pause', () => {
    // Arrange
    const { zone, api } = setup();
    const at = (deltaY: number, timeStamp: number): WheelEvent => {
      const event = ctrlWheel(deltaY, 150);
      Object.defineProperty(event, 'timeStamp', { value: timeStamp });
      return event;
    };

    // Act : 40 px, pause, puis 40 px : aucun palier ; 40 + 40 sans pause : un palier.
    zone('frames').dispatchEvent(at(-40, 1000));
    zone('frames').dispatchEvent(at(-40, 1000 + WHEEL_IDLE_MS + 1));
    const afterPause = api.zoom();
    zone('frames').dispatchEvent(at(-40, 1000 + WHEEL_IDLE_MS + 50));

    // Assert
    expect(afterPause).toBe(1);
    expect(api.zoom()).toBe(1.5);
  });

  it('zooms continuously on a Safari pinch, without zooming the page', () => {
    // Arrange
    const { zone, api } = setup();
    const gesture = (type: string, scale: number): Event => {
      const event = new Event(type, { cancelable: true, bubbles: true });
      Object.defineProperty(event, 'scale', { value: scale });
      Object.defineProperty(event, 'clientX', { value: 250 });
      return event;
    };
    api.setZoom(2);
    const start = gesture('gesturestart', 1);
    const change = gesture('gesturechange', 1.25);

    // Act
    zone('frames').dispatchEvent(start);
    zone('frames').dispatchEvent(change);
    zone('ruler').dispatchEvent(gesture('gesturechange', 10));
    zone('frames').dispatchEvent(gesture('gestureend', 10));

    // Assert
    expect(start.defaultPrevented).toBe(true);
    expect(change.defaultPrevented).toBe(true);
    expect(api.zoom()).toBe(8);
  });

  it('stops zoomIn and zoomOut at the last and first levels, while setZoom reaches the bounds', () => {
    // Arrange
    const { api } = setup();

    // Act
    api.setZoom(4);
    api.zoomIn();
    const atLastLevel = api.zoom();
    api.setZoom(6);
    const beyond = api.zoom();
    api.zoomOut();

    // Assert
    expect([atLastLevel, beyond, api.zoom()]).toEqual([4, 6, 4]);
  });

  it('stops zoomOut at the first level, and zoomIn from below it goes to the first level', () => {
    // Arrange
    const { api } = setup();

    // Act
    api.setZoom(0.25);
    api.zoomOut();
    const atFirstLevel = api.zoom();
    api.setZoom(0.1);
    api.zoomIn();

    // Assert
    expect([atFirstLevel, api.zoom()]).toEqual([0.25, 0.25]);
  });

  it('applies the same first and last level limits to the wheel', () => {
    // Arrange
    const { zone, api } = setup();
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };

    // Act
    api.setZoom(0.25);
    zone('frames').dispatchEvent(ctrlWheel(3, 150, lines));
    const afterOut = api.zoom();
    api.setZoom(0.1);
    zone('frames').dispatchEvent(ctrlWheel(-3, 150, lines));
    const afterIn = api.zoom();
    api.setZoom(4);
    zone('frames').dispatchEvent(ctrlWheel(-3, 150, lines));

    // Assert
    expect([afterOut, afterIn, api.zoom()]).toEqual([0.25, 0.25, 4]);
  });

  it('steps one level per notch split into fractions of a line (8 × 0.375 = 3 lines)', () => {
    // Arrange
    const { zone, api } = setup();
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };
    const notch = (): number[] =>
      Array.from({ length: 8 }, () => {
        zone('frames').dispatchEvent(ctrlWheel(-0.375, 150, lines));
        return api.zoom();
      });

    // Act
    const first = notch();
    const second = notch();

    // Assert : un seul palier par cran, dès son premier morceau.
    expect(first).toEqual([1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5]);
    expect(second).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
  });

  it('steps one level per notch split into whole lines (2 × 1.5, 3 × 1)', () => {
    // Arrange
    const { zone, api } = setup();
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };

    // Act
    [-1.5, -1.5].forEach((deltaY) => zone('frames').dispatchEvent(ctrlWheel(deltaY, 150, lines)));
    const afterHalves = api.zoom();
    [-1, -1, -1].forEach((deltaY) => zone('frames').dispatchEvent(ctrlWheel(deltaY, 150, lines)));

    // Assert
    expect([afterHalves, api.zoom()]).toEqual([1.5, 2]);
  });

  it('steps once per gesture of a hi-res wheel whose notch is under 3 lines', () => {
    // Arrange
    const { zone, api } = setup();
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };
    const at = (deltaY: number, timeStamp: number): WheelEvent => {
      const event = ctrlWheel(deltaY, 150, lines);
      Object.defineProperty(event, 'timeStamp', { value: timeStamp });
      return event;
    };
    const notch = (start: number): void => {
      for (let i = 0; i < 8; i += 1) zone('frames').dispatchEvent(at(-0.125, start + i * 5));
    };

    // Act : 1 ligne par cran ; deux crans séparés d'une pause, puis deux sans pause.
    notch(1000);
    notch(1000 + WHEEL_IDLE_MS + 100);
    const afterPause = api.zoom();
    notch(5000);
    notch(5040);

    // Assert
    expect(afterPause).toBe(2);
    expect(api.zoom()).toBe(3);
  });

  it('starts a new notch on a change of direction and zooms out in line mode', () => {
    // Arrange
    const { zone, api } = setup();
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };

    // Act
    zone('frames').dispatchEvent(ctrlWheel(-0.375, 150, lines));
    const zoomedIn = api.zoom();
    zone('frames').dispatchEvent(ctrlWheel(0.375, 150, lines));
    const back = api.zoom();
    // Cran suivant, après une pause (sinon il continue le cran commencé à 0,375 ligne).
    const later = ctrlWheel(3, 150, lines);
    Object.defineProperty(later, 'timeStamp', { value: Number.MAX_SAFE_INTEGER });
    zone('frames').dispatchEvent(later);

    // Assert
    expect([zoomedIn, back, api.zoom()]).toEqual([1.5, 1, 0.75]);
  });

  it('starts a new notch on a change of unit', () => {
    // Arrange
    const { zone, api } = setup();
    const lines = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_LINE };

    // Act
    const zooms = [-0.75, -0.75, -0.75].map((deltaY) => {
      zone('frames').dispatchEvent(ctrlWheel(deltaY, 150, lines));
      return api.zoom();
    });
    zone('frames').dispatchEvent(ctrlWheel(-40, 150));
    const afterPixels = api.zoom();
    zone('frames').dispatchEvent(ctrlWheel(-0.75, 150, lines));

    // Assert : le 3e morceau reste dans le cran ; les lignes après les pixels en ouvrent un autre.
    expect(zooms).toEqual([1.5, 1.5, 1.5]);
    expect(afterPixels).toBe(1.5);
    expect(api.zoom()).toBe(2);
  });

  it('steps at a full page in page mode, fractions included', () => {
    // Arrange
    const { zone, api } = setup();
    const pages = { ctrlKey: true, deltaMode: WheelEvent.DOM_DELTA_PAGE };

    // Act
    [-0.5, -0.5].forEach((deltaY) => zone('frames').dispatchEvent(ctrlWheel(deltaY, 150, pages)));
    const afterOnePage = api.zoom();
    zone('frames').dispatchEvent(ctrlWheel(-0.5, 150, pages));

    // Assert
    expect([afterOnePage, api.zoom()]).toEqual([1.5, 2]);
  });

  it('steps at 50 pixels, not before', () => {
    // Arrange
    const { zone, api } = setup();

    // Act
    zone('frames').dispatchEvent(ctrlWheel(-49, 150));
    const before = api.zoom();
    zone('frames').dispatchEvent(ctrlWheel(-1, 150));

    // Assert
    expect([before, api.zoom()]).toEqual([1, 1.5]);
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
