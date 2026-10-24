// packages/editor/src/plugins/playback/controls/__tests__/PlaybackControlsPlugin.test.ts
/**
 * Tests de `playback.controls` : contrôles dans le groupe `playback` de la
 * barre d'outils, lire / pause par bouton et par Entrée, icône qui suit les
 * événements de lecture (fin comprise), boucle (`aria-pressed`), vitesse,
 * lecture sans scène et nettoyage.
 */

import { createManualClock } from '@werddomain/timeline-runtime';
import type { IManualClock } from '@werddomain/timeline-runtime';
import { createEditor } from '../../../../core/editor/createEditor';
import { defaultPlugins } from '../../../../core/editor/defaultPlugins';
import type { IEditor } from '../../../../core/editor/types';
import { createAnimatedDocument, DISPLAY_FRAME_MS } from '../../../../core/playback/__tests__/fixtures';
import { toolbarBasePlugins } from '../../../toolbar/__tests__/toolbarFixtures';
import { PlaybackPlugin } from '../../PlaybackPlugin';
import type { EditorPlugin, IEditorContext } from '../../../../core/context/IEditorContext';
import {
  formatSpeed,
  isEnterActivated,
  PLAYBACK_CONTROLS_PLUGIN_ID,
  PLAYBACK_SPEEDS,
  PlaybackControlsPlugin
} from '../PlaybackControlsPlugin';

afterEach(() => {
  document.body.innerHTML = '';
});

interface IMounted {
  readonly editor: IEditor;
  readonly clock: IManualClock;
  readonly toggle: HTMLButtonElement;
  readonly loop: HTMLButtonElement;
  readonly speed: HTMLSelectElement;
}

function mount(): IMounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const clock = createManualClock();
  const editor = createEditor(container, {
    data: createAnimatedDocument(),
    clock,
    defaultPlugins: [...toolbarBasePlugins(), new PlaybackPlugin()]
  });
  const find = <T extends HTMLElement>(selector: string): T => {
    const element = editor.container.querySelector<T>(selector);
    if (element === null) throw new Error(`${selector} absent.`);
    return element;
  };
  return {
    editor,
    clock,
    toggle: find<HTMLButtonElement>('[data-playback="toggle"]'),
    loop: find<HTMLButtonElement>('[data-playback="loop"]'),
    speed: find<HTMLSelectElement>('.jt-playbackControls__speed')
  };
}

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('playback.controls rendering', () => {
  it('adds the controls to the playback group of the toolbar, in French', () => {
    // Act
    const { editor, toggle, loop, speed } = mount();

    // Assert
    const control = editor.container.querySelector(`[data-toolbar-item="${PLAYBACK_CONTROLS_PLUGIN_ID}"]`);
    expect(control?.closest('[data-group]')?.getAttribute('data-group')).toBe('playback');
    expect(control?.getAttribute('aria-label')).toBe('Lecture');
    expect(toggle.getAttribute('aria-label')).toBe('Lire');
    expect(toggle.title).toBe('Lire (Entrée)');
    expect(loop.getAttribute('aria-label')).toBe('Boucle');
    expect(loop.getAttribute('aria-pressed')).toBe('false');
    expect(speed.getAttribute('aria-label')).toBe('Vitesse de lecture');
    expect(Array.from(speed.options).map((option) => option.textContent)).toEqual(PLAYBACK_SPEEDS.map((value) => formatSpeed(value)));
    expect(speed.value).toBe('1');
  });

  it('formats speeds with a French decimal comma', () => {
    // Assert
    expect([formatSpeed(0.5), formatSpeed(1), formatSpeed(1.5)]).toEqual(['×0,5', '×1', '×1,5']);
  });

  it('is in the default set, after the toolbar', () => {
    // Act
    const ids = defaultPlugins().map((plugin) => plugin.id);

    // Assert
    expect(ids.indexOf('playback')).toBeGreaterThan(ids.indexOf('toolbar'));
    expect(new PlaybackPlugin().children.map((child) => child.id)).toEqual(['playback.controls']);
  });
});

describe('playback.controls play and pause', () => {
  it('plays and pauses with the button, and the icon follows the state', () => {
    // Arrange
    const { editor, toggle } = mount();

    // Act + Assert
    toggle.click();
    expect(editor.playback.playing).toBe(true);
    expect(toggle.getAttribute('aria-label')).toBe('Pause');
    expect(toggle.title).toBe('Pause (Entrée)');
    toggle.click();
    expect(editor.playback.playing).toBe(false);
    expect(toggle.getAttribute('aria-label')).toBe('Lire');
  });

  it('toggles with Enter inside the editor, but not from a text field', () => {
    // Arrange
    const { editor } = mount();
    const field = document.createElement('input');
    editor.container.appendChild(field);

    // Act
    const handled = press(editor.container, { key: 'Enter' });
    const inField = press(field, { key: 'Enter' });

    // Assert
    expect(handled.defaultPrevented).toBe(true);
    expect(inField.defaultPrevented).toBe(false);
    expect(editor.playback.playing).toBe(true);
  });

  it('follows playback started elsewhere and shows Lire again when the end is reached', () => {
    // Arrange
    const { editor, clock, toggle } = mount();
    editor.playback.seek(20);
    clock.advance(DISPLAY_FRAME_MS);

    // Act + Assert
    editor.playback.play();
    expect(toggle.getAttribute('aria-label')).toBe('Pause');
    clock.advance(200);
    expect(editor.playback.playing).toBe(false);
    expect(toggle.getAttribute('aria-label')).toBe('Lire');
  });
});

