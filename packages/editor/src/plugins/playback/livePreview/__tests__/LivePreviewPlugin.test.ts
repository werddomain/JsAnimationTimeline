// packages/editor/src/plugins/playback/livePreview/__tests__/LivePreviewPlugin.test.ts
/**
 * Tests de `playback.livePreview` : aperçu de la scène pendant le glisser de
 * la tête de lecture, en direct, limité (cadencé sur l'horloge de l'éditeur,
 * avec rendu de fin) ou au relâchement ; fin du glisser par toutes ses
 * issues ; lecture et changement de mode pendant un glisser ; service,
 * événement, liste de la barre d'outils et nettoyage.
 */

import { createEditor } from '../../../../core/editor/createEditor';
import { defaultPlugins } from '../../../../core/editor/defaultPlugins';
import { DEFAULT_PREVIEW_MAX_FPS, LIVE_PREVIEW_PLUGIN_ID, LivePreviewPlugin } from '../LivePreviewPlugin';
import { remainingMs } from '../previewSettings';
import type { PreviewChangedEvent } from '../types';
import { DISPLAY_FRAME_MS, cleanPreviews, mountPreview } from './livePreviewFixtures';

afterEach(() => {
  jest.useRealTimers();
  cleanPreviews();
});

describe('playback.livePreview modes', () => {
  it('renders every display frame of a drag in live mode (the default)', () => {
    // Arrange
    const { preview, renders, down, move, up } = mountPreview();

    // Act
    down(2);
    move(4);
    move(6);
    up();

    // Assert
    expect(preview().mode).toBe('live');
    expect(renders()).toEqual(['render:2', 'render:4', 'render:6']);
  });

  it('renders nothing during the drag and once on release in onRelease mode', () => {
    // Arrange
    const { renders, down, move, up } = mountPreview({ mode: 'onRelease' });

    // Act
    down(2);
    move(4);
    move(6);
    const during = renders();
    up();

    // Assert
    expect(during).toEqual([]);
    expect(renders()).toEqual(['render:6']);
  });

  it('paces renders on the editor clock in throttled mode, then renders the last frame on release', () => {
    // Arrange
    const { renders, down, move, up } = mountPreview({ mode: 'throttled', maxFps: 10 });

    // Act: 16 ms per display frame, 100 ms between renders (the document has 10 frames).
    down(2);
    for (let frame = 3; frame <= 10; frame += 1) move(frame);
    const during = renders();
    up();

    // Assert
    expect(during).toEqual(['render:2', 'render:9']);
    expect(renders()).toEqual(['render:2', 'render:9', 'render:10']);
  });

  it('renders the last frame after the interval when the pointer stops (trailing edge)', () => {
    // Arrange
    jest.useFakeTimers();
    const { renders, down, move } = mountPreview({ mode: 'throttled', maxFps: 10 });
    down(2);
    move(3);
    move(4);
    const beforeTrailing = renders();

    // Act
    jest.advanceTimersByTime(1000 / 10);

    // Assert
    expect(beforeTrailing).toEqual(['render:2']);
    expect(renders()).toEqual(['render:2', 'render:4']);
  });

  it('keeps the arrow keys on the head live (not a drag)', () => {
    // Arrange
    const { editor, renders, clock } = mountPreview({ mode: 'onRelease' });
    const head = editor.container.querySelector<HTMLElement>('[role="slider"]') as HTMLElement;

    // Act
    head.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(renders()).toEqual(['render:2']);
  });
});

