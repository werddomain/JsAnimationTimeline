// packages/editor/src/plugins/layout/ruler/__tests__/RulerPlugin.test.ts
/**
 * Tests de `layout.ruler` : rendu dans la zone de la règle (largeur,
 * étiquettes), variable `--jt-frame-width`, nouveau rendu quand la durée
 * change, service `layout.ruler` et nettoyage.
 */

import { cleanBody, makeScrollable, mountLayout, placeAt, timelineDocument } from '../../__tests__/layoutFixtures';
import { FRAME_WIDTH_VAR, RULER_CLASS, RULER_LABEL_CLASS, RulerPlugin } from '../RulerPlugin';

afterEach(cleanBody);

function labels(zone: HTMLElement): Array<{ text: string | null; left: string }> {
  return Array.from(zone.querySelectorAll<HTMLElement>(`.${RULER_LABEL_CLASS}`)).map((label) => ({
    text: label.textContent,
    left: label.style.left
  }));
}

describe('layout.ruler rendering', () => {
  it('draws the ruler in the ruler zone, as wide as the timeline', () => {
    // Act
    const { zone } = mountLayout([], { data: timelineDocument(30) });

    // Assert
    const ruler = zone('ruler').querySelector<HTMLElement>(`.${RULER_CLASS}`);
    expect(ruler).not.toBeNull();
    expect(ruler?.style.width).toBe('450px');
    expect(ruler?.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels frame 1, then every 5 frames, at the left edge of their frame', () => {
    // Act
    const { zone } = mountLayout([], { data: timelineDocument(12) });

    // Assert
    expect(labels(zone('ruler'))).toEqual([
      { text: '1', left: '0px' },
      { text: '5', left: '60px' },
      { text: '10', left: '135px' }
    ]);
  });

  it('spaces the labels out with narrow frames', () => {
    // Act
    const { zone } = mountLayout([], { data: timelineDocument(25), frameWidth: 4 });

    // Assert
    expect(labels(zone('ruler')).map((label) => label.text)).toEqual(['1', '10', '20']);
    expect(zone('ruler').querySelector<HTMLElement>(`.${RULER_CLASS}`)?.style.width).toBe('100px');
  });

  it('publishes the frame width as a CSS variable on the shell', () => {
    // Act
    const { editor } = mountLayout([], { frameWidth: 20 });

    // Assert
    expect(editor.getService('layout.shell')?.element()?.style.getPropertyValue(FRAME_WIDTH_VAR)).toBe('20px');
  });

  it('redraws when the number of frames changes, and only then', () => {
    // Arrange
    const { editor, zone } = mountLayout([], { data: timelineDocument(12) });
    const first = zone('ruler').querySelector(`.${RULER_LABEL_CLASS}`);

    // Act
    editor.load(timelineDocument(12, 30));
    const kept = zone('ruler').querySelector(`.${RULER_LABEL_CLASS}`);
    editor.load(timelineDocument(21));

    // Assert
    expect(kept).toBe(first);
    expect(labels(zone('ruler')).map((label) => label.text)).toEqual(['1', '5', '10', '15', '20']);
    expect(zone('ruler').querySelector<HTMLElement>(`.${RULER_CLASS}`)?.style.width).toBe('315px');
  });
});

describe('layout.ruler service', () => {
  it('gives the frame width and the left edge of a frame', () => {
    // Act
    const { editor } = mountLayout();
    const api = editor.getService('layout.ruler');

    // Assert
    expect(api?.frameWidth()).toBe(15);
    expect(api?.frameLeft(3)).toBe(30);
  });

  it('finds the frame under a window x, scrolling included, clamped to the timeline', () => {
    // Arrange
    const { editor, zone } = mountLayout([], { data: timelineDocument(100) });
    const ruler = zone('ruler');
    placeAt(ruler, 100);
    makeScrollable(ruler, { scrollWidth: 1500, scrollHeight: 24, clientWidth: 300, clientHeight: 24 });
    const api = editor.getService('layout.ruler');

    // Act
    const atStart = api?.frameAtClientX(107);
    const second = api?.frameAtClientX(115);
    ruler.scrollLeft = 30;
    const scrolled = api?.frameAtClientX(115);
    const before = api?.frameAtClientX(0);
    const after = api?.frameAtClientX(5000);

    // Assert
    expect([atStart, second, scrolled, before, after]).toEqual([1, 2, 4, 1, 100]);
  });
});

describe('layout.ruler lifecycle', () => {
  it('removes its element and its CSS variable on destroy', () => {
    // Arrange
    const { editor, zone } = mountLayout();
    const shell = editor.getService('layout.shell')?.element();
    const ruler = zone('ruler');

    // Act
    editor.destroy();

    // Assert
    expect(ruler.querySelector(`.${RULER_CLASS}`)).toBeNull();
    expect(shell?.style.getPropertyValue(FRAME_WIDTH_VAR)).toBe('');
  });

  it('refuses an invalid frame width', () => {
    // Act
    const act = (): RulerPlugin => new RulerPlugin({ frameWidth: 0 });

    // Assert
    expect(act).toThrow(RangeError);
  });

  it('refuses to render before init', () => {
    // Arrange
    const plugin = new RulerPlugin();

    // Act
    const act = (): void => plugin.render(document.createElement('div'));

    // Assert
    expect(act).toThrow('layout.ruler : render appelé avant init.');
  });

  it('answers frame 1 once destroyed', () => {
    // Arrange
    const { editor } = mountLayout();
    const api = editor.getService('layout.ruler');

    // Act
    editor.destroy();

    // Assert
    expect(api?.frameAtClientX(500)).toBe(1);
  });
});