describe('playback.controls loop and speed', () => {
  it('toggles the loop and shows it as pressed', () => {
    // Arrange
    const { editor, loop } = mount();

    // Act + Assert
    loop.click();
    expect(editor.playback.loop).toBe(true);
    expect(loop.getAttribute('aria-pressed')).toBe('true');
    loop.click();
    expect(editor.playback.loop).toBe(false);
    expect(loop.getAttribute('aria-pressed')).toBe('false');
  });

  it('changes the speed from the list', () => {
    // Arrange
    const { editor, speed } = mount();

    // Act
    speed.value = '0.5';
    speed.dispatchEvent(new Event('change', { bubbles: true }));

    // Assert
    expect(editor.playback.speed).toBe(0.5);
  });

  it('shows a speed set elsewhere, even one missing from the list, on the next playback event', () => {
    // Arrange
    const { editor, speed } = mount();

    // Act
    editor.playback.speed = 3;
    editor.playback.play();

    // Assert
    expect(speed.value).toBe('3');
    expect(speed.selectedOptions[0]?.textContent).toBe('×3');
  });
});

describe('playback.controls destroy', () => {
  it('removes its shortcut and controls', () => {
    // Arrange
    const { editor, toggle } = mount();
    const shortcuts = editor.getService('interaction.shortcuts');
    expect(shortcuts?.lookup('Enter')?.id).toBe('playback.controls.toggle');
    const host = toggle.closest('[data-zone="toolbar"]');

    // Act
    editor.destroy();

    // Assert
    expect(host?.querySelector('.jt-playbackControls')).toBeNull();
    expect(() => toggle.click()).not.toThrow();
  });
});