describe('playback.livePreview drag endings', () => {
  it('renders when the drag is cancelled (pointercancel)', () => {
    // Arrange
    const { renders, down, move } = mountPreview({ mode: 'onRelease' });
    down(2);
    move(5);

    // Act
    document.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));

    // Assert
    expect(renders()).toEqual(['render:5']);
  });

  it('renders when the release was lost outside the window (move without button)', () => {
    // Arrange
    const { renders, down, move } = mountPreview({ mode: 'onRelease' });
    down(2);
    move(5);

    // Act
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 500, buttons: 0 }));

    // Assert
    expect(renders()).toEqual(['render:5']);
  });

  it('releases the hold when playback starts during a drag', () => {
    // Arrange
    const { editor, renders, clock, down, move } = mountPreview({ mode: 'onRelease' });
    down(2);
    move(5);

    // Act
    editor.playback.play();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(renders()[0]).toBe('render:5');
    expect(renders().length).toBeGreaterThanOrEqual(2);
  });

  it('applies a mode change made during a drag right away', () => {
    // Arrange
    const { preview, renders, down, move } = mountPreview({ mode: 'onRelease' });
    down(2);
    move(5);

    // Act
    preview().setMode('live');
    move(7);

    // Assert
    expect(renders()).toEqual(['render:5', 'render:7']);
  });

  it('holds from the next move when switching to onRelease during a drag', () => {
    // Arrange
    const { preview, renders, down, move, up } = mountPreview();
    down(2);

    // Act
    preview().setMode('onRelease');
    move(5);
    move(7);
    const during = renders();
    up();

    // Assert
    expect(during).toEqual(['render:2']);
    expect(renders()).toEqual(['render:2', 'render:7']);
  });

  it('leaves no hold and no timer behind when the editor is destroyed during a drag', () => {
    // Arrange
    jest.useFakeTimers();
    const { editor, renders, down, move } = mountPreview({ mode: 'throttled', maxFps: 10 });
    down(2);
    move(3);
    const before = renders();

    // Act
    editor.destroy();
    jest.advanceTimersByTime(1000);

    // Assert
    expect(renders()).toEqual(before);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('playback.livePreview service and event', () => {
  it('announces mode and frequency changes once each', () => {
    // Arrange
    const { editor, preview } = mountPreview();
    const events: PreviewChangedEvent[] = [];
    editor.on('playback:previewChanged', (event) => events.push(event));

    // Act
    preview().setMode('throttled');
    preview().setMode('throttled');
    preview().setMaxFps(20);

    // Assert
    expect(events).toEqual([
      { mode: 'throttled', maxFps: DEFAULT_PREVIEW_MAX_FPS },
      { mode: 'throttled', maxFps: 20 }
    ]);
    expect(preview().maxFps).toBe(20);
  });

  it.each([0, 61, 2.5, Number.NaN])('refuses a frequency of %p', (fps) => {
    // Arrange
    const { preview } = mountPreview();

    // Act + Assert
    expect(() => preview().setMaxFps(fps)).toThrow('La fréquence de l\'aperçu doit être un nombre entier de 1 à 60 images par seconde.');
  });

  it('refuses an unknown mode and invalid options', () => {
    // Arrange
    const { preview } = mountPreview();

    // Act + Assert
    expect(() => preview().setMode('sometimes' as 'live')).toThrow('Mode d\'aperçu inconnu');
    expect(() => new LivePreviewPlugin({ maxFps: 0 })).toThrow('La fréquence de l\'aperçu');
  });

  it('still hides layers whose eye is off once the preview renders', () => {
    // Arrange
    const { editor, stage, down, move, up } = mountPreview({ mode: 'onRelease' });
    editor.load({
      ...editor.document,
      layers: editor.document.layers.map((node) => (node.id === 'l-tree' ? { ...node, visible: false } : node))
    });

    // Act
    down(2);
    move(4);
    up();

    // Assert
    expect(stage.lastStates.find((state) => state.layerId === 'l-tree')?.editorVisible).toBe(false);
    expect(stage.lastStates.find((state) => state.layerId === 'l-hero')?.editorVisible).toBe(true);
  });
});

describe('playback.livePreview toolbar control', () => {
  it('adds a labelled select to the playback group, in French', () => {
    // Act
    const { editor } = mountPreview();

    // Assert
    const control = editor.container.querySelector(`[data-toolbar-item="${LIVE_PREVIEW_PLUGIN_ID}"]`);
    expect(control?.closest('[data-group]')?.getAttribute('data-group')).toBe('playback');
    const select = control?.querySelector('select') as HTMLSelectElement;
    expect(select.getAttribute('aria-label')).toBe('Aperçu pendant le glisser');
    expect(select.title).toBe('Aperçu pendant le glisser de la tête de lecture');
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'Aperçu en direct',
      'Aperçu limité (10 img/s)',
      'Aperçu au relâchement'
    ]);
    expect(select.value).toBe('live');
  });

  it('changes the mode from the select and follows changes made through the service', () => {
    // Arrange
    const { editor, preview } = mountPreview();
    const select = editor.container.querySelector(`[data-toolbar-item="${LIVE_PREVIEW_PLUGIN_ID}"] select`) as HTMLSelectElement;

    // Act
    select.value = 'onRelease';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const fromSelect = preview().mode;
    preview().setMaxFps(24);
    preview().setMode('throttled');

    // Assert
    expect(fromSelect).toBe('onRelease');
    expect(select.value).toBe('throttled');
    expect(select.selectedOptions[0]?.textContent).toBe('Aperçu limité (24 img/s)');
  });

  it('adds the control with the real default plugins (toolbar epic registered before playback)', () => {
    // Arrange
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Act
    const editor = createEditor(container, { defaultPlugins: defaultPlugins() });

    // Assert
    expect(editor.container.querySelector(`[data-toolbar-item="${LIVE_PREVIEW_PLUGIN_ID}"] select`)).not.toBeNull();
    editor.destroy();
  });

  it('mounts without toolbar.main and still holds during a scrub', () => {
    // Arrange
    const { editor, renders, down, move, up } = mountPreview({ mode: 'onRelease' }, { withToolbar: false });

    // Act
    down(2);
    move(6);
    const during = renders();
    up();

    // Assert
    expect(editor.container.querySelector(`[data-toolbar-item="${LIVE_PREVIEW_PLUGIN_ID}"]`)).toBeNull();
    expect(during).toEqual([]);
    expect(renders()).toEqual(['render:6']);
  });

  it('has no toolbar control with toolbar: false', () => {
    // Act
    const { editor } = mountPreview({ toolbar: false });

    // Assert
    expect(editor.container.querySelector(`[data-toolbar-item="${LIVE_PREVIEW_PLUGIN_ID}"]`)).toBeNull();
  });
});

