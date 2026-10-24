// packages/editor/src/plugins/layout/scrollSync/__tests__/ScrollSyncPlugin.test.ts
/**
 * Tests de `layout.scrollSync` : recopie de la position des images dans la
 * règle et les calques une fois par image d'affichage, `layout:scrolled`,
 * molette sur la règle et les calques, épaisseur des barres de défilement,
 * service et nettoyage.
 */

import { createEditor } from '../../../../core/editor/createEditor';
import type { IScrollState } from '../scrollGeometry';
import { ScrollSyncPlugin } from '../ScrollSyncPlugin';
import { cleanBody, createContainer, makeScrollable, mountLayout } from '../../__tests__/layoutFixtures';
import type { IMountedLayout } from '../../__tests__/layoutFixtures';

afterEach(cleanBody);

/** Monte la mise en page avec des zones qui défilent et capture `layout:scrolled`. */
function setup(): IMountedLayout & { readonly events: IScrollState[] } {
  const mounted = mountLayout();
  makeScrollable(mounted.zone('frames'), {
    scrollWidth: 2000,
    scrollHeight: 1000,
    clientWidth: 500,
    clientHeight: 300,
    offsetWidth: 515,
    offsetHeight: 312
  });
  makeScrollable(mounted.zone('ruler'), { scrollWidth: 2000, scrollHeight: 24, clientWidth: 500, clientHeight: 24 });
  makeScrollable(mounted.zone('layers'), { scrollWidth: 250, scrollHeight: 1000, clientWidth: 250, clientHeight: 300 });
  const events: IScrollState[] = [];
  mounted.editor.on('layout:scrolled', (state) => events.push(state));
  return { ...mounted, events };
}

function wheel(init: WheelEventInit): WheelEvent {
  return new WheelEvent('wheel', { cancelable: true, bubbles: true, ...init });
}

describe('layout.scrollSync initial state', () => {
  it('announces the initial state on the first display frame after render', () => {
    // Arrange
    const { scheduler, events } = setup();

    // Act
    scheduler.flush();

    // Assert
    expect(events).toEqual([{ scrollLeft: 0, scrollTop: 0, viewportWidth: 500, viewportHeight: 300 }]);
  });
});

describe('layout.scrollSync frames scroll', () => {
  it('copies the frames position to the ruler and the layers on the next display frame', () => {
    // Arrange
    const { zone, scheduler } = setup();
    const frames = zone('frames');
    frames.scrollLeft = 120;
    frames.scrollTop = 80;

    // Act
    frames.dispatchEvent(new Event('scroll'));
    const before = { left: zone('ruler').scrollLeft, top: zone('layers').scrollTop };
    scheduler.flush();

    // Assert
    expect(before).toEqual({ left: 0, top: 0 });
    expect(zone('ruler').scrollLeft).toBe(120);
    expect(zone('layers').scrollTop).toBe(80);
  });

  it('emits layout:scrolled once per display frame, with the frames state', () => {
    // Arrange
    const { zone, scheduler, events } = setup();
    const frames = zone('frames');

    // Act
    frames.scrollLeft = 50;
    frames.dispatchEvent(new Event('scroll'));
    frames.scrollLeft = 60;
    frames.dispatchEvent(new Event('scroll'));
    const pending = scheduler.pendingCount();
    scheduler.flush();

    // Assert
    expect(pending).toBe(1);
    expect(events).toEqual([{ scrollLeft: 60, scrollTop: 0, viewportWidth: 500, viewportHeight: 300 }]);
  });

  it('does not emit layout:scrolled when nothing changed', () => {
    // Arrange
    const { zone, scheduler, events } = setup();
    const frames = zone('frames');
    frames.scrollTop = 10;
    frames.dispatchEvent(new Event('scroll'));
    scheduler.flush();

    // Act
    frames.dispatchEvent(new Event('scroll'));
    scheduler.flush();

    // Assert
    expect(events).toHaveLength(1);
  });

  it('publishes the frames scrollbar sizes as CSS variables on the shell', () => {
    // Arrange
    const { editor, zone, scheduler } = setup();
    const shell = editor.getService('layout.shell')?.element();

    // Act
    zone('frames').dispatchEvent(new Event('scroll'));
    scheduler.flush();

    // Assert
    expect(shell?.style.getPropertyValue('--jt-scrollbar-x')).toBe('12px');
    expect(shell?.style.getPropertyValue('--jt-scrollbar-y')).toBe('15px');
  });

  it('measures again after a document is loaded', () => {
    // Arrange
    const { editor, zone, scheduler, events } = setup();
    zone('frames').scrollLeft = 30;

    // Act
    editor.load(editor.toJSON());
    scheduler.flush();

    // Assert
    expect(zone('ruler').scrollLeft).toBe(30);
    expect(events).toHaveLength(1);
  });
});