describe('playback.controls keyboard and lifecycle details', () => {
  it('leaves Enter to a focused button or link, which it activates', () => {
    // Arrange
    const { editor, loop } = mount();
    const link = document.createElement('a');
    link.href = '#aide';
    editor.container.appendChild(link);

    // Act
    const onButton = press(loop, { key: 'Enter' });
    const onLink = press(link, { key: 'Enter' });

    // Assert
    expect(onButton.defaultPrevented).toBe(false);
    expect(onLink.defaultPrevented).toBe(false);
    expect(editor.playback.playing).toBe(false);
  });

  it('shows a loop changed elsewhere once the playhead moves', () => {
    // Arrange
    const { editor, clock, loop } = mount();

    // Act
    editor.playback.loop = true;
    editor.playback.seek(5);
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(loop.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds an option for an unknown speed only once', () => {
    // Arrange
    const { editor, speed } = mount();
    editor.playback.speed = 3;

    // Act
    editor.playback.play();
    editor.playback.pause();
    editor.playback.play();

    // Assert
    expect(Array.from(speed.options).filter((option) => option.value === '3')).toHaveLength(1);
  });

  it('frees Enter and stops listening once destroyed', () => {
    // Arrange
    const plugin = new PlaybackControlsPlugin();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = createEditor(container, {
      data: createAnimatedDocument(),
      clock: createManualClock(),
      defaultPlugins: [...toolbarBasePlugins(), { id: 'playback', dependencies: [], children: [plugin], init: () => {}, destroy: () => {} }]
    });
    const shortcuts = editor.getService('interaction.shortcuts');

    // Act
    plugin.destroy();
    editor.playback.play();

    // Assert
    expect(shortcuts?.lookup('Enter')).toBeUndefined();
    expect(editor.container.querySelector('.jt-playbackControls')).toBeNull();
  });

  it('rolls back its listeners and shortcut when the toolbar refuses its control', () => {
    // Arrange
    const squatter: EditorPlugin = {
      id: 'test.squatter',
      dependencies: ['toolbar.main'],
      init: (ctx) =>
        void ctx.services.require('toolbar.main').addButton({ id: PLAYBACK_CONTROLS_PLUGIN_ID, label: 'X', onClick: () => {} }),
      destroy: () => {}
    };
    let captured: IEditorContext | undefined;
    const probe: EditorPlugin = { id: 'test.probe', dependencies: ['test.squatter'], init: (ctx) => (captured = ctx), destroy: () => {} };
    const container = document.createElement('div');
    document.body.appendChild(container);
    createEditor(container, { defaultPlugins: [...toolbarBasePlugins(), squatter, probe] });
    const ctx = captured as IEditorContext;

    // Act + Assert
    expect(() => new PlaybackControlsPlugin().init(ctx)).toThrow();
    expect(ctx.services.require('interaction.shortcuts').lookup('Enter')).toBeUndefined();
  });
});

describe('playback.controls review follow-ups', () => {
  it('toggles once when Enter is held down', () => {
    // Arrange
    const { editor } = mount();

    // Act
    press(editor.container, { key: 'Enter' });
    const repeated = press(editor.container, { key: 'Enter', repeat: true });

    // Assert
    expect(editor.playback.playing).toBe(true);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it('recognises a button from another document (iframe stage) by its node type', () => {
    // Arrange
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const foreign = frame.contentDocument?.createElement('button') ?? null;

    // Assert
    expect(isEnterActivated(foreign)).toBe(true);
    expect(isEnterActivated(document.createTextNode('x'))).toBe(false);
    expect(isEnterActivated(null)).toBe(false);
  });

  it('inserts an unknown speed in order, with a rounded French label', () => {
    // Arrange
    const { editor, speed } = mount();

    // Act
    editor.playback.speed = 0.1 + 0.2;
    editor.playback.play();

    // Assert
    const labels = Array.from(speed.options).map((option) => option.textContent);
    expect(labels).toEqual(['×0,25', '×0,3', '×0,5', '×1', '×1,5', '×2']);
  });
});

describe('formatSpeed', () => {
  it('never gives a custom speed the label of another one', () => {
    // Assert
    expect(formatSpeed(1 / 3)).toBe('×0,3333');
    expect(formatSpeed(25 / 24)).toBe('×1,042');
    expect(formatSpeed(1.0005, ['×1'])).toBe('×1,001');
    expect(formatSpeed(10.001, ['×10'])).toBe('×10,001');
    expect(formatSpeed(0.25001, ['×0,25'])).toBe('×0,25001');
    expect(formatSpeed(1e-7)).toBe('×0,0000001');
    expect(formatSpeed(0.1 + 0.2)).toBe('×0,3');
  });

  it('emits no shortcut:triggered for Enter repeats', () => {
    // Arrange
    const { editor } = mount();
    const triggered: string[] = [];
    editor.on('shortcut:triggered', (event) => triggered.push(event.id));

    // Act
    press(editor.container, { key: 'Enter' });
    press(editor.container, { key: 'Enter', repeat: true });
    press(editor.container, { key: 'Enter', repeat: true });

    // Assert
    expect(triggered).toEqual(['playback.controls.toggle']);
  });
});

describe('playback.controls Enter repeats', () => {
  it('consumes a held Enter repeat without toggling again', () => {
    // Arrange
    const { editor } = mount();
    press(editor.container, { key: 'Enter' });

    // Act
    const repeated = press(editor.container, { key: 'Enter', repeat: true });

    // Assert
    expect(repeated.defaultPrevented).toBe(true);
    expect(editor.playback.playing).toBe(true);
  });

  it('adds a single option for a speed just above a preset', () => {
    // Arrange
    const { editor, speed } = mount();

    // Act
    editor.playback.speed = 1.0005;
    editor.playback.play();

    // Assert
    const labels = Array.from(speed.options).map((option) => option.textContent);
    expect(labels.filter((label) => label === '×1')).toHaveLength(1);
    expect(labels).toContain('×1,001');
  });
});

describe('playback.controls speed options', () => {
  it('reuses the preset option for a speed that differs only by float noise', () => {
    // Arrange
    const { editor, speed } = mount();

    // Act
    editor.playback.speed = 2.3 - 0.8;
    editor.playback.play();

    // Assert
    const labels = Array.from(speed.options).map((option) => option.textContent);
    expect(labels.filter((label) => label === '×1,5')).toHaveLength(1);
    expect(speed.value).toBe('1.5');
  });

  it('keeps a long custom speed label short', () => {
    // Arrange
    const { editor, speed } = mount();

    // Act
    editor.playback.speed = 25 / 24;
    editor.playback.play();

    // Assert
    expect(speed.selectedOptions[0]?.textContent).toBe('×1,042');
  });
});

describe('playback.controls custom speed labels (round 4)', () => {
  it('gives 1.001 its own label after 1.0005 took "×1,001"', () => {
    // Arrange
    const { editor, speed } = mount();

    // Act
    editor.playback.speed = 1.0005;
    editor.playback.play();
    editor.playback.pause();
    editor.playback.speed = 1.001;
    editor.playback.play();

    // Assert
    const labels = Array.from(speed.options).map((option) => option.textContent);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('×1,001');
    expect(labels).toContain('×1,0010');
  });

  it('never pads a label into the value of another option', () => {
    // Assert
    expect(formatSpeed(1.00004, ['×1'], [1])).not.toBe('×1,000');
    expect(formatSpeed(1.001, ['×1', '×1,001'], [1, 1.0005])).toBe('×1,0010');
  });
});