describe('playback.livePreview hardening', () => {
  it('waits at most one interval even if the clock went backwards', () => {
    // Assert
    expect(remainingMs(0, 5000, 10)).toBe(100);
    expect(remainingMs(1000, 950, 10)).toBe(50);
    expect(remainingMs(1000, 800, 10)).toBe(0);
  });
});

describe('playback.livePreview timers and endings (review follow-ups)', () => {
  it('clears the trailing timer when the drag ends', () => {
    // Arrange
    jest.useFakeTimers();
    const { renders, down, move, up } = mountPreview({ mode: 'throttled', maxFps: 10 });
    down(2);
    move(3);
    expect(jest.getTimerCount()).toBe(1);

    // Act
    up();

    // Assert
    expect(jest.getTimerCount()).toBe(0);
    expect(renders()).toEqual(['render:2', 'render:3']);
  });

  it('clears the trailing timer when playback starts during a throttled drag', () => {
    // Arrange
    jest.useFakeTimers();
    const { editor, down, move } = mountPreview({ mode: 'throttled', maxFps: 10 });
    down(2);
    move(3);

    // Act
    editor.playback.play();

    // Assert
    expect(jest.getTimerCount()).toBe(0);
  });

  it('renders frame 6 once when the release comes before the pending display frame (onRelease)', () => {
    // Arrange
    const { renders, clock, down, moveQuiet, up } = mountPreview({ mode: 'onRelease' });
    down(2);

    // Act
    moveQuiet(6);
    up();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(renders()).toEqual(['render:6']);
  });

  it('renders frame 6 once when the release comes before the pending display frame (throttled)', () => {
    // Arrange
    const { renders, clock, down, moveQuiet, up } = mountPreview({ mode: 'throttled', maxFps: 10 });
    down(2);

    // Act
    moveQuiet(6);
    up();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(renders()).toEqual(['render:2', 'render:6']);
  });

  it('holds again when a drag goes on after playback was started then paused', () => {
    // Arrange
    const { editor, renders, clock, down, move, up } = mountPreview({ mode: 'onRelease' });
    down(2);
    move(4);
    editor.playback.play();
    clock.advance(DISPLAY_FRAME_MS);
    editor.playback.pause();
    clock.advance(DISPLAY_FRAME_MS);
    const before = renders();

    // Act
    move(7);
    const during = renders();
    up();

    // Assert
    expect(during).toEqual(before);
    expect(renders().slice(-1)).toEqual(['render:7']);
  });

  it('renders once when Escape ends an onRelease drag', () => {
    // Arrange
    const { renders, down, move } = mountPreview({ mode: 'onRelease' });
    down(2);
    move(6);

    // Act
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    // Assert
    expect(renders()).toEqual(['render:6']);
  });

  it('renders once when the window loses focus during an onRelease drag', () => {
    // Arrange
    const { renders, down, move } = mountPreview({ mode: 'onRelease' });
    down(2);
    move(6);

    // Act
    window.dispatchEvent(new Event('blur'));

    // Assert
    expect(renders()).toEqual(['render:6']);
  });
});

