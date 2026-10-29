// packages/editor/src/plugins/layout/playhead/__tests__/PlayheadPlugin.test.ts
/**
 * Tests de `layout.playhead` : repère et ligne posés sur l'image affichée,
 * suivi de `playhead:changed`, `ctx.playback.seek` au clic, au glisser et au
 * clavier, pause au début d'un glisser, défilement pendant la lecture, ligne
 * alignée sur le défilement vertical et nettoyage.
 */

import type { EditorPlugin } from '../../../../core/context/IEditorContext';
import { createShortcutsPlugin } from '../../../interaction/shortcuts';
import { cleanBody, makeScrollable, mountLayout, placeAt, timelineDocument } from '../../__tests__/layoutFixtures';
import type { IMountedLayout } from '../../__tests__/layoutFixtures';
import {
  FOLLOW_MARGIN_FRAMES,
  PLAYHEAD_DRAGGING_CLASS,
  PLAYHEAD_HEAD_CLASS,
  PLAYHEAD_LINE_CLASS,
  PlayheadPlugin
} from '../PlayheadPlugin';

afterEach(cleanBody);

/** Durée d'une image d'affichage pour l'horloge manuelle, en millisecondes. */
const DISPLAY_FRAME_MS = 16;

interface IPlayheadSetup extends IMountedLayout {
  readonly head: HTMLElement;
  readonly line: HTMLElement;
  /** Fait avancer l'horloge (rendu de la lecture). */
  readonly tick: (ms?: number) => void;
}

function setup(totalFrames = 100, plugins: readonly EditorPlugin[] = []): IPlayheadSetup {
  const mounted = mountLayout(plugins, { data: timelineDocument(totalFrames) });
  const head = mounted.zone('ruler').querySelector<HTMLElement>(`.${PLAYHEAD_HEAD_CLASS}`);
  const line = mounted.zone('frames').querySelector<HTMLElement>(`.${PLAYHEAD_LINE_CLASS}`);
  if (head === null || line === null) throw new Error('Tête de lecture introuvable.');
  placeAt(mounted.zone('ruler'), 100);
  mounted.clock.advance(DISPLAY_FRAME_MS);
  return { ...mounted, head, line, tick: (ms = DISPLAY_FRAME_MS) => mounted.clock.advance(ms) };
}

/** Évènement de pointeur ; pendant un glisser, le bouton principal reste enfoncé (`buttons` 1). */
function pointer(type: string, clientX: number, button = 0): MouseEvent {
  const buttons = type === 'pointerup' || type === 'pointercancel' ? 0 : 1;
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button, buttons });
}

function key(name: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
}

describe('layout.playhead rendering', () => {
  it('draws a head on the ruler and a line in the frames, on the displayed frame', () => {
    // Act
    const { head, line } = setup();

    // Assert
    expect(head.style.left).toBe('0px');
    expect(head.style.width).toBe('15px');
    expect(line.style.left).toBe('7.5px');
    expect(line.getAttribute('aria-hidden')).toBe('true');
  });

  it('is an accessible slider over the frames, in French', () => {
    // Act
    const { head } = setup(48);

    // Assert
    expect(head.getAttribute('role')).toBe('slider');
    expect(head.getAttribute('aria-label')).toBe('Tête de lecture');
    expect(head.tabIndex).toBe(0);
    expect(head.getAttribute('aria-valuemin')).toBe('1');
    expect(head.getAttribute('aria-valuemax')).toBe('48');
    expect(head.getAttribute('aria-valuenow')).toBe('1');
    expect(head.getAttribute('aria-valuetext')).toBe('Image 1 sur 48');
  });

  it('follows playhead:changed', () => {
    // Arrange
    const { editor, head, line, tick } = setup();

    // Act
    editor.playback.seek(5);
    const before = head.style.left;
    tick();

    // Assert
    expect(before).toBe('0px');
    expect(head.style.left).toBe('60px');
    expect(line.style.left).toBe('67.5px');
    expect(head.getAttribute('aria-valuenow')).toBe('5');
  });

  it('keeps the slider value still while playing, and updates it on pause', () => {
    // Arrange
    const { editor, head, tick } = setup();
    editor.playback.play();
    tick();

    // Act
    tick(500);
    const whilePlaying = head.getAttribute('aria-valuenow');
    const moved = head.style.left;
    editor.playback.pause();
    tick();

    // Assert
    expect(whilePlaying).toBe('1');
    expect(moved).not.toBe('0px');
    expect(head.getAttribute('aria-valuenow')).toBe(String(editor.playback.frame));
  });

  it('updates the slider range when the number of frames changes', () => {
    // Arrange
    const { editor, head } = setup(100);

    // Act
    editor.load(timelineDocument(30));

    // Assert
    expect(head.getAttribute('aria-valuemax')).toBe('30');
  });

  it('keeps the line over the visible height when the frames scroll vertically', () => {
    // Arrange
    const { editor, zone, line } = setup();
    makeScrollable(zone('frames'), { scrollWidth: 1500, scrollHeight: 900, clientWidth: 300, clientHeight: 200 });

    // Act
    editor.getService('layout.scrollSync')?.scrollTo({ top: 120 });

    // Assert
    expect(line.style.transform).toBe('translateY(120px)');
  });
});