describe('layout.scrollSync wheel', () => {
  it('scrolls the frames horizontally from a wheel over the ruler', () => {
    // Arrange
    const { zone, events } = setup();
    const event = wheel({ deltaY: 40 });

    // Act
    zone('ruler').dispatchEvent(event);

    // Assert
    expect(zone('frames').scrollLeft).toBe(40);
    expect(zone('frames').scrollTop).toBe(0);
    expect(zone('ruler').scrollLeft).toBe(40);
    expect(event.defaultPrevented).toBe(true);
    expect(events).toHaveLength(1);
  });

  it('scrolls the frames vertically from a wheel over the layers, horizontally with Shift', () => {
    // Arrange
    const { zone } = setup();

    // Act
    zone('layers').dispatchEvent(wheel({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE }));
    zone('layers').dispatchEvent(wheel({ deltaY: 25, shiftKey: true }));

    // Assert
    expect(zone('frames').scrollTop).toBe(48);
    expect(zone('frames').scrollLeft).toBe(25);
    expect(zone('layers').scrollTop).toBe(48);
  });

  it('lets the page scroll when the frames are already at their limit', () => {
    // Arrange
    const { zone } = setup();
    const event = wheel({ deltaY: -30 });

    // Act
    zone('layers').dispatchEvent(event);

    // Assert
    expect(zone('frames').scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves Ctrl or Cmd + wheel to the browser (zoom)', () => {
    // Arrange
    const { zone } = setup();
    const withCtrl = wheel({ deltaY: 40, ctrlKey: true });
    const withMeta = wheel({ deltaY: 40, metaKey: true });

    // Act
    zone('ruler').dispatchEvent(withCtrl);
    zone('layers').dispatchEvent(withMeta);

    // Assert
    expect(zone('frames').scrollLeft).toBe(0);
    expect(zone('frames').scrollTop).toBe(0);
    expect(withCtrl.defaultPrevented).toBe(false);
    expect(withMeta.defaultPrevented).toBe(false);
  });

  it('ignores a wheel event without movement', () => {
    // Arrange
    const { zone } = setup();
    const event = wheel({ deltaX: 0, deltaY: 0 });

    // Act
    zone('ruler').dispatchEvent(event);

    // Assert
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('layout.scrollSync service', () => {
  it('reads the frames state and scrolls them, syncing at once', () => {
    // Arrange
    const { editor, zone, events } = setup();
    const api = editor.getService('layout.scrollSync');

    // Act
    api?.scrollTo({ left: 300 });
    api?.scrollTo({ top: 5000 });

    // Assert
    expect(api?.getScroll()).toEqual({ scrollLeft: 300, scrollTop: 700, viewportWidth: 500, viewportHeight: 300 });
    expect(zone('ruler').scrollLeft).toBe(300);
    expect(zone('layers').scrollTop).toBe(700);
    expect(events).toHaveLength(2);
  });

  it('schedules a single measure on refresh', () => {
    // Arrange
    const { editor, scheduler } = setup();
    const api = editor.getService('layout.scrollSync');

    // Act
    api?.refresh();
    api?.refresh();

    // Assert
    expect(scheduler.pendingCount()).toBe(1);
  });
});

describe('layout.scrollSync lifecycle', () => {
  it('cancels the pending frame, stops listening and clears its CSS variables on destroy', () => {
    // Arrange
    const { editor, zone, scheduler } = setup();
    const api = editor.getService('layout.scrollSync');
    const shell = editor.getService('layout.shell')?.element();
    const frames = zone('frames');
    const ruler = zone('ruler');
    frames.dispatchEvent(new Event('scroll'));

    // Act
    editor.destroy();
    frames.scrollLeft = 90;
    frames.dispatchEvent(new Event('scroll'));
    ruler.dispatchEvent(wheel({ deltaY: 10 }));

    // Assert
    expect(scheduler.pendingCount()).toBe(0);
    expect(ruler.scrollLeft).toBe(0);
    expect(frames.scrollLeft).toBe(90);
    expect(shell?.style.getPropertyValue('--jt-scrollbar-x')).toBe('');
    expect(api?.getScroll()).toEqual({ scrollLeft: 0, scrollTop: 0, viewportWidth: 0, viewportHeight: 0 });
  });

  it('refuses to render before init', () => {
    // Arrange
    const plugin = new ScrollSyncPlugin();

    // Act
    const act = (): void => plugin.render(document.createElement('div'));

    // Assert
    expect(act).toThrow('layout.scrollSync : render appelé avant init.');
  });

  it('renders into the frames slot and depends on the shell', () => {
    // Arrange
    const plugin = new ScrollSyncPlugin();

    // Assert
    expect(plugin.slot).toBe('layout.frames');
    expect(plugin.dependencies).toEqual(['layout.shell']);
  });

  it('uses the window requestAnimationFrame when no scheduler is given', () => {
    // Arrange
    const raf = jest.spyOn(window, 'requestAnimationFrame');
    const editor = createEditor(createContainer());

    // Act
    editor.getService('layout.scrollSync')?.refresh();

    // Assert
    expect(raf).toHaveBeenCalledTimes(1);
    editor.destroy();
    raf.mockRestore();
  });

  it('falls back to cancellable timers when requestAnimationFrame is missing', () => {
    // Arrange
    jest.useFakeTimers();
    const original = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: undefined });
    const events: IScrollState[] = [];
    try {
      const editor = createEditor(createContainer());
      editor.on('layout:scrolled', (state) => events.push(state));

      // Act
      jest.runOnlyPendingTimers();
      editor.getService('layout.scrollSync')?.refresh();
      editor.destroy();
      jest.runOnlyPendingTimers();

      // Assert
      expect(events).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: original });
      jest.useRealTimers();
    }
  });
});