describe('layout.playhead pointer', () => {
  it('seeks to the frame under a click on the ruler', () => {
    // Arrange
    const { editor, zone, tick } = setup();

    // Act
    zone('ruler').dispatchEvent(pointer('pointerdown', 100 + 15 * 7 + 3));
    document.dispatchEvent(pointer('pointerup', 0));
    tick();

    // Assert
    expect(editor.playback.frame).toBe(8);
  });

  it('seeks while dragging, and stops at pointerup', () => {
    // Arrange
    const { editor, zone, head, tick } = setup();

    // Act
    zone('ruler').dispatchEvent(pointer('pointerdown', 100));
    const dragging = head.classList.contains(PLAYHEAD_DRAGGING_CLASS);
    document.dispatchEvent(pointer('pointermove', 100 + 15 * 3));
    document.dispatchEvent(pointer('pointermove', 100 + 15 * 9));
    tick();
    const during = editor.playback.frame;
    document.dispatchEvent(pointer('pointerup', 100 + 15 * 9));
    document.dispatchEvent(pointer('pointermove', 100 + 15 * 20));
    tick();

    // Assert
    expect(dragging).toBe(true);
    expect(during).toBe(10);
    expect(editor.playback.frame).toBe(10);
    expect(head.classList.contains(PLAYHEAD_DRAGGING_CLASS)).toBe(false);
  });

  it('pauses the playback when a drag starts', () => {
    // Arrange
    const { editor, zone } = setup();
    editor.playback.play();

    // Act
    zone('ruler').dispatchEvent(pointer('pointerdown', 130));

    // Assert
    expect(editor.playback.playing).toBe(false);
  });

  it('ignores other mouse buttons', () => {
    // Arrange
    const { editor, zone, tick } = setup();

    // Act
    zone('ruler').dispatchEvent(pointer('pointerdown', 100 + 15 * 5, 2));
    tick();

    // Assert
    expect(editor.playback.frame).toBe(1);
  });

  it('follows a single pointer: a second finger is ignored', () => {
    // Arrange
    const { editor, zone, tick } = setup();
    const touch = (type: string, clientX: number, pointerId: number): Event => {
      const event = pointer(type, clientX);
      Object.defineProperty(event, 'pointerId', { value: pointerId });
      return event;
    };
    zone('ruler').dispatchEvent(touch('pointerdown', 100 + 15 * 2, 1));

    // Act
    zone('ruler').dispatchEvent(touch('pointerdown', 100 + 15 * 30, 2));
    document.dispatchEvent(touch('pointermove', 100 + 15 * 40, 2));
    document.dispatchEvent(touch('pointerup', 0, 2));
    document.dispatchEvent(touch('pointermove', 100 + 15 * 5, 1));
    tick();

    // Assert
    expect(editor.playback.frame).toBe(6);
  });

  it('ends a drag on pointercancel', () => {
    // Arrange
    const { editor, zone, tick } = setup();
    zone('ruler').dispatchEvent(pointer('pointerdown', 100));

    // Act
    document.dispatchEvent(pointer('pointercancel', 0));
    document.dispatchEvent(pointer('pointermove', 100 + 15 * 6));
    tick();

    // Assert
    expect(editor.playback.frame).toBe(1);
  });
});

describe('layout.playhead keyboard', () => {
  it('moves one frame with the arrows, ten with the page keys, to the ends with Home and End', () => {
    // Arrange
    const { editor, head, tick } = setup(40);
    const press = (name: string): number => {
      head.dispatchEvent(key(name));
      tick();
      return editor.playback.frame;
    };

    // Act
    const frames = ['ArrowRight', 'ArrowUp', 'PageUp', 'ArrowLeft', 'PageDown', 'End', 'PageUp', 'Home', 'ArrowDown'].map(
      press
    );

    // Assert
    expect(frames).toEqual([2, 3, 13, 12, 2, 40, 40, 1, 1]);
  });

  it('leaves other keys alone', () => {
    // Arrange
    const { head } = setup();
    const event = key('a');

    // Act
    head.dispatchEvent(event);

    // Assert
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('layout.playhead follow', () => {
  it('scrolls the frames to keep the head visible while playing', () => {
    // Arrange
    const { editor, zone, tick } = setup();
    makeScrollable(zone('frames'), { scrollWidth: 1500, scrollHeight: 200, clientWidth: 150, clientHeight: 200 });
    editor.playback.play();
    tick();

    // Act
    tick(1000);

    // Assert
    const frame = editor.playback.frame;
    expect(frame).toBeGreaterThan(10);
    expect(zone('frames').scrollLeft).toBe((frame - 1 - FOLLOW_MARGIN_FRAMES) * 15);
  });

  it('shows the head after a paused seek or a key that leaves the view', () => {
    // Arrange
    const { editor, zone, head, tick } = setup();
    makeScrollable(zone('frames'), { scrollWidth: 1500, scrollHeight: 200, clientWidth: 150, clientHeight: 200 });

    // Act
    editor.playback.seek(60);
    tick();
    const afterSeek = zone('frames').scrollLeft;
    head.dispatchEvent(key('Home'));
    tick();

    // Assert
    expect(afterSeek).toBe((60 - 1 - FOLLOW_MARGIN_FRAMES) * 15);
    expect(zone('frames').scrollLeft).toBe(0);
  });

  it('does not scroll while the head is visible or being dragged', () => {
    // Arrange
    const { editor, zone, tick } = setup();
    makeScrollable(zone('frames'), { scrollWidth: 1500, scrollHeight: 200, clientWidth: 150, clientHeight: 200 });

    // Act
    editor.playback.seek(8);
    tick();
    const visible = zone('frames').scrollLeft;
    zone('ruler').dispatchEvent(pointer('pointerdown', 100));
    document.dispatchEvent(pointer('pointermove', 100 + 15 * 40));
    tick();

    // Assert
    expect(visible).toBe(0);
    expect(editor.playback.frame).toBe(41);
    expect(zone('frames').scrollLeft).toBe(0);
  });
});

describe('layout.playhead lifecycle', () => {
  it('removes its elements and stops a drag on destroy', () => {
    // Arrange
    const { editor, zone, head, line } = setup();
    const ruler = zone('ruler');
    ruler.dispatchEvent(pointer('pointerdown', 100));

    // Act
    editor.destroy();
    const act = (): void => {
      document.dispatchEvent(pointer('pointermove', 400));
      ruler.dispatchEvent(pointer('pointerdown', 400));
    };

    // Assert
    expect(act).not.toThrow();
    expect(head.isConnected).toBe(false);
    expect(line.isConnected).toBe(false);
  });

  it('refuses to render before init', () => {
    // Arrange
    const plugin = new PlayheadPlugin();

    // Act
    const act = (): void => plugin.render(document.createElement('div'));

    // Assert
    expect(act).toThrow('layout.playhead : render appelé avant init.');
  });
});

describe('layout.playhead scrubbing', () => {
  it('announces the start and end of a drag, and tells whether one is running', () => {
    // Arrange
    const { editor, zone } = setup();
    const events: string[] = [];
    editor.on('playhead:scrubStart', (event) => events.push(`start:${event.frame}`));
    editor.on('playhead:scrubEnd', (event) => events.push(`end:${event.frame}`));
    const api = editor.getService('layout.playhead');

    // Act
    zone('ruler').dispatchEvent(pointer('pointerdown', 100 + 15 * 2));
    const during = api?.isScrubbing();
    document.dispatchEvent(pointer('pointermove', 100 + 15 * 6));
    document.dispatchEvent(pointer('pointerup', 0));

    // Assert
    expect(during).toBe(true);
    expect(api?.isScrubbing()).toBe(false);
    expect(events).toEqual(['start:3', 'end:7']);
  });

  it('captures the pointer and ends the drag when the capture is lost', () => {
    // Arrange
    const { editor, zone, tick } = setup();
    const ruler = zone('ruler');
    const captured = new Set<number>();
    ruler.setPointerCapture = (id: number) => void captured.add(id);
    ruler.hasPointerCapture = (id: number) => captured.has(id);
    ruler.releasePointerCapture = (id: number) => void captured.delete(id);
    const down = pointer('pointerdown', 100);
    Object.defineProperty(down, 'pointerId', { value: 7 });
    const lost = new Event('lostpointercapture');
    Object.defineProperty(lost, 'pointerId', { value: 7 });

    // Act
    ruler.dispatchEvent(down);
    const whileDragging = captured.has(7);
    ruler.dispatchEvent(lost);
    const move = pointer('pointermove', 100 + 15 * 9);
    Object.defineProperty(move, 'pointerId', { value: 7 });
    document.dispatchEvent(move);
    tick();

    // Assert
    expect(whileDragging).toBe(true);
    expect(editor.getService('layout.playhead')?.isScrubbing()).toBe(false);
    expect(editor.playback.frame).toBe(1);
  });

  it('does not announce the end of a drag cut by destroy', () => {
    // Arrange
    const { editor, zone } = setup();
    const ends: number[] = [];
    editor.on('playhead:scrubEnd', (event) => ends.push(event.frame));
    zone('ruler').dispatchEvent(pointer('pointerdown', 100));

    // Act
    editor.destroy();

    // Assert
    expect(ends).toEqual([]);
  });
});

describe('layout.playhead zoom and end of playback', () => {
  it('re-places itself at the new frame width after zoom:changed', () => {
    // Arrange
    const { editor, head, line, tick } = setup();
    editor.playback.seek(5);
    tick();

    // Act
    editor.getService('layout.zoom')?.setZoom(2);

    // Assert
    expect(head.style.left).toBe('120px');
    expect(head.style.width).toBe('30px');
    expect(line.style.left).toBe('135px');
  });

  it('updates the slider value when a playback without loop completes', () => {
    // Arrange
    const { editor, head, tick } = setup(12);
    editor.playback.play();
    tick();

    // Act
    tick(5000);

    // Assert
    expect(editor.playback.playing).toBe(false);
    expect(head.getAttribute('aria-valuenow')).toBe('12');
  });

  it('shows the head and resyncs the ruler when it gets the keyboard focus', () => {
    // Arrange
    const { editor, zone, head, tick } = setup();
    makeScrollable(zone('frames'), { scrollWidth: 1500, scrollHeight: 200, clientWidth: 150, clientHeight: 200 });
    makeScrollable(zone('ruler'), { scrollWidth: 1500, scrollHeight: 24, clientWidth: 150, clientHeight: 24 });
    editor.playback.seek(60);
    tick();
    editor.getService('layout.scrollSync')?.scrollTo({ left: 0 });
    zone('ruler').scrollLeft = 400;

    // Act
    head.dispatchEvent(new FocusEvent('focus'));

    // Assert
    const expected = (60 - 1 - FOLLOW_MARGIN_FRAMES) * 15;
    expect(zone('frames').scrollLeft).toBe(expected);
    expect(zone('ruler').scrollLeft).toBe(expected);
  });
});

describe('layout.playhead click with the head out of view', () => {
  it('seeks to the clicked frame without first scrolling back to the old head', () => {
    // Arrange
    const { editor, zone, tick } = setup();
    makeScrollable(zone('frames'), { scrollWidth: 1500, scrollHeight: 200, clientWidth: 150, clientHeight: 200 });
    const order: string[] = [];
    editor.on('playhead:scrubStart', (event) => order.push(`start:${event.frame}`));
    editor.on('playhead:changed', (event) => order.push(`changed:${event.frame}`));
    editor.getService('layout.scrollSync')?.scrollTo({ left: 600 });

    // Act : image 1 hors de vue ; clic à 3 images du bord, soit l'image 44.
    zone('ruler').dispatchEvent(pointer('pointerdown', 100 + 15 * 3 + 2));
    tick();

    // Assert
    expect(zone('frames').scrollLeft).toBe(600);
    expect(editor.playback.frame).toBe(44);
    expect(order).toEqual(['start:44', 'changed:44']);
  });
});

describe('layout.playhead scrub abort paths', () => {
  /** Glisser commencé sur l'image 1 ; `ends` reçoit chaque `playhead:scrubEnd`. */
  function startScrub(): { readonly mounted: IPlayheadSetup; readonly ends: number[] } {
    const mounted = setup();
    const ends: number[] = [];
    mounted.editor.on('playhead:scrubEnd', (event) => ends.push(event.frame));
    mounted.zone('ruler').dispatchEvent(pointer('pointerdown', 100));
    return { mounted, ends };
  }

  it('ends the drag on pointercancel', () => {
    // Arrange
    const { mounted, ends } = startScrub();

    // Act
    document.dispatchEvent(pointer('pointercancel', 0));

    // Assert
    expect(ends).toEqual([1]);
    expect(mounted.editor.getService('layout.playhead')?.isScrubbing()).toBe(false);
  });

  it('ends the drag on a move with no button pressed (release lost outside the window)', () => {
    // Arrange
    const { mounted, ends } = startScrub();
    const lostRelease = new MouseEvent('pointermove', { bubbles: true, clientX: 100 + 15 * 8, buttons: 0 });

    // Act
    document.dispatchEvent(lostRelease);
    mounted.tick();

    // Assert
    expect(ends).toEqual([1]);
    expect(mounted.editor.playback.frame).toBe(1);
  });

  it('keeps following moves while the button is held', () => {
    // Arrange
    const { mounted, ends } = startScrub();

    // Act
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 100 + 15 * 4, buttons: 1 }));
    mounted.tick();

    // Assert
    expect(ends).toEqual([]);
    expect(mounted.editor.playback.frame).toBe(5);
  });

  it('ends the drag when the window loses focus', () => {
    // Arrange
    const { ends } = startScrub();

    // Act
    window.dispatchEvent(new Event('blur'));

    // Assert
    expect(ends).toEqual([1]);
  });

  it('ends the drag on Escape', () => {
    // Arrange
    const { ends } = startScrub();

    // Act
    const escape = key('Escape');
    document.dispatchEvent(escape);

    // Assert
    expect(ends).toEqual([1]);
    expect(escape.defaultPrevented).toBe(true);
  });

  it('keeps Escape for the drag: a host shortcut on Escape does not run', () => {
    // Arrange
    const mounted = setup(100, [createShortcutsPlugin()]);
    const run = jest.fn();
    mounted.editor.getService('interaction.shortcuts')?.register({ id: 'test.esc', keys: 'Escape', label: 'x', run });
    const ends: number[] = [];
    mounted.editor.on('playhead:scrubEnd', (event) => ends.push(event.frame));
    mounted.zone('ruler').dispatchEvent(pointer('pointerdown', 100));

    // Act
    const escape = key('Escape');
    mounted.head.dispatchEvent(escape);

    // Assert
    expect(ends).toEqual([1]);
    expect(run).not.toHaveBeenCalled();
    expect(escape.defaultPrevented).toBe(true);
  });

  it('leaves Escape alone when no drag is running', () => {
    // Arrange
    const mounted = setup(100, [createShortcutsPlugin()]);
    const run = jest.fn();
    mounted.editor.getService('interaction.shortcuts')?.register({ id: 'test.esc', keys: 'Escape', label: 'x', run });

    // Act
    const escape = key('Escape');
    mounted.head.dispatchEvent(escape);

    // Assert
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ends each drag only once', () => {
    // Arrange
    const { ends } = startScrub();

    // Act
    document.dispatchEvent(pointer('pointercancel', 0));
    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(key('Escape'));
    document.dispatchEvent(pointer('pointerup', 0));

    // Assert
    expect(ends).toEqual([1]);
  });
});
